import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { portalActor, listMyQuotations } from "@/server/queries/portal";
import { formatMinor } from "@/domain/money/money";
export default async function PortalHome({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const filters = await searchParams;
  const data = await listMyQuotations(await portalActor(), filters);
  return (
    <>
      <PageHeader
        title="My quotations"
        description="Review shared offers, request changes, and accept the right version."
      />
      <div className="flex flex-wrap gap-3 text-sm">
        {["", "SENT", "UNDER_NEGOTIATION", "PENDING_APPROVAL", "CONFIRMED"].map(
          (status) => (
            <Link
              key={status}
              className={
                filters.status === status
                  ? "font-semibold text-primary"
                  : "text-muted-foreground"
              }
              href={`/portal?status=${status}`}
            >
              {status ? status.toLowerCase().replaceAll("_", " ") : "All"}
            </Link>
          ),
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quotation</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Valid until</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link
                  className="font-medium text-primary"
                  href={`/portal/quotations/${row.id}`}
                >
                  {row.number} · v{row.version}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {row.status.toLowerCase().replaceAll("_", " ")}
                </Badge>
              </TableCell>
              <TableCell>
                {row.totalMinor === null
                  ? "Being revised"
                  : formatMinor(row.totalMinor, row.currency)}
              </TableCell>
              <TableCell>
                {row.validUntil?.toLocaleDateString() ?? "—"}
              </TableCell>
            </TableRow>
          ))}
          {!data.rows.length && (
            <TableRow>
              <TableCell colSpan={4}>
                Shared quotations will appear here.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <nav aria-label="Quotation pages" className="flex gap-4 text-sm">
        {data.page > 1 && (
          <Link
            href={`/portal?status=${filters.status ?? ""}&page=${data.page - 1}`}
          >
            Previous
          </Link>
        )}
        <span>
          Page {data.page} of {data.pages}
        </span>
        {data.page < data.pages && (
          <Link
            href={`/portal?status=${filters.status ?? ""}&page=${data.page + 1}`}
          >
            Next
          </Link>
        )}
      </nav>
    </>
  );
}
