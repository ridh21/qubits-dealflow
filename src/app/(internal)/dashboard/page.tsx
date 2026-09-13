import Link from "next/link";
import {
  CheckCircle,
  Clock,
  FileText,
  Receipt,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import {
  getDashboard,
  OPEN_QUOTATION_STATUSES,
} from "@/server/queries/dashboard";
import { PageHeader, Section } from "@/components/layout/page-header";
import { KpiTile } from "@/components/layout/kpi-tile";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import { Money } from "@/components/layout/money";
import { formatDateTimeIST, formatDateIST } from "@/lib/datetime-ist";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardActions } from "@/components/layout/dashboard-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Dashboard · DealFlow360" };

const stageLabels: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  REVISION_REQUESTED: "Revision requested",
  APPROVED: "Approved",
  SENT: "Sent",
  UNDER_NEGOTIATION: "Under negotiation",
};

export default async function DashboardPage() {
  const data = await getDashboard();
  const isRep = data.actor.role === "SALES_REP";
  const scopeLabel = isRep
    ? "Your deals"
    : data.actor.role === "SALES_MANAGER"
      ? "Your deals and your team's deals"
      : "All workspace deals";
  return (
    <>
      <PageHeader
        title={`Welcome, ${data.actor.name?.trim().split(/\s+/)[0] || "there"}`}
        description={`${scopeLabel}. Review what needs attention and keep work moving.`}
      />
      <WorkspaceActions>
        <DashboardActions role={data.actor.role} />
      </WorkspaceActions>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Pending approvals"
          value={data.pendingApprovals}
          hint={
            isRep
              ? "Your quotations awaiting a reviewer"
              : "Current review steps you can decide; excludes your own deals"
          }
          tone={data.pendingApprovals > 0 ? "warning" : "default"}
          icon={
            <CheckCircle
              className="size-5"
              weight="duotone"
              aria-hidden="true"
            />
          }
        />
        <KpiTile
          label="Open quotations"
          value={data.openQuotations}
          hint="Draft through negotiation, including requested revisions"
          icon={
            <FileText className="size-5" weight="duotone" aria-hidden="true" />
          }
        />
        <KpiTile
          label="At-risk deals"
          value={data.atRisk}
          hint="Distinct deals with unresolved quotation or delivery alerts"
          tone={data.atRisk > 0 ? "warning" : "default"}
          icon={
            <Warning className="size-5" weight="duotone" aria-hidden="true" />
          }
        />
        <KpiTile
          label="Unpaid invoices"
          value={data.unpaidCount}
          hint={`${data.overdueCount} overdue · includes partially paid invoices`}
          tone={data.overdueCount > 0 ? "warning" : "default"}
          icon={
            <Receipt className="size-5" weight="duotone" aria-hidden="true" />
          }
        />
      </div>

      {data.pendingUsers !== null && data.pendingUsers > 0 && (
        <Card className="border-warning/40 bg-warning/8 shadow-none">
          <CardContent>
            <p className="font-medium">
              {data.pendingUsers} account{data.pendingUsers === 1 ? "" : "s"}{" "}
              awaiting a role
            </p>
            <p className="text-muted-foreground text-sm">
              Use Review accounts in Actions to assign access to new signups.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-8 xl:grid-cols-2">
        <div className="min-w-0 space-y-8">
          <Section
            title="Unpaid and overdue balances"
            description="Issued invoices after payments and applied credits. Overdue balances are part of unpaid balances."
          >
            {data.invoiceBalances.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Unpaid</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.invoiceBalances.map((row) => (
                    <TableRow key={row.currency}>
                      <TableCell className="font-medium">
                        {row.currency}
                      </TableCell>
                      <TableCell className="text-right">
                        <Money
                          minor={row.unpaidMinor}
                          currency={row.currency}
                        />
                        <span className="text-muted-foreground block text-xs">
                          {row.unpaidCount} invoices
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Money
                          minor={row.overdueMinor}
                          currency={row.currency}
                        />
                        <span className="text-muted-foreground block text-xs">
                          {row.overdueCount} invoices
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">
                No outstanding issued invoices in your scope.
              </p>
            )}
          </Section>

          {data.revenue !== null && (
            <Section
              title="Revenue this month"
              description={`Gross invoiced revenue, ${formatDateIST(data.monthStart)} to today (IST). Includes tax; excludes draft and void invoices. Credits are not deducted.`}
            >
              {data.revenue.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {data.revenue.map((row) => (
                    <KpiTile
                      key={row.currency}
                      label={`${row.currency} invoiced`}
                      value={
                        <Money minor={row.totalMinor} currency={row.currency} />
                      }
                      hint="Month to date · separate currency total"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No invoices issued this month.
                </p>
              )}
            </Section>
          )}

          {data.pipeline !== null && (
            <Section
              title="My pipeline"
              description="Open quotation totals, including tax. Each stage and currency is shown separately."
            >
              {data.pipeline.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stage</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead className="text-right">Quotes</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {OPEN_QUOTATION_STATUSES.flatMap((status) =>
                      data
                        .pipeline!.filter((row) => row.status === status)
                        .map((row) => (
                          <TableRow key={`${row.status}-${row.currency}`}>
                            <TableCell>
                              <Link
                                href={`/quotations?status=${row.status}`}
                                className="font-medium underline underline-offset-4"
                              >
                                {stageLabels[row.status]}
                              </Link>
                            </TableCell>
                            <TableCell>{row.currency}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.count}
                            </TableCell>
                            <TableCell className="text-right">
                              <Money
                                minor={row.totalMinor}
                                currency={row.currency}
                              />
                            </TableCell>
                          </TableRow>
                        )),
                    )}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Your pipeline is empty. Use New quotation in Actions to start
                  a deal.
                </p>
              )}
            </Section>
          )}
        </div>

        <Section
          title="Recent activity"
          description="Latest 12 events in your scope. Times shown in IST."
        >
          {data.activity.length ? (
            <ol className="divide-y rounded-xl border px-4">
              {data.activity.map((item) => (
                <li key={item.id} className="flex gap-3 py-4">
                  <Clock
                    className="text-muted-foreground mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm">{item.sentence}</p>
                    <time
                      className="text-muted-foreground text-xs"
                      dateTime={item.createdAt.toISOString()}
                    >
                      {formatDateTimeIST(item.createdAt)}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground text-sm">
              No activity in your scope yet. Updates appear as your deals
              progress.
            </p>
          )}
        </Section>
      </div>
    </>
  );
}
