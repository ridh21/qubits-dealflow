import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { portalActor, listMyInvoices } from "@/server/queries/portal";
import { formatMinor } from "@/domain/money/money";
import { derivePaymentStatus } from "@/domain/billing/payment-status";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
export default async function InvoicesPage() {
  const rows = await listMyInvoices(await portalActor());
  return (
    <>
      <PageHeader
        title="My invoices"
        description="Goods are billed on dispatch, services on completion, subscriptions at period start."
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const payment = derivePaymentStatus(row, new Date());
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    className="text-primary"
                    href={`/portal/invoices/${row.id}`}
                  >
                    {row.number}
                  </Link>
                </TableCell>
                <TableCell>{row.dueAt.toLocaleDateString()}</TableCell>
                <TableCell>
                  {row.status === "VOID"
                    ? "Void"
                    : payment.isOverdue
                      ? "Overdue"
                      : payment.paymentStatus
                          .toLowerCase()
                          .replaceAll("_", " ")}
                </TableCell>
                <TableCell>
                  {formatMinor(
                    row.status === "VOID" ? 0 : payment.balanceMinor,
                    row.currency,
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={4}>No invoices yet.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
