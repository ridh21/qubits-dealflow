import "server-only";
import { Prisma, RecurringInterval, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/guards";
import { boundariesFrom } from "@/domain/boundaries/boundaries";
import { effectiveFor } from "@/domain/entitlements/effective";

export type SubscriptionFilters = Record<string, string | undefined>;
export async function listSubscriptions(filters: SubscriptionFilters) {
  await requireRole(["ADMIN", "FINANCE"]);
  const status = Object.values(SubscriptionStatus).find(
    (value) => value === filters.status,
  );
  const interval = Object.values(RecurringInterval).find(
    (value) => value === filters.cycle,
  );
  const validDate = (value?: string) =>
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value))
      ? new Date(value)
      : undefined;
  const from = validDate(filters.from),
    until = validDate(filters.until);
  if (until) until.setUTCDate(until.getUTCDate() + 1);
  const where: Prisma.SubscriptionWhereInput = {
    status,
    customerId: filters.customer || undefined,
    planId: filters.plan || undefined,
    plan: { interval, tierId: filters.tier || undefined },
    ...(from || until ? { nextBillingDate: { gte: from, lt: until } } : {}),
    ...(filters.q
      ? {
          OR: [
            {
              customer: { name: { contains: filters.q, mode: "insensitive" } },
            },
            {
              orderLine: {
                productName: { contains: filters.q, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };
  const [total, customers, plans, tiers] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.customer.findMany({
      where: { subscriptions: { some: {} } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.subscriptionPlan.findMany({
      select: { id: true, name: true, interval: true },
      orderBy: { name: "asc" },
    }),
    prisma.planTier.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / 25));
  const page = Math.min(
    pages,
    Math.max(1, Math.floor(Number(filters.page) || 1)),
  );
  const rows = await prisma.subscription.findMany({
    where,
    include: {
      customer: { select: { name: true } },
      orderLine: { select: { productName: true } },
      plan: { include: { tier: true } },
      order: { select: { currency: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * 25,
    take: 25,
  });
  return { rows, total, pages, page, customers, plans, tiers };
}

export async function getSubscription(id: string) {
  await requireRole(["ADMIN", "FINANCE"]);
  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true } },
      plan: { include: { tier: true } },
      orderLine: true,
      order: {
        include: {
          lines: {
            include: {
              completion: true,
              subscription: { include: { plan: true } },
            },
          },
          invoices: { include: { lines: true }, orderBy: { issuedAt: "desc" } },
        },
      },
      schedule: { orderBy: { periodStart: "asc" } },
      transitions: { orderBy: [{ createdAt: "desc" }, { id: "desc" }] },
      creditNotes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!subscription) return null;
  const [plans, definitions, values] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where: { productId: subscription.plan.productId, isActive: true },
      include: { tier: true },
      orderBy: { priceMinor: "asc" },
    }),
    prisma.entitlementDefinition.findMany({
      where: { productId: subscription.plan.productId },
    }),
    subscription.plan.tierId
      ? prisma.entitlementValue.findMany({
          where: { tierId: subscription.plan.tierId },
        })
      : Promise.resolve([]),
  ]);
  const pauseAt =
    subscription.pauseEffectiveAt ?? subscription.currentPeriodEnd;
  const resumeBoundaries = pauseAt
    ? boundariesFrom(
        subscription.billingAnchor,
        subscription.plan.interval,
        new Date(Math.max(pauseAt.getTime(), Date.now()) + 1),
        6,
      )
    : [];
  const nextEntitlements = subscription.plan.tierId
    ? effectiveFor(
        definitions,
        values,
        subscription.plan.tierId,
        subscription.plan.interval,
      )
    : {};
  return { subscription, plans, resumeBoundaries, nextEntitlements };
}
export type SubscriptionDetail = NonNullable<
  Awaited<ReturnType<typeof getSubscription>>
>;
