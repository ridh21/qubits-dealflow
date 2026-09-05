import { prisma, type Tx } from "@/server/db";
import type { SessionUser } from "@/server/auth/guards";
import { parseReportFilters, reportPeriod } from "@/lib/zod-schemas/reports";
import { reportQuotationWhere } from "@/server/reports/scope";
import { analyticsView, allowedViews } from "@/domain/analytics/charts";
import { salesCharts } from "./sales";
import { financeCharts } from "./finance";
import { opsCharts } from "./ops";
import { adminCharts } from "./admin";
import { mrrHistoryCharts } from "./mrr-history";
export async function buildAnalytics(
  actor: SessionUser,
  raw: Record<string, unknown>,
  db: Tx = prisma,
  now = new Date(),
) {
  const view = analyticsView(
    actor.role,
    typeof raw.view === "string" ? raw.view : undefined,
  );
  const filters = parseReportFilters(raw);
  // A manager/admin's Rep view is explicitly their personal pipeline.
  const scopedActor = view === "rep" ? { ...actor, role: "SALES_REP" } : actor;
  const context = {
    db,
    actor,
    filters,
    scope: reportQuotationWhere(scopedActor, filters),
    period: reportPeriod(filters),
    now,
  };
  const charts = await (view === "rep" || view === "manager"
    ? salesCharts(context, view === "manager")
    : view === "finance"
      ? Promise.all([financeCharts(context), mrrHistoryCharts(context)]).then(
          (groups) => groups.flat(),
        )
      : view === "ops"
        ? opsCharts(context)
        : adminCharts(context));
  const stalled =
    view === "rep" || view === "manager"
      ? await db.quotation.findMany({
          where: {
            AND: [
              context.scope,
              {
                alerts: {
                  some: {
                    type: "STALLED",
                    status: { not: "RESOLVED" },
                    flaggedAt: {
                      gte: context.period.from,
                      lt: context.period.to,
                    },
                  },
                },
              },
            ],
          },
          select: { id: true, number: true, lastActivityAt: true },
          orderBy: { lastActivityAt: "asc" },
        })
      : [];
  return {
    stalled: stalled.map((q) => ({
      ...q,
      lastActivityAt: q.lastActivityAt.toISOString(),
    })),
    filters,
    view,
    views: allowedViews(actor.role),
    charts,
    generatedAt: context.now.toISOString(),
  };
}
export type AnalyticsData = Awaited<ReturnType<typeof buildAnalytics>>;
