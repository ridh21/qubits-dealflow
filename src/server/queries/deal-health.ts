import { AlertType, AlertStatus, RiskBand, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/guards";
export async function listHealthAlerts(
  filters: Record<string, string | undefined>,
) {
  const actor = await requireRole(["ADMIN", "SALES_MANAGER", "FINANCE"]);
  const date = (value?: string) =>
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value))
      ? new Date(value)
      : undefined;
  const until = date(filters.until);
  if (until) until.setUTCDate(until.getUTCDate() + 1);
  const owner: Prisma.QuotationWhereInput = {
    ...(filters.owner ? { ownerId: filters.owner } : {}),
    ...(filters.team ? { owner: { teamId: filters.team } } : {}),
  };
  const where: Prisma.DealHealthAlertWhereInput = {
    type: Object.values(AlertType).find((v) => v === filters.type),
    severity: Object.values(RiskBand).find((v) => v === filters.severity),
    status: Object.values(AlertStatus).find((v) => v === filters.status),
    flaggedAt: { gte: date(filters.from), lt: until },
    ...(filters.owner || filters.team
      ? { OR: [{ quotation: owner }, { order: { quotation: owner } }] }
      : {}),
  };
  const [total, groups, users, teams] = await Promise.all([
    prisma.dealHealthAlert.count({ where }),
    prisma.dealHealthAlert.groupBy({
      by: ["type"],
      where: { status: { not: "RESOLVED" } },
      _count: true,
    }),
    prisma.user.findMany({
      where: {
        role: { in: ["SALES_REP", "SALES_MANAGER", "ADMIN"] },
        isActive: true,
      },
      select: { id: true, name: true },
    }),
    prisma.team.findMany({ select: { id: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / 25));
  const page = Math.min(
    pages,
    Math.max(1, Math.floor(Number(filters.page) || 1)),
  );
  const rows = await prisma.dealHealthAlert.findMany({
    where,
    orderBy: [{ flaggedAt: "desc" }, { id: "asc" }],
    take: 25,
    skip: (page - 1) * 25,
    include: {
      quotation: { select: { number: true } },
      order: { select: { number: true } },
    },
  });
  return { actor, rows, groups, total, page, pages, users, teams };
}
