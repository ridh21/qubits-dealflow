import { getFulfillment } from "@/server/queries/fulfillment";
import { PageHeader } from "@/components/layout/page-header";
import { OrderWorkspace } from "../_components/order-workspace";
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const data = await getFulfillment((await params).id);
  return (
    <>
      <PageHeader
        title={data.order.number}
        description={`${data.order.customer.name} · ${data.order.fulfillmentStatus.replaceAll("_", " ")}`}
      />
      <OrderWorkspace data={data} />
    </>
  );
}
