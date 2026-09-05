import Link from "next/link";
import { listFulfillment } from "@/server/queries/fulfillment";
import { PageHeader } from "@/components/layout/page-header";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
export default async function FulfillmentPage() {
  const rows = await listFulfillment();
  return (
    <>
      <PageHeader
        title="Fulfillment"
        description="Reserve stock, dispatch goods and record completed services."
      />
      <Table>
        <TableHeader>
          <TableRow>
            {[
              "Order",
              "Customer",
              "Fulfillment",
              "Lines",
              "Promised delivery",
            ].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((o) => (
            <TableRow key={o.id}>
              <TableCell>
                <Link
                  href={`/fulfillment/${o.id}`}
                  className="underline font-medium"
                >
                  {o.number}
                </Link>
              </TableCell>
              <TableCell>{o.customer.name}</TableCell>
              <TableCell>{o.fulfillmentStatus.replaceAll("_", " ")}</TableCell>
              <TableCell>{o.lines.length}</TableCell>
              <TableCell>
                {o.promisedDeliveryDate?.toISOString().slice(0, 10) ??
                  "Not set"}
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={5}>
                No orders yet. Orders appear after the customer accepts a
                policy-cleared quotation.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
