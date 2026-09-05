import Link from "next/link";
import { listInvoices } from "@/server/queries/invoices";
import { PageHeader } from "@/components/layout/page-header";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { formatMinor } from "@/domain/money/money";
export default async function InvoicesPage() {
  const rows = await listInvoices();
  return (
    <>
      <PageHeader
        title="Invoices"
        description="Goods on dispatch, services on completion, subscriptions at period start."
      />
      <Table>
        <TableHeader>
          <TableRow>
            {[
              "Invoice",
              "Customer",
              "Type",
              "Total",
              "Balance",
              "Payment status",
              "Due",
            ].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((i) => (
            <TableRow key={i.id}>
              <TableCell>
                <Link
                  className="underline font-medium"
                  href={`/invoices/${i.id}`}
                >
                  {i.number}
                </Link>
              </TableCell>
              <TableCell>{i.customer.name}</TableCell>
              <TableCell>{i.type.replaceAll("_", " ")}</TableCell>
              <TableCell>{formatMinor(i.totalMinor, i.currency)}</TableCell>
              <TableCell>{formatMinor(i.balanceMinor, i.currency)}</TableCell>
              <TableCell>
                {i.paymentStatus.replaceAll("_", " ")}
                {i.isOverdue ? " · Overdue" : ""}
              </TableCell>
              <TableCell>{i.dueAt.toISOString().slice(0, 10)}</TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={7}>
                No invoices yet. Complete an eligible fulfillment or
                subscription billing event.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
