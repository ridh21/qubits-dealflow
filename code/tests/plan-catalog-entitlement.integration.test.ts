import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import type { SessionUser } from "@/server/auth/guards";
import {
  createTier,
  updateTier,
  upsertPlanForTierCycle,
  copyPricesAcrossCycles,
} from "@/server/services/plan-catalog.service";
import {
  defineEntitlement,
  setTierDefault,
  setOverride,
  resetOverride,
  previewPublish,
  publishChanges,
  loadEntitlementState,
  updateEntitlementDefinition,
} from "@/server/services/entitlement.service";
import {
  effectiveFor,
  INTERVALS,
  type Interval,
} from "@/domain/entitlements/effective";
import { on } from "@/server/events";
import { seedPlans } from "../prisma/seed/plans";

// Run with scripts/test-database.mjs; fixtures are independent of the demo seed.
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "plan catalogue and entitlement publication",
  { timeout: 180_000 },
  () => {
    let actor: SessionUser;
    beforeAll(async () => {
      const url = process.env.TEST_DATABASE_URL!;
      const parsed = new URL(url);
      if (
        process.env.DATABASE_URL !== url ||
        (!parsed.pathname.includes("test") &&
          !parsed.searchParams.get("schema")?.includes("test"))
      )
        throw new Error("Use the disposable test database runner.");
      actor = await prisma.user.create({
        data: {
          email: `${randomUUID()}@plan.test`,
          role: "ADMIN",
          name: "Plan admin",
        },
      });
    });
    async function fixture() {
      const category = await prisma.category.create({
        data: { name: randomUUID() },
      });
      const product = await prisma.product.create({
        data: {
          sku: randomUUID(),
          name: "Photo App",
          type: "SUBSCRIPTION",
          categoryId: category.id,
          basePriceMinor: 1500,
          costPriceMinor: 100,
        },
      });
      const tier = await createTier(actor, product.id, {
        name: "Pro",
        rank: 0,
      });
      const plans = await Promise.all(
        INTERVALS.map((interval) =>
          upsertPlanForTierCycle(actor, tier.id, interval, {
            priceMinor: 1500,
            prorationRule: "DAILY",
            cancellationRule: "PRORATED_CREDIT",
            isActive: true,
          }),
        ),
      );
      const def = await defineEntitlement(actor, product.id, {
        key: "photos_per_day",
        label: "Photos",
        unit: "photos",
        per: "DAY",
        valueType: "INT",
      });
      await setTierDefault(actor, def.id, tier.id, 5);
      const state = await loadEntitlementState(prisma, product.id);
      for (const interval of INTERVALS)
        expect(
          effectiveFor(
            state.draft.definitions,
            state.draft.values,
            tier.id,
            interval,
          ).photos_per_day.value,
        ).toBe(5);
      // Draft edits do not touch the live values.
      expect(
        await prisma.entitlementValue.count({ where: { tierId: tier.id } }),
      ).toBe(0);
      await setOverride(actor, def.id, tier.id, "MONTHLY", 7);
      const initial = await previewPublish(actor, product.id);
      await publishChanges(
        actor,
        product.id,
        "Initial catalogue",
        initial.revision,
      );
      return { product, tier, plans, def };
    }
    async function holder(
      f: Awaited<ReturnType<typeof fixture>>,
      interval: Interval,
      status:
        | "SCHEDULED"
        | "ACTIVE"
        | "PAUSE_SCHEDULED"
        | "PAUSED"
        | "CANCELLED" = "ACTIVE",
      email: string | null = `${randomUUID()}@customer.test`,
    ) {
      const customer = await prisma.customer.create({
        data: { name: `${interval} holder`, email },
      });
      const quotation = await prisma.quotation.create({
        data: {
          number: randomUUID(),
          ownerId: actor.id,
          customerId: customer.id,
        },
      });
      const order = await prisma.order.create({
        data: {
          number: randomUUID(),
          quotationId: quotation.id,
          quotationVersion: 1,
          customerId: customer.id,
          currency: "USD",
        },
      });
      const line = await prisma.orderLine.create({
        data: {
          orderId: order.id,
          productId: f.product.id,
          productName: "Photo App",
          quotationLineId: randomUUID(),
          kind: "SUBSCRIPTION",
          qty: 1,
          unitPriceMinor: 1500,
          netMinor: 1500,
          taxMinor: 0,
          taxBp: 0,
          costPriceMinor: 100,
        },
      });
      const snapshot = {
        photos_per_day: { value: interval === "MONTHLY" ? 7 : 5 },
      };
      return prisma.subscription.create({
        data: {
          orderId: order.id,
          orderLineId: line.id,
          customerId: customer.id,
          planId: f.plans.find((p) => p.interval === interval)!.id,
          qty: 1,
          unitPriceMinor: 1500,
          status,
          activationDate: new Date("2026-09-01Z"),
          billingAnchor: new Date("2026-09-01Z"),
          currentPeriodEnd:
            status === "PAUSED" ? null : new Date("2026-10-01Z"),
          resumeAt: status === "PAUSED" ? new Date("2026-12-01Z") : null,
          entitlementsSnapshot: snapshot,
        },
      });
    }
    it("publishes only changed cycles to current holders and portal users, preserving snapshots", async () => {
      const f = await fixture();
      const subs = await Promise.all(
        INTERVALS.map((interval, index) =>
          holder(
            f,
            interval,
            (["SCHEDULED", "ACTIVE", "PAUSE_SCHEDULED", "PAUSED"] as const)[
              index
            ],
          ),
        ),
      );
      const cancelled = await holder(f, "WEEKLY", "CANCELLED");
      const weeklyCustomer = await prisma.customer.findUniqueOrThrow({
        where: { id: subs[0].customerId },
      });
      // Duplicate address should receive one message; inactive and internal users none.
      await prisma.user.createMany({
        data: [
          {
            email: weeklyCustomer.email!,
            isActive: true,
            role: "CUSTOMER",
            name: "Portal recipient",
            customerId: weeklyCustomer.id,
          },
          {
            email: `${randomUUID()}@portal.test`,
            isActive: true,
            role: "CUSTOMER",
            name: "Portal recipient",
            customerId: weeklyCustomer.id,
          },
          {
            email: `${randomUUID()}@inactive.test`,
            role: "CUSTOMER",
            name: "Portal recipient",
            customerId: weeklyCustomer.id,
            isActive: false,
          },
          {
            email: `${randomUUID()}@internal.test`,
            isActive: true,
            role: "ADMIN",
            name: "Portal recipient",
            customerId: weeklyCustomer.id,
          },
        ],
      });
      await setTierDefault(actor, f.def.id, f.tier.id, 2);
      const preview = await previewPublish(actor, f.product.id);
      expect(preview.changes.map((c) => c.interval).sort()).toEqual([
        "QUARTERLY",
        "WEEKLY",
        "YEARLY",
      ]);
      expect(preview.notices.reduce((n, c) => n + c.recipients, 0)).toBe(4);
      const emitted: string[] = [];
      const off = on("plan.changed", async ({ noticeId }) => {
        expect(
          await prisma.planChangeNotice.findUnique({ where: { id: noticeId } }),
        ).not.toBeNull();
        emitted.push(noticeId);
      });
      let published;
      try {
        published = await publishChanges(
          actor,
          f.product.id,
          "Reduced allowance",
          preview.revision,
        );
      } finally {
        off();
      }
      expect(published.emailsQueued).toBe(4);
      expect(emitted.sort()).toEqual(published.noticeIds.sort());
      const emails = await prisma.emailMessage.findMany({
        where: {
          relatedType: "PlanChangeNotice",
          relatedId: { in: published.noticeIds },
        },
      });
      expect(emails).toHaveLength(4);
      expect(
        emails.every(
          (e) =>
            e.status === "QUEUED" &&
            e.textBody.includes("2") &&
            e.textBody.includes("5"),
        ),
      ).toBe(true);
      const excluded = await prisma.customer.findMany({
        where: { id: { in: [subs[1].customerId, cancelled.customerId] } },
      });
      expect(
        emails.some((e) => excluded.some((c) => c.email === e.toEmail)),
      ).toBe(false);
      for (const sub of subs)
        expect(
          (
            await prisma.subscription.findUniqueOrThrow({
              where: { id: sub.id },
            })
          ).entitlementsSnapshot,
        ).toEqual(sub.entitlementsSnapshot);
      const state = await loadEntitlementState(prisma, f.product.id);
      expect(state.hasDraft).toBe(false);
      expect(
        effectiveFor(state.definitions, state.values, f.tier.id, "WEEKLY")
          .photos_per_day.value,
      ).toBe(2);
      expect(
        effectiveFor(state.definitions, state.values, f.tier.id, "MONTHLY")
          .photos_per_day.value,
      ).toBe(7);
      expect(
        await prisma.auditLog.count({
          where: {
            entityId: f.product.id,
            action: "ENTITLEMENTS.PUBLISHED",
            reason: "Reduced allowance",
          },
        }),
      ).toBe(1);
      await expect(
        publishChanges(actor, f.product.id, "Retry", preview.revision),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      expect(
        await prisma.emailMessage.count({
          where: { relatedId: { in: published.noticeIds } },
        }),
      ).toBe(4);
    });
    it("rejects stale previews and serializes concurrent publishes without duplicate notices", async () => {
      const f = await fixture();
      await holder(f, "WEEKLY");
      await setTierDefault(actor, f.def.id, f.tier.id, 2);
      const stale = await previewPublish(actor, f.product.id);
      await setTierDefault(actor, f.def.id, f.tier.id, 3);
      await expect(
        publishChanges(actor, f.product.id, "Stale", stale.revision),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const preview = await previewPublish(actor, f.product.id);
      const results = await Promise.allSettled([
        publishChanges(actor, f.product.id, "A", preview.revision),
        publishChanges(actor, f.product.id, "B", preview.revision),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const successful = results.find((r) => r.status === "fulfilled")!;
      if (successful.status !== "fulfilled")
        throw new Error("Expected one publish");
      expect(successful.value.emailsQueued).toBe(1);
      expect(
        await prisma.emailMessage.count({
          where: { relatedId: { in: successful.value.noticeIds } },
        }),
      ).toBe(1);
    });
    it("keeps the draft and live values intact when an affected holder has no email", async () => {
      const f = await fixture();
      await holder(f, "WEEKLY", "ACTIVE", "   ");
      await setTierDefault(actor, f.def.id, f.tier.id, 2);
      const state = await loadEntitlementState(prisma, f.product.id);
      const count = await prisma.planChangeNotice.count({
        where: { productId: f.product.id },
      });
      await expect(
        publishChanges(
          actor,
          f.product.id,
          "Invalid recipient",
          state.draft.revision,
        ),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      const after = await loadEntitlementState(prisma, f.product.id);
      expect(after.values).toEqual(state.values);
      expect(after.draft).toEqual(state.draft);
      expect(
        await prisma.planChangeNotice.count({
          where: { productId: f.product.id },
        }),
      ).toBe(count);
    });
    it("resets an override in the draft and prevents silent semantic definition changes", async () => {
      const f = await fixture();
      await resetOverride(actor, f.def.id, f.tier.id, "MONTHLY");
      const preview = await previewPublish(actor, f.product.id);
      expect(preview.changes).toEqual([
        expect.objectContaining({ interval: "MONTHLY", before: 7, after: 5 }),
      ]);
      await expect(
        updateEntitlementDefinition(actor, f.product.id, f.def.id, {
          key: "photos_per_day",
          label: "Photos",
          unit: "photos",
          per: "WEEK",
          valueType: "INT",
        }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(
        setTierDefault(actor, f.def.id, f.tier.id, true),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      const foreign = await fixture();
      await expect(
        setTierDefault(actor, f.def.id, foreign.tier.id, 3),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      for (const role of ["FINANCE", "CUSTOMER", "SALES_REP"]) {
        const denied = { ...actor, role };
        await expect(
          setTierDefault(denied, f.def.id, f.tier.id, 1),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
          publishChanges(denied, f.product.id, "Denied", preview.revision),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
          createTier(denied, f.product.id, { name: role, rank: 0 }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    });
    it("copies prices with discount and blocks deactivating a tier with current holders", async () => {
      const f = await fixture();
      await copyPricesAcrossCycles(actor, f.tier.id, "MONTHLY", 10);
      expect(
        (
          await prisma.subscriptionPlan.findUniqueOrThrow({
            where: {
              tierId_interval: { tierId: f.tier.id, interval: "YEARLY" },
            },
          })
        ).priceMinor,
      ).toBe(16200);
      await holder(f, "MONTHLY");
      await expect(
        updateTier(actor, f.tier.id, { name: "Pro", rank: 0, isActive: false }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      const empty = await createTier(actor, f.product.id, {
        name: "Empty",
        rank: 1,
      });
      await updateTier(actor, empty.id, {
        name: empty.name,
        rank: 1,
        isActive: false,
      });
      await expect(
        upsertPlanForTierCycle(actor, empty.id, "MONTHLY", {
          priceMinor: 100,
          prorationRule: "NONE",
          cancellationRule: "NONE",
          isActive: true,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
    });
    it("seeds the required tiers and prices repeatably without replacing admin prices", async () => {
      await seedPlans(prisma);
      await seedPlans(prisma);
      const care = await prisma.subscriptionPlan.findMany({
        where: { product: { sku: "SUB-CARE" }, tier: { name: "Standard" } },
      });
      expect(care.map((p) => [p.interval, p.priceMinor]).sort()).toEqual([
        ["MONTHLY", 4600],
        ["YEARLY", 46000],
      ]);
      const pro = await prisma.subscriptionPlan.findFirstOrThrow({
        where: {
          product: { sku: "SUB-PHOTO" },
          tier: { name: "Pro" },
          interval: "MONTHLY",
        },
      });
      await prisma.subscriptionPlan.update({
        where: { id: pro.id },
        data: { priceMinor: 1599 },
      });
      await seedPlans(prisma);
      expect(
        (
          await prisma.subscriptionPlan.findUniqueOrThrow({
            where: { id: pro.id },
          })
        ).priceMinor,
      ).toBe(1599);
      await prisma.subscriptionPlan.update({
        where: { id: pro.id },
        data: { priceMinor: 1500 },
      });
      expect(
        await prisma.subscriptionPlan.count({
          where: { product: { sku: "SUB-PHOTO" }, tierId: { not: null } },
        }),
      ).toBe(12);
    });
  },
);
