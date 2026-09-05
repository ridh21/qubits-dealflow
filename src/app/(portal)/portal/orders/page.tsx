import { PageHeader } from "@/components/layout/page-header";
import { portalActor, listMyOrders } from "@/server/queries/portal";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { FiltersBar } from "@/components/filters/filters-bar";
import { SearchInput } from "@/components/filters/search-input";
import { SelectFilter } from "@/components/filters/select-filter";
import { StatusBadge } from "@/components/layout/status-badge";
import { Package } from "@/components/icons";

export const metadata = { title: "My orders · DealFlow360" };

type Row = Awaited<ReturnType<typeof listMyOrders>>["rows"][number];

export default async function OrdersPage({
  searchParams,
}: PageProps<"/portal/orders">) {
  const sp = await searchParams;
  const { rows, total, page, pageSize, pageCount } = await listMyOrders(
    await portalActor(),
    sp,
  );

  const columns: Column<Row>[] = [
    { key: "number", header: "Order", sortable: true, cell: (r) => r.number },
    {
      key: "fulfillmentStatus",
      header: "Fulfillment",
      cell: (r) => <StatusBadge value={r.fulfillmentStatus} />,
    },
    {
      key: "confirmedAt",
      header: "Confirmed",
      sortable: true,
      cell: (r) => (
        <span className="tabular text-muted-foreground">
          {r.confirmedAt.toISOString().slice(0, 10)}
        </span>
      ),
    },
    {
      key: "promisedDeliveryDate",
      header: "Promised delivery",
      align: "right",
      cell: (r) =>
        r.promisedDeliveryDate ? (
          <span className="tabular text-muted-foreground">
            {r.promisedDeliveryDate.toISOString().slice(0, 10)}
          </span>
        ) : (
          <span className="text-muted-foreground">To be confirmed</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="My orders"
        description="Track dispatches, service completion, and billing."
      />

      <FiltersBar>
        <SearchInput placeholder="Search order number…" />
        <SelectFilter
          param="fulfillmentStatus"
          label="Fulfillment"
          width="w-[190px]"
          options={[
            { value: "UNALLOCATED", label: "Unallocated" },
            { value: "RESERVED", label: "Reserved" },
            { value: "PARTIALLY_FULFILLED", label: "Partially fulfilled" },
            { value: "BACKORDERED", label: "Backordered" },
            { value: "FULFILLED", label: "Fulfilled" },
          ]}
        />
      </FiltersBar>

      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        pageCount={pageCount}
        caption="My orders"
        getRowKey={(r) => r.id}
        getRowHref={(r) => `/portal/orders/${r.id}`}
        empty={{
          title: "No orders to show",
          description: "Orders appear here after quotation acceptance and approval.",
          icon: <Package className="size-5" weight="duotone" />,
        }}
      />
    </>
  );
}
