import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { softDeleteExtension } from "@/server/soft-delete";
import type { DbClient, Tx } from "@/server/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// No shared seed or default datasource: create and drop only our own schema.
const suppliedUrl = process.env.TEST_DATABASE_URL;
const schema = `test_credit_${randomUUID().replaceAll("-", "")}`;
let db: DbClient;
let created = false;
let service: typeof import("@/server/services/credit.service");
let previousDatabaseUrl: string | undefined;
let migrationRejectedMissingSource = false;
let migrationRolledBack = false;
let historicalIds: string[];

function executeSql(sql: string) {
  const result = spawnSync("node_modules/.bin/prisma", [
    "db", "execute", "--schema", "prisma/schema.prisma", "--stdin",
  ], {
    input: `SET search_path TO "${schema}";\n${sql}`,
    env: { ...process.env, DIRECT_URL: process.env.DATABASE_URL },
    encoding: "utf8",
    timeout: 120_000,
  });
  // Do not include CLI output: connection failures can contain credentials.
  return result.status === 0;
}
const transact = <T>(fn: (tx: Tx) => Promise<T>) =>
  db.$transaction(fn, { timeout: 60_000 });
const customer = (currency = "USD") => db.customer.create({
  data: { name: `Credit test ${randomUUID()}`, currency },
});
function invoice(customerId: string, currency = "USD", paidMinor = 0, orderId?: string) {
  return db.invoice.create({ data: {
    number: randomUUID(), sourceKey: randomUUID(), customerId, currency, orderId,
    type: "RECURRING", dueAt: new Date("2030-01-01"),
    subtotalMinor: 1000, taxMinor: 0, totalMinor: 1000, paidMinor,
  } });
}
async function subscription(customerId: string, currency = "EUR") {
  const owner = await db.user.create({ data: {
    name: "Credit test owner", email: `${randomUUID()}@credit.test`,
  } });
  const quote = await db.quotation.create({ data: {
    number: randomUUID(), customerId, ownerId: owner.id, currency,
  } });
  const product = await db.product.create({ data: {
    sku: randomUUID(), name: "Credit test plan", type: "SUBSCRIPTION",
    basePriceMinor: 1000, costPriceMinor: 0,
    category: { create: { name: randomUUID() } },
  } });
  const plan = await db.subscriptionPlan.create({ data: {
    productId: product.id, name: "Monthly", interval: "MONTHLY", priceMinor: 1000,
  } });
  const order = await db.order.create({ data: {
    number: randomUUID(), quotationId: quote.id, quotationVersion: 1,
    customerId, currency,
    lines: { create: {
      productId: product.id, productName: product.name, quotationLineId: randomUUID(),
      kind: "SUBSCRIPTION", qty: 1, unitPriceMinor: 1000, netMinor: 1000,
      taxMinor: 0, taxBp: 0, costPriceMinor: 0,
    } },
  }, include: { lines: true } });
  return db.subscription.create({ data: {
    orderId: order.id, orderLineId: order.lines[0].id, customerId, planId: plan.id,
    qty: 1, unitPriceMinor: 1000, activationDate: new Date(), billingAnchor: new Date(),
  } });
}
function input(customerId: string, overrides: Partial<Parameters<typeof service.issueCreditNote>[1]> = {}) {
  return { customerId, amountMinor: 200, reason: "Credit integrity test", idempotencyKey: randomUUID(), ...overrides };
}
const issue = (data: Parameters<typeof service.issueCreditNote>[1]) =>
  transact((tx) => service.issueCreditNote(tx, data));

// Explicit opt-in, and even an opted-in public schema is rejected.
describe.skipIf(!suppliedUrl)("credit currency integration (isolated schema)", () => {
  beforeAll(async () => {
    const url = new URL(suppliedUrl!);
    const requestedSchema = url.searchParams.get("schema");
    if (!requestedSchema || !/^test_[a-zA-Z0-9_]+$/.test(requestedSchema))
      throw new Error("TEST_DATABASE_URL must explicitly select a test_ schema.");
    url.searchParams.set("schema", schema);
    previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url.toString();
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } }).$extends(softDeleteExtension);
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    created = true;
    if (!executeSql(readFileSync("prisma/migrations/20260905063031_init/migration.sql", "utf8")))
      throw new Error("Isolated baseline migration failed (connection details withheld).");
    const c = await customer("GBP");
    const sub = await subscription(c.id, "EUR");
    const source = await invoice(c.id, "USD", 0, sub.orderId);
    historicalIds = Array.from({ length: 4 }, () => randomUUID());
    // Raw insertion deliberately models the schema before currency existed.
    for (const [index, id] of historicalIds.entries()) {
      await db.$executeRawUnsafe(`INSERT INTO "${schema}"."CreditNote"
        ("id", "number", "customerId", "subscriptionId", "sourceInvoiceId",
         "amountMinor", "remainingMinor", "refundDueMinor", "reason", "idempotencyKey")
        VALUES ($1, $1, $2, $3, $4, 200, 150, 50, 'Historical', $1)`,
      id, c.id, index < 2 ? sub.id : null,
      index === 0 ? source.id : index === 3 ? "missing-invoice" : null);
    }
    const migration = readFileSync("prisma/migrations/20260905120000_credit_currency_snapshot/migration.sql", "utf8");
    migrationRejectedMissingSource = !executeSql(migration);
    const columns = await db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = ${schema} AND table_name = 'CreditNote' AND column_name = 'currency'`;
    migrationRolledBack = columns.length === 0;
    await db.$executeRawUnsafe(`DELETE FROM "${schema}"."CreditNote" WHERE "id" = $1`, historicalIds[3]);
    if (!executeSql(migration))
      throw new Error("Isolated credit migration failed (connection details withheld).");
    service = await import("@/server/services/credit.service");
  }, 240_000);

  afterAll(async () => {
    if (created) await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await db?.$disconnect();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }, 60_000);

  it("backfills invoice > subscription order > customer; missing sources roll back atomically", async () => {
    expect(migrationRejectedMissingSource).toBe(true);
    expect(migrationRolledBack).toBe(true);
    const rows = await Promise.all(historicalIds.slice(0, 3).map((id) =>
      db.creditNote.findUniqueOrThrow({ where: { id } })));
    expect(rows.map((row) => row.currency)).toEqual(["USD", "EUR", "GBP"]);
    for (const row of rows) expect(row).toMatchObject({ amountMinor: 200, remainingMinor: 150, refundDueMinor: 50 });
    const columns = await db.$queryRaw<Array<{ is_nullable: string; column_default: string | null }>>`
      SELECT is_nullable, column_default FROM information_schema.columns
      WHERE table_schema = ${schema} AND table_name = 'CreditNote' AND column_name = 'currency'`;
    expect(columns).toEqual([{ is_nullable: "NO", column_default: null }]);
  });

  it("infers trusted currency and preserves history after customer changes", async () => {
    const c = await customer("GBP");
    const sub = await subscription(c.id, "EUR");
    const source = await invoice(c.id, "EUR", 0, sub.orderId);
    const fromInvoice = input(c.id, { sourceInvoiceId: source.id, subscriptionId: sub.id });
    const fromSubscription = input(c.id, { subscriptionId: sub.id });
    const fromCustomer = input(c.id);
    expect((await issue(fromInvoice)).currency).toBe("EUR");
    expect((await issue(fromSubscription)).currency).toBe("EUR");
    const original = await issue(fromCustomer);
    expect(original.currency).toBe("GBP");
    await db.customer.update({ where: { id: c.id }, data: { currency: "JPY" } });
    expect((await issue(fromCustomer)).id).toBe(original.id);
    expect((await issue(fromCustomer)).currency).toBe("GBP");
    expect((await issue(input(c.id))).currency).toBe("JPY");
    expect((await issue(fromInvoice)).currency).toBe("EUR");
    expect((await issue(fromSubscription)).currency).toBe("EUR");
  });

  it("rejects untrusted currencies, foreign owners, and conflicting sources without writes", async () => {
    const c = await customer();
    const other = await customer();
    const sub = await subscription(c.id, "EUR");
    const foreignSub = await subscription(other.id, "USD");
    const source = await invoice(c.id, "USD");
    const foreignInvoice = await invoice(other.id, "USD");
    const otherOrder = await subscription(c.id, "EUR");
    const wrongOrder = await invoice(c.id, "EUR", 0, otherOrder.orderId);
    const variants = [
      { currency: "EUR" },
      { sourceInvoiceId: source.id, currency: "EUR" },
      { subscriptionId: sub.id, currency: "USD" },
      { subscriptionId: foreignSub.id },
      { sourceInvoiceId: foreignInvoice.id },
      { sourceInvoiceId: source.id, subscriptionId: sub.id },
      { sourceInvoiceId: wrongOrder.id, subscriptionId: sub.id },
      { sourceInvoiceId: "missing-invoice" },
      { subscriptionId: "missing-subscription" },
    ];
    for (const variant of variants) await expect(issue(input(c.id, variant))).rejects.toThrow();
    expect(await db.creditNote.count({ where: { customerId: c.id } })).toBe(0);
  });

  it("binds idempotency to amount, customer, currency, invoice, subscription, and reason", async () => {
    const c = await customer();
    const sub = await subscription(c.id, "USD");
    const source = await invoice(c.id, "USD", 0, sub.orderId);
    const payload = input(c.id, { sourceInvoiceId: source.id, subscriptionId: sub.id });
    const credit = await issue(payload);
    expect((await issue({ ...payload, currency: "USD" })).id).toBe(credit.id);
    const changes = [
      { amountMinor: 201 }, { customerId: "other" }, { currency: "EUR" },
      { sourceInvoiceId: undefined }, { sourceInvoiceId: "other" },
      { subscriptionId: undefined }, { subscriptionId: "other" }, { reason: "Changed" },
    ];
    for (const change of changes)
      await expect(issue({ ...payload, ...change })).rejects.toThrow("Credit key already used.");
    const unsourced = input(c.id);
    await issue(unsourced);
    await expect(issue({ ...unsourced, sourceInvoiceId: source.id })).rejects.toThrow("Credit key already used.");
    await expect(issue({ ...unsourced, subscriptionId: sub.id })).rejects.toThrow("Credit key already used.");
    expect(await db.creditNote.count({ where: { idempotencyKey: payload.idempotencyKey } })).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: credit.id, action: "CREDIT.ISSUED" } })).toBe(1);
  });

  it("applies only matching currency oldest-first, respects paid balance, and retries once", async () => {
    const c = await customer();
    const other = await customer();
    const foreign = await issue(input(other.id));
    const eurSource = await invoice(c.id, "EUR");
    const eur = await issue(input(c.id, { sourceInvoiceId: eurSource.id, amountMinor: 500 }));
    const usd1 = await issue(input(c.id, { amountMinor: 400 }));
    const usd2 = await issue(input(c.id, { amountMinor: 400 }));
    await db.creditNote.update({ where: { id: usd1.id }, data: { createdAt: new Date("2020-01-01") } });
    const target = await invoice(c.id, "USD", 500);
    expect((await transact((tx) => service.applyAvailableCredits(tx, target.id))).creditAppliedMinor).toBe(500);
    await transact((tx) => service.applyAvailableCredits(tx, target.id));
    const apps = await db.creditApplication.findMany({ where: { invoiceId: target.id } });
    expect(apps.map((a) => [a.creditNoteId, a.amountMinor])).toEqual(expect.arrayContaining([[usd1.id, 400], [usd2.id, 100]]));
    expect(apps).toHaveLength(2);
    for (const [id, remainingMinor] of [[eur.id, 500], [foreign.id, 200], [usd1.id, 0], [usd2.id, 300]] as const)
      expect((await db.creditNote.findUniqueOrThrow({ where: { id } })).remainingMinor).toBe(remainingMinor);
    await db.customer.update({ where: { id: c.id }, data: { currency: "JPY" } });
    expect((await transact((tx) => service.applyAvailableCredits(tx, eurSource.id))).creditAppliedMinor).toBe(500);
  });

  it("preserves refund-due and source caps; skips void and draft invoices", async () => {
    const c = await customer();
    const paid = await invoice(c.id, "EUR", 1000);
    const credit = await issue(input(c.id, { sourceInvoiceId: paid.id, amountMinor: 700 }));
    expect(credit).toMatchObject({ currency: "EUR", remainingMinor: 0, refundDueMinor: 700 });
    await expect(issue(input(c.id, { sourceInvoiceId: paid.id, amountMinor: 301 }))).rejects.toThrow("Credits exceed");
    const partial = await invoice(c.id, "USD", 600);
    expect(await issue(input(c.id, { sourceInvoiceId: partial.id, amountMinor: 700 })))
      .toMatchObject({ remainingMinor: 400, refundDueMinor: 300 });
    for (const status of ["VOID", "DRAFT"] as const) {
      const target = await invoice(c.id);
      await db.invoice.update({ where: { id: target.id }, data: { status } });
      expect((await transact((tx) => service.applyAvailableCredits(tx, target.id))).creditAppliedMinor).toBe(0);
    }
  });
});
