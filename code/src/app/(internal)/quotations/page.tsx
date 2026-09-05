import Link from "next/link";
import { listQuotations } from "@/server/queries/quotations";
import type { SearchParamsRecord } from "@/server/list";
import { PageHeader } from "@/components/layout/page-header";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/data-table/pagination";
import { SearchInput } from "@/components/filters/search-input";
import { SelectFilter } from "@/components/filters/select-filter";
import { formatMinor } from "@/domain/money/money";
const statuses = [
  "DRAFT",
  "PENDING_APPROVAL",
  "REVISION_REQUESTED",
  "APPROVED",
  "SENT",
  "UNDER_NEGOTIATION",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
];
export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const sp = await searchParams,
    p = await listQuotations(sp);
  return (
    <>
      <PageHeader
        title="Quotations"
        description="Build terms, track reviews and follow customer decisions."
      />
      <WorkspaceActions>
        {p.actor.role !== "FINANCE" && (
          <Button asChild>
            <Link href="/quotations/new">New quotation</Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link
            href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")), view: p.view === "table" ? "board" : "table" }).toString()}`}
          >
            {p.view === "table" ? "Pipeline view" : "Table view"}
          </Link>
        </Button>
      </WorkspaceActions>
      <div className="flex flex-wrap gap-3">
        <SearchInput placeholder="Search number or customer" />
        <SelectFilter
          param="status"
          label="Status"
          options={statuses.map((value) => ({
            value,
            label: value.replaceAll("_", " ").toLowerCase(),
          }))}
        />
      </div>
      {p.view === "board" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statuses.slice(0, 7).map((status) => (
            <section
              key={status}
              className="min-w-64 flex-1 rounded-xl bg-muted p-4"
            >
              <h2 className="mb-4 text-sm font-semibold capitalize">
                {status.replaceAll("_", " ").toLowerCase()}
              </h2>
              <div className="space-y-3">
                {p.rows
                  .filter((q) => q.status === status)
                  .map((q) => (
                    <Link
                      key={q.id}
                      href={`/quotations/${q.id}`}
                      className="block space-y-2 rounded-lg border bg-card p-4"
                    >
                      <p className="font-medium">{q.number}</p>
                      <p className="text-sm">{q.customer.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatMinor(q.oneTimeNetMinor, q.currency)} one-time
                        net
                      </p>
                    </Link>
                  ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Quotation",
                  "Customer",
                  "Owner",
                  "Status",
                  "One-time net",
                  "Updated",
                ].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.rows.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>
                    <Link
                      className="font-medium underline"
                      href={`/quotations/${q.id}`}
                    >
                      {q.number} · v{q.version}
                    </Link>
                  </TableCell>
                  <TableCell>{q.customer.name}</TableCell>
                  <TableCell>{q.owner.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {q.status.replaceAll("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatMinor(q.oneTimeNetMinor, q.currency)}
                  </TableCell>
                  <TableCell>
                    {q.updatedAt.toISOString().slice(0, 10)}
                  </TableCell>
                </TableRow>
              ))}
              {!p.rows.length && (
                <TableRow>
                  <TableCell colSpan={6}>
                    No quotations match. Create a quotation or clear the
                    filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination {...p} />
    </>
  );
}
