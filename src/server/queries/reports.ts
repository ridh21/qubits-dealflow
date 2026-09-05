import { buildReport } from "@/server/services/report.service";
export type { ReportData } from "@/server/services/report.service";
import { prisma } from "@/server/db";
import { requireInternal } from "@/server/auth/guards";
import { parseReportFilters } from "@/lib/zod-schemas/reports";
import { reportQuotationWhere } from "@/server/reports/scope";
export async function getReport(raw: unknown) {
  return buildReport(await requireInternal(), raw);
}
export async function reportFilterOptions() {
  const actor = await requireInternal();
  const access = reportQuotationWhere(
    actor,
    parseReportFilters({ from: "2000-01-01", to: "2100-01-01" }),
  );
  const [owners, teams, products, categories, customers] = await Promise.all([
    prisma.user.findMany({
      where: { ownedQuotations: { some: access } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.team.findMany({
      where:
        actor.role === "SALES_REP" || actor.role === "SALES_MANAGER"
          ? { id: actor.teamId ?? "" }
          : {},
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.customer.findMany({
      where: { quotations: { some: access } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { owners, teams, products, categories, customers };
}
