import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { softDeleteExtension } from "@/server/soft-delete";
import type { DbClient, Tx } from "@/server/db";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/server/auth/guards";

// Session acquisition belongs to the HTTP boundary; query projections remain real.
vi.mock("@/server/auth/guards", () => ({ requirePortalCustomer: vi.fn() }));
const suppliedUrl = process.env.TEST_DATABASE_URL;
const schema = `test_cycle_${randomUUID().replaceAll("-", "")}`;
let db: DbClient;
let bootstrap: DbClient;
let created = false;
let previousUrl: string | undefined;
let actor: SessionUser;
let billing: typeof import("@/server/services/subscription-billing.service");
let portal: typeof import("@/server/queries/portal");
let entitlements: typeof import("@/server/services/entitlement.service");
const start = new Date("2035-09-01T00:00:00Z");
const oldEnd = new Date("2035-10-01T00:00:00Z");
const changeAt = new Date("2035-09-16T00:00:00Z");
const newEnd = new Date("2036-09-16T00:00:00Z");
const tx = <T>(fn: (client: Tx) => Promise<T>) =>
  db.$transaction(fn, { timeout: 60_000 });

async function fixture(oldValue = 5, newValue = 20, newPrice = 12000, rule: "DAILY" | "NONE" = "DAILY") {
  return tx(async (client) => {
    const customer = await client.customer.create({ data: {
      name: "Cycle test buyer", email: `${randomUUID()}@cycle.test`, currency: "USD",
    } });
    const product = await client.product.create({ data: {
      sku: randomUUID(), name: "Cycle test photos", type: "SUBSCRIPTION",
      basePriceMinor: 6000, costPriceMinor: 0,
      category: { create: { name: randomUUID() } },
    } });
    const oldTier = await client.planTier.create({ data: { productId: product.id, name: "Old", rank: 0 } });
    const newTier = await client.planTier.create({ data: { productId: product.id, name: "New", rank: 1 } });
    const oldPlan = await client.subscriptionPlan.create({ data: {
      productId: product.id, tierId: oldTier.id, name: "Old monthly", interval: "MONTHLY",
      priceMinor: 6000, prorationRule: rule,
    } });
    const newPlan = await client.subscriptionPlan.create({ data: {
      productId: product.id, tierId: newTier.id, name: "New yearly", interval: "YEARLY", priceMinor: newPrice,
    } });
    const def = await client.entitlementDefinition.create({ data: {
      productId: product.id, key: "photos_per_day", label: "Photos", unit: "photos", per: "DAY",
    } });
    await client.entitlementValue.createMany({ data: [
      { definitionId: def.id, tierId: oldTier.id, value: oldValue },
      { definitionId: def.id, tierId: newTier.id, value: newValue - 1 },
      { definitionId: def.id, tierId: newTier.id, interval: "YEARLY", value: newValue },
    ] });
    const quote = await client.quotation.create({ data: {
      number: randomUUID(), customerId: customer.id, ownerId: actor.id,
    } });
    const order = await client.order.create({ data: {
      number: randomUUID(), quotationId: quote.id, quotationVersion: 1,
      customerId: customer.id, currency: "USD", confirmedAt: start,
      lines: { create: {
        productId: product.id, productName: product.name, quotationLineId: randomUUID(),
        kind: "SUBSCRIPTION", qty: 1, unitPriceMinor: 6000, netMinor: 6000,
        taxMinor: 600, taxBp: 1000, costPriceMinor: 0, planId: oldPlan.id, interval: "MONTHLY",
      } },
    }, include: { lines: true } });
    const sub = await client.subscription.create({ data: {
      orderId: order.id, orderLineId: order.lines[0].id, customerId: customer.id,
      planId: oldPlan.id, qty: 1, unitPriceMinor: 6000, status: "ACTIVE",
      activationDate: start, billingAnchor: start,
    } });
    const originalInvoice = await billing.issuePeriod(client, sub.id, start);
    await billing.regenerateSchedule(client, sub.id);
    const original = await client.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    const originalSchedule = await client.billingScheduleItem.findUniqueOrThrow({ where: {
      subscriptionId_periodStart: { subscriptionId: sub.id, periodStart: start },
    } });
    const buyer: SessionUser = { id: randomUUID(), role: "CUSTOMER", customerId: customer.id, teamId: null };
    return { sub: original, oldPlan, newPlan, newTier, product, def, buyer, originalInvoice, originalSchedule };
  });
}
const savedSchedule = (id: string, periodStart = changeAt) => db.billingScheduleItem.findUniqueOrThrow({ where: {
  subscriptionId_periodStart: { subscriptionId: id, periodStart },
} });

// All migrations, policies, catalogue rows, invoices and cleanup are schema-local.
describe.skipIf(!suppliedUrl)("subscription cycle changes in an isolated schema", () => {
  beforeAll(async () => {
    const url = new URL(suppliedUrl!);
    if (!/^test_[a-zA-Z0-9_]+$/.test(url.searchParams.get("schema") ?? ""))
      throw new Error("TEST_DATABASE_URL must explicitly select a test_ schema.");
    url.searchParams.set("schema", schema);
    previousUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url.toString();
    bootstrap = new PrismaClient({ datasources: { db: { url: url.toString() } } }).$extends(softDeleteExtension);
    await bootstrap.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    created = true;
    // Separate test schemas need no shared migration advisory lock or ledger.
    for (const migration of readdirSync("prisma/migrations").filter((name) => /^\d/.test(name)).sort()) {
      const migrated = spawnSync("node_modules/.bin/prisma", ["db", "execute", "--schema", "prisma/schema.prisma", "--stdin"], {
        input: `SET search_path TO "${schema}";\n${readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8")}`,
        env: { ...process.env, DIRECT_URL: url.toString() }, encoding: "utf8", timeout: 120_000,
      });
      if (migrated.status !== 0)
        throw new Error("Isolated migration SQL failed (connection details withheld).");
    }
    db = (await import("@/server/db")).prisma;
    billing = await import("@/server/services/subscription-billing.service");
    portal = await import("@/server/queries/portal");
    entitlements = await import("@/server/services/entitlement.service");
    actor = await db.user.create({ data: {
      name: "Cycle test admin", email: `${randomUUID()}@cycle.test`, role: "ADMIN", isActive: true,
    } });
    await db.policyVersion.createMany({ data: [
      { kind: "BILLING", version: 1, isActive: true, payload: { scheduleHorizonPeriods: 2 } },
      { kind: "PORTAL", version: 1, isActive: true, payload: {} },
    ] });
  }, 180_000);
  afterEach(async () => {
    // Keep any later billing-job run scoped to the current fixture.
    if (db) await db.subscription.updateMany({ data: { status: "CANCELLED", nextBillingDate: null } });
  });
  afterAll(async () => {
    if (created) await bootstrap.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await db?.$disconnect();
    await bootstrap?.$disconnect();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }, 60_000);

  it.each([
    ["upgrade", 5, 20, 12000],
    ["downgrade", 20, 5, 6000],
  ] as const)("snapshots a monthly→yearly %s atomically and keeps retries/publication stable", async (_name, oldValue, newValue, price) => {
    const f = await fixture(oldValue, newValue, price);
    const input = { newPlanId: f.newPlan.id, idempotencyKey: randomUUID() };
    const transition = await billing.changeSubscription(actor, f.sub.id, input, changeAt);
    const sub = await db.subscription.findUniqueOrThrow({ where: { id: f.sub.id } });
    const schedule = await savedSchedule(sub.id);
    const invoice = await db.invoice.findUniqueOrThrow({ where: { sourceKey: `PRORATION:${input.idempotencyKey}` }, include: { lines: true } });
    expect(sub).toMatchObject({
      planId: f.newPlan.id, billingAnchor: changeAt, currentPeriodStart: changeAt,
      currentPeriodEnd: newEnd, nextBillingDate: newEnd,
      entitlementsSnapshot: { photos_per_day: { value: newValue, source: "OVERRIDE" } },
    });
    expect(schedule).toMatchObject({ periodStart: changeAt, periodEnd: newEnd, status: "INVOICED",
      amountMinor: price, invoiceId: invoice.id, entitlements: sub.entitlementsSnapshot });
    expect(invoice).toMatchObject({ type: "PRORATION", subtotalMinor: price, taxMinor: price / 10, totalMinor: price + price / 10 });
    expect(invoice.lines).toHaveLength(1);
    expect(invoice.lines[0]).toMatchObject({ subscriptionId: sub.id, periodStart: changeAt, periodEnd: newEnd, amountMinor: price });
    const publicView = await portal.getMySubscription(f.buyer, sub.id);
    expect(publicView.entitlements).toEqual([{ label: "Photos", value: String(newValue), unit: "photos", per: "day" }]);
    expect(publicView.subscription.schedule.find((row) => row.id === schedule.id)).toMatchObject({ invoiceId: invoice.id, periodEnd: newEnd });
    expect(await portal.getMyInvoice(f.buyer, invoice.id)).toMatchObject({ totalMinor: invoice.totalMinor });
    expect(f.originalSchedule.periodEnd).toEqual(oldEnd);
    expect(await savedSchedule(sub.id, start)).toEqual(f.originalSchedule);
    expect(await db.creditNote.findUniqueOrThrow({ where: { idempotencyKey: `CREDIT:${input.idempotencyKey}` } }))
      .toMatchObject({ sourceInvoiceId: f.originalInvoice.id, amountMinor: 3300, currency: "USD" });

    // Real catalogue publication changes NEXT period only, even on a change retry.
    await entitlements.setOverride(actor, f.def.id, f.newTier.id, "YEARLY", newValue + 7);
    const preview = await entitlements.previewPublish(actor, f.product.id);
    await entitlements.publishChanges(actor, f.product.id, "Future allowance", preview.revision);
    expect(await billing.changeSubscription(actor, sub.id, input, changeAt)).toEqual(transition);
    expect((await db.subscription.findUniqueOrThrow({ where: { id: sub.id } })).entitlementsSnapshot).toEqual(sub.entitlementsSnapshot);
    expect(await savedSchedule(sub.id)).toEqual(schedule);
    const published = await portal.getMySubscription(f.buyer, sub.id);
    expect(published.entitlements[0].value).toBe(String(newValue));
    expect(published.nextEntitlements[0].value).toBe(String(newValue + 7));
    expect(await db.invoice.count({ where: { orderId: sub.orderId } })).toBe(2);
    expect(await db.invoice.count({ where: { sourceKey: `SUB:${sub.id}:${changeAt.toISOString()}` } })).toBe(0);
    expect(await db.subscriptionTransition.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(1);
    expect(await db.creditNote.count({ where: { subscriptionId: sub.id } })).toBe(1);
  }, 180_000);

  it("rolls back the charge, credit, transition and snapshot when the current schedule cannot be saved", async () => {
    const f = await fixture();
    const input = { newPlanId: f.newPlan.id, idempotencyKey: randomUUID() };
    // A real database failure after invoicing proves the whole mutation is atomic.
    await db.$executeRawUnsafe(`ALTER TABLE "${schema}"."BillingScheduleItem"
      ADD CONSTRAINT cycle_test_failure CHECK ("periodStart" <> TIMESTAMP '2035-09-16 00:00:00') NOT VALID`);
    try {
      await expect(billing.changeSubscription(actor, f.sub.id, input, changeAt)).rejects.toThrow();
    } finally {
      await db.$executeRawUnsafe(`ALTER TABLE "${schema}"."BillingScheduleItem" DROP CONSTRAINT cycle_test_failure`);
    }
    expect(await db.subscription.findUniqueOrThrow({ where: { id: f.sub.id } })).toEqual(f.sub);
    expect(await db.invoice.findUniqueOrThrow({ where: { id: f.originalInvoice.id } })).toEqual(f.originalInvoice);
    expect(await db.invoice.count({ where: { orderId: f.sub.orderId } })).toBe(1);
    expect(await db.creditNote.count({ where: { subscriptionId: f.sub.id } })).toBe(0);
    expect(await db.subscriptionTransition.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(0);
    await billing.changeSubscription(actor, f.sub.id, input, changeAt);
    expect((await savedSchedule(f.sub.id)).status).toBe("INVOICED");
  }, 120_000);
  it("projects NONE changes at the boundary and invoices that exact period once", async () => {
    const f = await fixture(5, 20, 12000, "NONE");
    const input = { newPlanId: f.newPlan.id, newQty: 2, idempotencyKey: randomUUID() };
    const first = await billing.changeSubscription(actor, f.sub.id, input, changeAt);
    // A later pending decision at the same boundary wins, just as it does in billing.
    const latestInput = { ...input, newQty: 3, idempotencyKey: randomUUID() };
    const latest = await billing.changeSubscription(actor, f.sub.id, latestInput, new Date("2035-09-17T00:00:00Z"));
    const end = new Date("2036-10-01T00:00:00Z");
    const projected = await savedSchedule(f.sub.id, oldEnd);
    expect(projected).toMatchObject({
      periodStart: oldEnd, periodEnd: end, amountMinor: 36000, status: "UPCOMING", invoiceId: null,
    });
    expect((await savedSchedule(f.sub.id, end)).periodEnd).toEqual(new Date("2037-10-01T00:00:00Z"));
    expect(await db.subscription.findUniqueOrThrow({ where: { id: f.sub.id } })).toEqual(f.sub);
    expect(await savedSchedule(f.sub.id, start)).toEqual(f.originalSchedule);
    expect(await db.invoice.count({ where: { orderId: f.sub.orderId } })).toBe(1);
    expect(await db.creditNote.count({ where: { subscriptionId: f.sub.id } })).toBe(0);
    expect((await portal.getMySubscription(f.buyer, f.sub.id)).entitlements[0].value).toBe("5");
    expect(await billing.changeSubscription(actor, f.sub.id, latestInput, changeAt)).toEqual(latest);
    expect(await savedSchedule(f.sub.id, oldEnd)).toEqual(projected);

    // Emulate an already-stored projection from before this fix: upsert must repair its end.
    await db.billingScheduleItem.update({ where: { id: projected.id }, data: { periodEnd: new Date("2035-11-01T00:00:00Z") } });
    const { runBilling } = await import("@/server/services/billing-job");
    expect(await runBilling(new Date("2035-09-30T00:00:00Z"))).toMatchObject({ invoices: 0, failed: [] });
    // The earlier run regenerates projections; restore the legacy end to exercise issuePeriod's update branch.
    const beforeBoundary = await savedSchedule(f.sub.id, oldEnd);
    await db.billingScheduleItem.update({ where: { id: beforeBoundary.id }, data: { periodEnd: new Date("2035-11-01T00:00:00Z") } });
    expect(await runBilling(oldEnd)).toMatchObject({ invoices: 1, failed: [] });
    const sub = await db.subscription.findUniqueOrThrow({ where: { id: f.sub.id } });
    const schedule = await savedSchedule(f.sub.id, oldEnd);
    const invoice = await db.invoice.findUniqueOrThrow({
      where: { sourceKey: `SUB:${sub.id}:${oldEnd.toISOString()}` }, include: { lines: true },
    });
    expect(sub).toMatchObject({
      planId: f.newPlan.id, qty: 3, unitPriceMinor: 12000, billingAnchor: oldEnd,
      currentPeriodStart: oldEnd, currentPeriodEnd: end, nextBillingDate: end,
      entitlementsSnapshot: { photos_per_day: { value: 20, source: "OVERRIDE" } },
    });
    expect(schedule).toMatchObject({
      id: beforeBoundary.id, status: "INVOICED", periodStart: oldEnd, periodEnd: end,
      invoiceId: invoice.id, amountMinor: 36000, entitlements: sub.entitlementsSnapshot,
    });
    expect(invoice).toMatchObject({ type: "RECURRING", subtotalMinor: 36000, taxMinor: 3600, totalMinor: 39600 });
    expect(invoice.lines).toHaveLength(1);
    expect(invoice.lines[0]).toMatchObject({ subscriptionId: sub.id, qty: 3, periodStart: oldEnd, periodEnd: end });
    const publicView = await portal.getMySubscription(f.buyer, sub.id);
    expect(publicView.entitlements[0].value).toBe("20");
    expect(publicView.subscription.schedule.find((row) => row.id === schedule.id)).toMatchObject({ periodEnd: end, invoiceId: invoice.id });
    for (const change of [first, latest])
      expect((await db.subscriptionTransition.findUniqueOrThrow({ where: { id: change.id } })).detail).toMatchObject({ pending: false });
    expect(await runBilling(oldEnd)).toMatchObject({ invoices: 0, failed: [] });
    expect(await billing.changeSubscription(actor, sub.id, latestInput, changeAt)).toMatchObject({ id: latest.id });
    expect(await savedSchedule(sub.id, oldEnd)).toEqual(schedule);
    expect(await savedSchedule(sub.id, start)).toEqual(f.originalSchedule);
    expect(await db.invoice.count({ where: { orderId: sub.orderId } })).toBe(2);
    expect(await db.invoice.count({ where: { orderId: sub.orderId, type: "PRORATION" } })).toBe(0);
  }, 180_000);

});
