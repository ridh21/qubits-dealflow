"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReportData, reportFilterOptions } from "@/server/queries/reports";
import { reportSections, type ReportSection } from "@/server/reports/sections";
import { PageHeader } from "@/components/layout/page-header";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/forms/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { FileText, Check } from "@/components/icons";
import { formatMinor } from "@/domain/money/money";
function ReportTable({ section }: { section: ReportSection }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(section.rows.length / 20));
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{section.title}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            {section.columns.map((c) => (
              <TableHead key={c.key}>{c.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {section.rows.slice((page - 1) * 20, page * 20).map((row, index) => (
            <TableRow key={index}>
              {section.columns.map((c) => (
                <TableCell key={c.key}>
                  {c.money && typeof row[c.key] === "number"
                    ? formatMinor(row[c.key] as number, String(row.currency))
                    : (row[c.key] ?? "—")}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {!section.rows.length && (
            <TableRow>
              <TableCell colSpan={section.columns.length}>
                No matching records.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex items-center gap-3 text-sm">
        <Button
          size="sm"
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <span>
          Page {page} of {pages} · {section.rows.length} records
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </section>
  );
}
export function ReportWorkspace({
  options,
  report,
  error,
  initial,
}: {
  options: Awaited<ReturnType<typeof reportFilterOptions>>;
  report: ReportData | null;
  error: string;
  initial: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const today = new Date();
  const first = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );
  const [filters, setFilters] = useState<Record<string, string>>({
    from: initial.from ?? first.toISOString().slice(0, 10),
    to: initial.to ?? today.toISOString().slice(0, 10),
    ...Object.fromEntries(
      Object.entries(initial).filter(
        (entry): entry is [string, string] => !!entry[1],
      ),
    ),
  });
  const choose = (key: string, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const selects = [
    { key: "teamId", title: "Team", values: options.teams },
    { key: "ownerId", title: "Rep", values: options.owners },
    {
      key: "approvalStatus",
      title: "Approval status",
      values: ["NONE_REQUIRED", "PENDING", "APPROVED", "REJECTED"].map(
        (id) => ({ id, name: id.toLowerCase().replaceAll("_", " ") }),
      ),
    },
    { key: "productId", title: "Product", values: options.products },
    { key: "categoryId", title: "Category", values: options.categories },
    { key: "customerId", title: "Customer", values: options.customers },
    {
      key: "tier",
      title: "Customer tier",
      values: ["BRONZE", "SILVER", "GOLD"].map((id) => ({
        id,
        name: id.toLowerCase(),
      })),
    },
    {
      key: "cycle",
      title: "Billing cycle",
      values: ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"].map((id) => ({
        id,
        name: id.toLowerCase(),
      })),
    },
  ];
  const exportQuery = report
    ? new URLSearchParams(
        Object.entries(report.filters).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ).toString()
    : "";
  return (
    <>
      <WorkspaceActions>
        <Button
          disabled={pending}
          onClick={() =>
            start(() =>
              router.push(
                `/reports?${new URLSearchParams({ ...filters, generated: "1", run: String(Date.now()) })}`,
              ),
            )
          }
        >
          <Check />
          Generate report
        </Button>
        {report && (
          <>
            <Button variant="outline" asChild>
              <a href={`/api/export/report/pdf?${exportQuery}`}>
                <FileText />
                Export PDF
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`/api/export/report/xlsx?${exportQuery}`}>
                <FileText />
                Export XLSX
              </a>
            </Button>
          </>
        )}
      </WorkspaceActions>
      <PageHeader
        title="Reports"
        description="Choose filters, then generate a report. Exports use the filters from the displayed result."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DatePicker
          label="From"
          value={filters.from ? new Date(filters.from) : undefined}
          onChange={(d) => choose("from", d?.toISOString().slice(0, 10) ?? "")}
        />
        <DatePicker
          label="Through"
          value={filters.to ? new Date(filters.to) : undefined}
          onChange={(d) => choose("to", d?.toISOString().slice(0, 10) ?? "")}
        />
        {selects.map((s) => (
          <label key={s.key} className="space-y-2 text-sm">
            <span>{s.title}</span>
            <Select
              value={
                filters[s.key] && filters[s.key] !== "ALL"
                  ? filters[s.key]
                  : "all"
              }
              onValueChange={(v) => choose(s.key, v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {s.values.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!report ? (
        <p className="rounded-xl border p-8 text-muted-foreground">
          Generate a report to view results.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {report.filters.from} through {report.filters.to} · Whole quotations
            matching product filters. Invoice amounts use issue dates. MRR and
            receivables show current balances for matching records; currencies
            are kept separate.
          </p>
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: "Quotations", value: report.summary.total },
              {
                label: "Conversion",
                value: `${(report.summary.rate * 100).toFixed(1)}%`,
              },
              {
                label: "Average approval time",
                value:
                  report.summary.approvalHours.overall === null
                    ? "—"
                    : `${report.summary.approvalHours.overall.toFixed(1)} hours`,
              },
              { label: "Open alerts", value: report.summary.openAlerts },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border p-5">
                <p className="text-sm text-muted-foreground">{k.label}</p>
                <p className="mt-2 text-2xl font-semibold">{k.value}</p>
              </div>
            ))}
          </div>
          {report.currencies.map((c) => (
            <section key={c.currency} className="rounded-xl border p-5">
              <h2 className="font-semibold">{c.currency}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <p>Invoiced: {formatMinor(c.revenueMinor, c.currency)}</p>
                <p>
                  Discount given: {formatMinor(c.discountMinor, c.currency)}
                </p>
                <p>
                  Normalized MRR:{" "}
                  {formatMinor(c.normalisedMrrMinor, c.currency)}
                </p>
              </div>
            </section>
          ))}
          {reportSections(report).map((section) => (
            <ReportTable
              key={`${report.generatedAt.toISOString()}:${section.title}`}
              section={section}
            />
          ))}
        </>
      )}
    </>
  );
}
