import Link from "next/link";
import { notFound } from "next/navigation";
import { NotFound } from "@/domain/errors";
import { PageHeader } from "@/components/layout/page-header";
import { portalActor, getMyOrder } from "@/server/queries/portal";
import { formatMinor } from "@/domain/money/money";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await portalActor();
  const order = await getMyOrder(actor, id).catch((error) => {
    if (error instanceof NotFound) notFound();
    throw error;
  });
  return (
    <>
      <PageHeader
        title={order.number}
        description={`Delivery: ${order.promisedDeliveryDate?.toLocaleDateString() ?? "To be confirmed"}`}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Delivered / completed</TableHead>
            <TableHead>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.lines.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{l.productName}</TableCell>
              <TableCell>{l.qty}</TableCell>
              <TableCell>
                {l.kind === "PHYSICAL"
                  ? `${l.qtyShipped} dispatched`
                  : l.kind === "SERVICE"
                    ? l.completion
                      ? "Completed"
                      : "Awaiting completion"
                    : (l.subscription?.status.toLowerCase() ?? "Scheduled")}
              </TableCell>
              <TableCell>
                {formatMinor(l.netMinor + l.taxMinor, order.currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <section className="space-y-3">
        <h2 className="font-semibold">Shipments</h2>
        {order.shipments.map((s) => (
          <div key={s.id} className="rounded-lg border p-4">
            <p>
              {s.number} · {s.status.toLowerCase()}
            </p>
            {s.lines.map((l, index) => (
              <p key={index} className="text-sm text-muted-foreground">
                {l.qty} × {l.orderLine.productName}
              </p>
            ))}
          </div>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Invoices</h2>
        {order.invoices.map((i) => (
          <p key={i.id}>
            <Link className="text-primary" href={`/portal/invoices/${i.id}`}>
              {i.number} · {formatMinor(i.totalMinor, i.currency)}
            </Link>
          </p>
        ))}
      </section>
    </>
  );
}
