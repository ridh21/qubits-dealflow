import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { NotFound } from "@/domain/errors";
import { loadEntitlementState } from "@/server/services/entitlement.service";
import { CycleInput } from "@/server/services/plan-catalog.service";

export async function listPlanProducts() {
  await requireAdmin();
  return prisma.product.findMany({
    where: { type: "SUBSCRIPTION" },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { tiers: true, plans: true, entitlementDefs: true } },
    },
  });
}
export async function getPlanEditorData(productId: string) {
  await requireAdmin();
  const product = await prisma.product.findFirst({
    where: { id: productId, type: "SUBSCRIPTION" },
    select: { id: true, name: true, sku: true, status: true },
  });
  if (!product) throw new NotFound("Subscription product not found.");
  const [state, plans] = await Promise.all([
    loadEntitlementState(prisma, productId),
    prisma.subscriptionPlan.findMany({ where: { productId } }),
  ]);
  return {
    product,
    tiers: state.tiers,
    plans,
    draft: state.draft,
    hasDraft: state.hasDraft,
  };
}
export async function listPlanNoticeHistory(
  productId: string,
  filters: {
    tierId?: string;
    interval?: string;
    from?: string;
    to?: string;
    page?: number;
  } = {},
) {
  await requireAdmin();
  const cycle = CycleInput.safeParse(filters.interval);
  const date = (s?: string) =>
    s && Number.isFinite(Date.parse(s)) ? new Date(s) : undefined;
  const page = Number.isFinite(filters.page)
    ? Math.max(1, Math.floor(filters.page!))
    : 1;
  const where: Prisma.PlanChangeNoticeWhereInput = {
    productId,
    ...(filters.tierId ? { tierId: filters.tierId } : {}),
    ...(cycle.success
      ? { OR: [{ interval: cycle.data }, { interval: null }] }
      : {}),
    publishedAt: {
      gte: date(filters.from),
      lt:
        filters.to && date(filters.to)
          ? new Date(date(filters.to)!.getTime() + 86400000)
          : undefined,
    },
  };
  const [rows, total] = await Promise.all([
    prisma.planChangeNotice.findMany({
      where,
      include: { tier: { select: { name: true } } },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: 20,
      skip: (page - 1) * 20,
    }),
    prisma.planChangeNotice.count({ where }),
  ]);
  const emails = await prisma.emailMessage.findMany({
    where: {
      relatedType: "PlanChangeNotice",
      relatedId: { in: rows.map((n) => n.id) },
    },
    select: { relatedId: true, status: true },
  });
  return {
    rows: rows.map((n) => ({
      ...n,
      publishedAt: n.publishedAt.toISOString(),
      emailStatuses: {
        queued: emails.filter(
          (e) => e.relatedId === n.id && e.status === "QUEUED",
        ).length,
        sent: emails.filter((e) => e.relatedId === n.id && e.status === "SENT")
          .length,
        failed: emails.filter(
          (e) => e.relatedId === n.id && e.status === "FAILED",
        ).length,
      },
    })),
    total,
    page,
    pageSize: 20,
  };
}
