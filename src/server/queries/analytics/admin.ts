import type { AnalyticsContext } from "./context";
import { day } from "./context";
import { seriesRows, type AnalyticsChart } from "@/domain/analytics/charts";
export async function adminCharts({
  db,
  period,
}: AnalyticsContext): Promise<AnalyticsChart[]> {
  const [audits, emails, pending] = await Promise.all([
    db.auditLog.findMany({
      where: { createdAt: { gte: period.from, lt: period.to } },
      select: { action: true, createdAt: true },
    }),
    db.emailMessage.findMany({
      where: { createdAt: { gte: period.from, lt: period.to } },
      select: { status: true, createdAt: true, relatedType: true },
    }),
    db.user.count({ where: { role: "PENDING" } }),
  ]);
  return [
    {
      id: "entitlement-notices",
      title: "Entitlement change notices",
      question:
        "How many entitlement change emails were queued each day? Global totals; team filters do not apply.",
      kind: "bar",
      dimension: "Queued day (IST)",
      unit: "Messages",
      series: [{ key: "value", label: "Notices queued" }],
      rows: seriesRows({
        value: emails
          .filter((e) => e.relatedType === "PlanChangeNotice")
          .map((e) => ({ label: day(e.createdAt), value: 1 })),
      }),
    },
    {
      id: "usage",
      title: "Recorded platform activity",
      question:
        "How many audited actions occurred each day? Includes only events written to the audit log; team filters do not apply.",
      kind: "area",
      dimension: "Day (IST)",
      unit: "Audit events",
      series: [{ key: "value", label: "Actions" }],
      rows: seriesRows({
        value: audits.map((a) => ({ label: day(a.createdAt), value: 1 })),
      }),
    },
    {
      id: "pending-users",
      title: "Pending user approvals",
      question:
        "How many users currently await role approval? This is a global current snapshot.",
      kind: "bar",
      dimension: "Account state",
      unit: "Users",
      series: [{ key: "value", label: "Users" }],
      rows: [{ label: "Pending", value: pending }],
    },
    {
      id: "email",
      title: "Email delivery status",
      question:
        "What is the current delivery status of messages queued during this period? Team filters do not apply.",
      kind: "bar",
      stacked: true,
      dimension: "Queued day (IST)",
      unit: "Messages",
      series: ["SENT", "FAILED", "QUEUED"].map((key) => ({
        key,
        label: key.toLowerCase(),
      })),
      rows: seriesRows(
        Object.fromEntries(
          ["SENT", "FAILED", "QUEUED"].map((status) => [
            status,
            emails
              .filter((e) => e.status === status)
              .map((e) => ({ label: day(e.createdAt), value: 1 })),
          ]),
        ),
      ),
    },
  ];
}
