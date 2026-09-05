import { notFound } from "next/navigation";
import { NotFound } from "@/domain/errors";
import { PageHeader } from "@/components/layout/page-header";
import { portalActor, getMyInvoice } from "@/server/queries/portal";
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
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await portalActor();
  const invoice = await getMyInvoice(actor, id).catch((error) => {
    if (error instanceof NotFound) notFound();
    throw error;
  });
  const payment = derivePaymentStatus(invoice, new Date());
  return (
    <>
      <PageHeader
        title={invoice.number}
        description={`Due ${invoice.dueAt.toLocaleDateString()} · ${invoice.status === "VOID" ? "Void" : formatMinor(payment.balanceMinor, invoice.currency) + " remaining"}`}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Net</TableHead>
            <TableHead>Tax</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoice.lines.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{l.description}</TableCell>
              <TableCell>{l.qty}</TableCell>
              <TableCell>
                {formatMinor(l.amountMinor, invoice.currency)}
              </TableCell>
              <TableCell>{formatMinor(l.taxMinor, invoice.currency)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="font-semibold">
        Total: {formatMinor(invoice.totalMinor, invoice.currency)}
      </p>
      <section className="space-y-3">
        <h2 className="font-semibold">Credits applied</h2>
        {invoice.creditApplications.map((c) => (
          <p key={c.id}>
            {c.creditNote.number} ·{" "}
            {formatMinor(c.amountMinor, invoice.currency)}
          </p>
        ))}
        {!invoice.creditApplications.length && (
          <p className="text-sm text-muted-foreground">No credits applied.</p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Payments</h2>
        {invoice.payments.map((p) => (
          <p key={p.id}>
            {p.paidAt.toLocaleDateString()} ·{" "}
            {p.method.toLowerCase().replaceAll("_", " ")} ·{" "}
            {formatMinor(p.amountMinor, invoice.currency)}
          </p>
        ))}
        {!invoice.payments.length && (
          <p className="text-sm text-muted-foreground">No payments recorded.</p>
        )}
      </section>
    </>
  );
}
