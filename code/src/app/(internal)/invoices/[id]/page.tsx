import { getInvoice } from "@/server/queries/invoices";
import { PageHeader } from "@/components/layout/page-header";
import { formatMinor } from "@/domain/money/money";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { RecordPayment } from "../_components/record-payment";
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { actor, invoice: i } = await getInvoice((await params).id);
  return (
    <>
      <PageHeader
        title={i.number}
        description={`${i.customer.name} · ${i.type} · ${i.paymentStatus.replaceAll("_", " ")}`}
      />
      {["ADMIN", "FINANCE"].includes(actor.role) && i.status === "ISSUED" && (
        <RecordPayment invoiceId={i.id} balance={i.balanceMinor} />
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Invoice total", i.totalMinor],
          ["Payments", i.paidMinor],
          ["Balance due", i.balanceMinor],
        ].map(([label, value]) => (
          <div className="rounded-xl border p-5" key={label}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-display mt-2 text-2xl">
              {formatMinor(Number(value), i.currency)}
            </p>
          </div>
        ))}
      </div>
      <p className="text-sm">
        Issued {i.issuedAt.toISOString().slice(0, 10)} · Due{" "}
        {i.dueAt.toISOString().slice(0, 10)}
        {i.isOverdue ? " · Overdue" : ""}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            {["Description", "Quantity", "Net", "Tax"].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {i.lines.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{l.description}</TableCell>
              <TableCell>{l.qty}</TableCell>
              <TableCell>{formatMinor(l.amountMinor, i.currency)}</TableCell>
              <TableCell>{formatMinor(l.taxMinor, i.currency)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <section className="space-y-3">
        <h2 className="font-semibold">Payments</h2>
        {i.payments.map((p) => (
          <p key={p.id}>
            {p.paidAt.toISOString().slice(0, 10)} ·{" "}
            {formatMinor(p.amountMinor, i.currency)} · {p.method} ·{" "}
            {p.reference}
          </p>
        ))}
        {!i.payments.length && (
          <p className="text-sm text-muted-foreground">No payments recorded.</p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Credits applied</h2>
        {i.creditApplications.map((c) => (
          <p key={c.id}>
            {c.creditNote.number} · {formatMinor(c.amountMinor, i.currency)} ·{" "}
            {c.creditNote.reason}
          </p>
        ))}
      </section>
    </>
  );
}
