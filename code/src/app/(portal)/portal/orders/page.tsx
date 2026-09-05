import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { portalActor, listMyOrders } from "@/server/queries/portal";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
export default async function OrdersPage() {
  const rows = await listMyOrders(await portalActor());
  return (
    <>
      <PageHeader
        title="My orders"
        description="Track dispatches, service completion, and billing."
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Fulfillment</TableHead>
            <TableHead>Promised delivery</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link
                  className="text-primary"
                  href={`/portal/orders/${row.id}`}
                >
                  {row.number}
                </Link>
              </TableCell>
              <TableCell>
                {row.fulfillmentStatus.toLowerCase().replaceAll("_", " ")}
              </TableCell>
              <TableCell>
                {row.promisedDeliveryDate?.toLocaleDateString() ??
                  "To be confirmed"}
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={3}>
                Orders appear here after quotation acceptance and approval.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
