import Link from "next/link";
import { listQuotations } from "@/server/queries/quotations";
import type { SearchParamsRecord } from "@/server/list";
import { quotationListHref } from "@/domain/quotation/list-params";
import { PageHeader } from "@/components/layout/page-header";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/data-table";
import { Pagination } from "@/components/data-table/pagination";
import { Columns, ListChecks, Plus } from "@/components/icons";
import { formatMinor } from "@/domain/money/money";
import { QuotationListFilters } from "./_components/quotation-list-filters";
import { QuotationListBoard } from "./_components/quotation-list-board";

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const sp = await searchParams;
  const p = await listQuotations(sp);
  return (
    <>
      <PageHeader
        title="Quotations"
        description="Build terms, track reviews and follow customer decisions."
      />
      <WorkspaceActions>
        {p.actor.role !== "FINANCE" && (
          <Button asChild>
            <Link href="/quotations/new">
              <Plus className="size-4" />
              New quotation
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link
            href={quotationListHref(sp, {
              view: p.view === "table" ? "board" : "table",
              page: "1",
            })}
          >
            {p.view === "table" ? (
              <Columns className="size-4" />
            ) : (
              <ListChecks className="size-4" />
            )}
            {p.view === "table" ? "Pipeline view" : "Table view"}
          </Link>
        </Button>
      </WorkspaceActions>
      <QuotationListFilters
        key={quotationListHref(sp)}
        raw={sp}
        params={p.params}
        options={p.options}
      />
      {!!p.params.issues.length && (
        <div
          role="alert"
          className="rounded-xl border border-destructive p-4 text-sm text-destructive"
        >
          No results are shown until these filters are corrected:{" "}
          {p.params.issues.join(" ")}
        </div>
      )}
      {p.view === "board" ? (
        <>
          <QuotationListBoard rows={p.rows} />
          <Pagination {...p} />
        </>
      ) : (
        <>
          <DataTable
            {...p}
            getRowKey={(q) => q.id}
            getRowHref={(q) => `/quotations/${q.id}`}
            empty={{
              title: "No quotations match",
              description:
                "Adjust or clear the filters, or create a quotation.",
            }}
            columns={[
              {
                key: "number",
                header: "Quotation",
                sortable: true,
                cell: (q) => `${q.number} · v${q.version}`,
              },
              {
                key: "customer",
                header: "Customer",
                sortable: true,
                cell: (q) => q.customer.name,
              },
              {
                key: "owner",
                header: "Owner",
                sortable: true,
                cell: (q) => q.owner.name,
              },
              {
                key: "status",
                header: "Status",
                sortable: true,
                cell: (q) => (
                  <Badge variant="outline">
                    {q.status.replaceAll("_", " ")}
                  </Badge>
                ),
              },
              {
                key: "riskBand",
                header: "Risk",
                sortable: true,
                cell: (q) => q.riskBand.toLowerCase(),
              },
              {
                key: "totalMinor",
                header: "Initial total",
                sortable: true,
                align: "right",
                cell: (q) => formatMinor(q.totalMinor, q.currency),
              },
              {
                key: "oneTimeNetMinor",
                header: "One-time net",
                sortable: true,
                align: "right",
                cell: (q) => formatMinor(q.oneTimeNetMinor, q.currency),
              },
              {
                key: "createdAt",
                header: "Created (UTC)",
                sortable: true,
                cell: (q) => q.createdAt.toISOString().slice(0, 10),
              },
              {
                key: "updatedAt",
                header: "Updated (UTC)",
                sortable: true,
                cell: (q) => q.updatedAt.toISOString().slice(0, 10),
              },
            ]}
          />
          {!p.rows.length && <Pagination {...p} />}
        </>
      )}
    </>
  );
}
