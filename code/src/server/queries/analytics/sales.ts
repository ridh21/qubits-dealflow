import type { AnalyticsContext } from "./context";
import { month } from "./context";
import {
  pipelineMilestones,
  alertHeatmap,
  percentage,
  seriesRows,
  type AnalyticsChart,
} from "@/domain/analytics/charts";
import { discountByRep } from "@/domain/reports/kpis";
import { reportQuotationWhere } from "@/server/reports/scope";
export async function salesCharts(
  context: AnalyticsContext,
  manager: boolean,
): Promise<AnalyticsChart[]> {
  const { db, scope, period, actor, filters } = context;
  const [quotes, requests, alerts, benchmark, flagged] = await Promise.all([
    db.quotation.findMany({
      where: {
        AND: [scope, { createdAt: { gte: period.from, lt: period.to } }],
      },
      include: {
        owner: { select: { name: true } },
        versions: { select: { reason: true, requiredLevel: true } },
        approvals: { select: { status: true } },
        lines: { select: { excessBp: true, addedFromUpsell: true } },
      },
    }),
    manager
      ? db.approvalRequest.findMany({
          where: {
            quotation: scope,
            createdAt: { gte: period.from, lt: period.to },
          },
          include: { steps: { orderBy: { index: "asc" } } },
        })
      : Promise.resolve([]),
    db.dealHealthAlert.findMany({
      where: {
        quotation: scope,
        flaggedAt: { gte: period.from, lt: period.to },
        status: { not: "RESOLVED" },
      },
      select: { quotationId: true, type: true },
    }),
    // The rep benchmark exposes only a weighted percentage, never peer records.
    !manager && actor.teamId
      ? db.quotation.groupBy({
          by: ["currency"],
          where: {
            AND: [
              reportQuotationWhere(
                { ...actor, role: "SALES_MANAGER" },
                { ...filters, ownerId: undefined, teamId: actor.teamId },
              ),
              {
                owner: { teamId: actor.teamId },
                createdAt: { gte: period.from, lt: period.to },
              },
            ],
          },
          _sum: { subtotalMinor: true, discountMinor: true },
        })
      : Promise.resolve([]),
    manager
      ? db.dealHealthAlert.findMany({
          where: {
            OR: [{ quotation: scope }, { order: { quotation: scope } }],
            flaggedAt: { gte: period.from, lt: period.to },
          },
          select: { flaggedAt: true },
        })
      : Promise.resolve([]),
  ]);
  const charts: AnalyticsChart[] = [];
  const submissionReasons = [
    "SUBMIT",
    "PROPOSAL_APPLIED",
    "PROPOSALS_AUTO_APPLIED",
  ];
  charts.push({
    id: "milestones",
    title: "Pipeline milestone funnel",
    question:
      "How many quotations created in this period have reached each milestone? Later milestones imply earlier ones; revisions do not erase prior progress.",
    kind: "funnel",
    dimension: "Milestone reached",
    unit: "Quotations",
    series: [{ key: "value", label: "Quotations" }],
    rows: pipelineMilestones(
      quotes.map((q) => ({
        submitted:
          q.versions.some((v) => submissionReasons.includes(v.reason)) ||
          q.approvals.length > 0,
        approved:
          q.approvedVersion !== null ||
          q.approvals.some((a) => a.status === "APPROVED") ||
          q.versions.some(
            (v) =>
              submissionReasons.includes(v.reason) && v.requiredLevel === 0,
          ),
        sent: q.sentAt !== null,
        confirmed: q.confirmedAt !== null || q.status === "CONFIRMED",
      })),
    ),
  });
  const statusOrder = [
    "DRAFT",
    "PENDING_APPROVAL",
    "REVISION_REQUESTED",
    "APPROVED",
    "SENT",
    "UNDER_NEGOTIATION",
    "CONFIRMED",
    "REJECTED",
    "EXPIRED",
    "CANCELLED",
  ];
  charts.push({
    id: "pipeline",
    title: "Pipeline by current stage",
    question:
      "Where are quotations created in this period today? Stages are exclusive, not a historical funnel.",
    kind: "horizontal",
    dimension: "Stage",
    unit: "Quotations",
    series: [{ key: "value", label: "Quotations" }],
    rows: statusOrder.map((label) => ({
      label: label.replaceAll("_", " "),
      value: quotes.filter((q) => q.status === label).length,
    })),
  });
  const months = [...new Set(quotes.map((q) => month(q.createdAt)))].sort();
  charts.push({
    id: "conversion",
    title: "Conversion by creation month",
    question: "What share of each creation cohort is confirmed today?",
    kind: "line",
    dimension: "Creation month (UTC)",
    unit: "% confirmed",
    series: [{ key: "value", label: "Conversion" }],
    rows: months.map((label) => {
      const cohort = quotes.filter((q) => month(q.createdAt) === label);
      return {
        label,
        value: percentage(
          cohort.filter((q) => q.status === "CONFIRMED").length,
          cohort.length,
        ),
      };
    }),
  });
  const upsold = quotes.filter((q) => q.lines.some((l) => l.addedFromUpsell));
  charts.push({
    id: "upsell",
    title: "Quotations with an upsell",
    question:
      "How many quotations containing an added upsell have been confirmed? This is quote conversion, not recommendation acceptance.",
    kind: "donut",
    dimension: "Current outcome",
    unit: "Quotations",
    series: [{ key: "value", label: "Quotations" }],
    rows: [
      {
        label: "Confirmed",
        value: upsold.filter((q) => q.status === "CONFIRMED").length,
      },
      {
        label: "Not confirmed",
        value: upsold.filter((q) => q.status !== "CONFIRMED").length,
      },
    ],
  });
  for (const currency of [...new Set(quotes.map((q) => q.currency))].sort()) {
    const currencyQuotes = quotes.filter((q) => q.currency === currency);
    const teamBenchmark = benchmark.find((b) => b.currency === currency);
    const reps = discountByRep(
      currencyQuotes.map((q) => ({
        ownerId: q.ownerId,
        grossMinor: q.subtotalMinor,
        discountMinor: q.discountMinor,
      })),
    );
    charts.push({
      id: `discount-${currency}`,
      reference:
        teamBenchmark && (teamBenchmark._sum.subtotalMinor ?? 0) > 0
          ? {
              label: "Team weighted average",
              value: percentage(
                teamBenchmark._sum.discountMinor ?? 0,
                teamBenchmark._sum.subtotalMinor ?? 0,
              ),
            }
          : undefined,
      title: `Value-weighted discounts · ${currency}`,
      question: "How much discount was given relative to gross quoted value?",
      kind: "horizontal",
      dimension: "Owner",
      unit: "% of gross",
      series: [{ key: "value", label: "Discount" }],
      rows: reps.map((r) => ({
        label: currencyQuotes.find((q) => q.ownerId === r.ownerId)!.owner.name,
        value: r.discountBp / 100,
      })),
    });
    if (manager) {
      charts.push({
        id: `leaderboard-${currency}`,
        title: `Confirmed quotation value · ${currency}`,
        question:
          "Which owners have the most confirmed quotation value in this creation cohort? This is not invoiced revenue.",
        kind: "horizontal",
        dimension: "Owner",
        unit: currency,
        series: [{ key: "value", label: "Confirmed value" }],
        rows: reps
          .map((r) => ({
            label: currencyQuotes.find((q) => q.ownerId === r.ownerId)!.owner
              .name,
            value:
              currencyQuotes
                .filter(
                  (q) => q.ownerId === r.ownerId && q.status === "CONFIRMED",
                )
                .reduce((sum, q) => sum + q.totalMinor, 0) / 100,
          }))
          .sort((a, b) => b.value - a.value),
      });
      charts.push({
        id: `scatter-${currency}`,
        title: `Discount and one-time margin · ${currency}`,
        question:
          "How does discount percentage relate to the margin on one-time items? Flagged anomalies are labelled.",
        kind: "scatter",
        dimension: "Discount (%)",
        unit: "One-time margin (%)",
        series: [
          { key: "discount", label: "Discount (%)" },
          { key: "margin", label: "One-time margin (%)" },
        ],
        rows: currencyQuotes
          .filter((q) => q.oneTimeNetMinor > 0)
          .map((q) => ({
            label: `${q.number}${alerts.some((a) => a.quotationId === q.id && a.type === "DISCOUNT_ANOMALY") ? " · anomaly" : ""}`,
            discount: percentage(q.discountMinor, q.subtotalMinor),
            margin: percentage(q.oneTimeMarginMinor, q.oneTimeNetMinor),
          })),
      });
    }
  }
  if (manager) {
    charts.push({
      id: "alerts-calendar",
      title: "Alerts by week and weekday",
      question:
        "When were alerts flagged? Darker cells mean more alerts; rows show weeks with activity, and blank cells mean zero. Includes alerts resolved since then.",
      kind: "heatmap",
      dimension: "Date (UTC)",
      unit: "Alerts",
      series: [{ key: "value", label: "Alerts" }],
      rows: alertHeatmap(flagged.map((a) => a.flaggedAt)),
    });
    const statuses = [
      "WAITING",
      "PENDING",
      "APPROVED",
      "RETURNED",
      "REJECTED",
      "SUPERSEDED",
    ];
    charts.push({
      id: "bottleneck",
      title: "Approval workload",
      question:
        "Where are approval steps waiting or decided for requests created in this period?",
      kind: "bar",
      stacked: true,
      dimension: "Approval role",
      unit: "Steps",
      series: statuses.map((key) => ({ key, label: key.toLowerCase() })),
      rows: ["SALES_MANAGER", "FINANCE"].map((label) => ({
        label,
        ...Object.fromEntries(
          statuses.map((status) => [
            status,
            requests
              .flatMap((r) => r.steps)
              .filter((s) => s.role === label && s.status === status).length,
          ]),
        ),
      })),
    });
    const completed = requests.flatMap((r) =>
      r.steps.flatMap((s, i) => {
        const start = i === 0 ? r.createdAt : r.steps[i - 1].decidedAt;
        return start &&
          s.decidedAt &&
          s.decidedAt >= start &&
          ["APPROVED", "REJECTED", "RETURNED"].includes(s.status)
          ? [
              {
                label: month(s.decidedAt),
                hours: (s.decidedAt.getTime() - start.getTime()) / 3600000,
              },
            ]
          : [];
      }),
    );
    charts.push({
      id: "approval-time",
      title: "Approval turnaround",
      question:
        "How long did completed steps take after becoming eligible? Only requests created in the selected period are included.",
      kind: "line",
      dimension: "Decision month (UTC)",
      unit: "Hours",
      series: [{ key: "value", label: "Average hours" }],
      rows: [...new Set(completed.map((s) => s.label))].sort().map((label) => {
        const rows = completed.filter((s) => s.label === label);
        return {
          label,
          value: rows.reduce((sum, r) => sum + r.hours, 0) / rows.length,
        };
      }),
    });
    const bands = [
      { label: "0", min: 0, max: 1 },
      { label: "0–5", min: 1, max: 501 },
      { label: "5–10", min: 501, max: 1001 },
      { label: "10–20", min: 1001, max: 2001 },
      { label: "20+", min: 2001, max: Infinity },
    ];
    charts.push({
      id: "risk",
      title: "Worst line discount excess",
      question:
        "How far above the applicable line limit is each quotation’s largest discount excess?",
      kind: "bar",
      dimension: "Percentage points above limit",
      unit: "Quotations",
      series: [{ key: "value", label: "Quotations" }],
      rows: bands.map((b) => ({
        label: b.label,
        value: quotes.filter((q) => {
          const excess = Math.max(0, ...q.lines.map((l) => l.excessBp));
          return excess >= b.min && excess < b.max;
        }).length,
      })),
    });
    const levels = [0, 1, 2];
    charts.push({
      id: "policy",
      title: "Approval routes by policy version",
      question: "How were requests routed under each recorded policy version?",
      kind: "bar",
      dimension: "Policy version ID",
      unit: "Requests",
      series: levels.map((l) => ({ key: `level${l}`, label: `Level ${l}` })),
      rows: seriesRows(
        Object.fromEntries(
          levels.map((l) => [
            `level${l}`,
            requests
              .filter((r) => r.requiredLevel === l)
              .map((r) => ({ label: r.policyVersionId, value: 1 })),
          ]),
        ),
      ),
    });
  }
  return charts;
}
