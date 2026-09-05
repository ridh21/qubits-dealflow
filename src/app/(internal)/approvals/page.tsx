import Link from "next/link";
import { listApprovals } from "@/server/queries/approvals";
import { PageHeader } from "@/components/layout/page-header";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
export default async function ApprovalsPage() {
  const rows = await listApprovals();
  return (
    <>
      <PageHeader
        title="Approvals"
        description="Sequential reviews, evaluated against a preserved policy version."
      />
      <Table>
        <TableHeader>
          <TableRow>
            {[
              "Quotation",
              "Customer",
              "Risk",
              "Status",
              "Current reviewer",
              "SLA due",
            ].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const current = r.steps.find((s) => s.status === "PENDING");
            return (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    className="underline font-medium"
                    href={`/approvals/${r.id}`}
                  >
                    {r.quotation.number} · v{r.quotationVersion}
                  </Link>
                </TableCell>
                <TableCell>{r.quotation.customer.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{r.riskBand}</Badge>
                </TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell>
                  {current?.role.replaceAll("_", " ") ?? "Complete"}
                </TableCell>
                <TableCell>
                  {current?.dueAt?.toISOString().slice(0, 16) ?? "—"}
                </TableCell>
              </TableRow>
            );
          })}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={6}>
                No reviews yet. Submit a quotation to evaluate its approval
                route.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
