import { listFulfillment } from "@/server/queries/fulfillment";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { FiltersBar } from "@/components/filters/filters-bar";
import { SearchInput } from "@/components/filters/search-input";
import { SelectFilter } from "@/components/filters/select-filter";
import { StatusBadge } from "@/components/layout/status-badge";
import { Truck } from "@/components/icons";

export const metadata = { title: "Fulfillment · DealFlow360" };

type Row = Awaited<ReturnType<typeof listFulfillment>>["rows"][number];

export default async function FulfillmentPage({
  searchParams,
}: PageProps<"/fulfillment">) {
  const sp = await searchParams;
  const { rows, total, page, pageSize, pageCount } = await listFulfillment(sp);

  const columns: Column<Row>[] = [
    { key: "number", header: "Order", sortable: true, cell: (o) => o.number },
    {
      key: "quotation",
      header: "From quotation",
      cell: (o) => (
        <span className="text-muted-foreground">{o.quotation.number}</span>
      ),
    },
    { key: "customer", header: "Customer", cell: (o) => o.customer.name },
    {
      key: "fulfillmentStatus",
      header: "Fulfillment",
      sortable: true,
      cell: (o) => <StatusBadge value={o.fulfillmentStatus} />,
    },
    {
      key: "status",
      // Was also headed "Order", which read as a duplicate of the number column.
      header: "Order status",
      cell: (o) => <StatusBadge value={o.status} />,
    },
    {
      key: "lines",
      header: "Lines",
      align: "right",
      cell: (o) => <span className="tabular">{o.lines.length}</span>,
    },
    {
      key: "promisedDeliveryDate",
      header: "Promised delivery",
      sortable: true,
      align: "right",
      cell: (o) =>
        o.promisedDeliveryDate ? (
          <span className="tabular text-muted-foreground">
            {o.promisedDeliveryDate.toISOString().slice(0, 10)}
          </span>
        ) : (
          <span className="text-muted-foreground">Not set</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Fulfillment"
        description="Reserve stock, dispatch goods and record completed services."
      />

      <FiltersBar>
        <SearchInput placeholder="Search order, quotation or customer…" />
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
        <SelectFilter
          param="status"
          label="Order status"
          width="w-[160px]"
          options={[
            { value: "OPEN", label: "Open" },
            { value: "COMPLETED", label: "Completed" },
            { value: "CANCELLED", label: "Cancelled" },
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
        caption="Orders awaiting fulfillment"
        getRowKey={(o) => o.id}
        getRowHref={(o) => `/fulfillment/${o.id}`}
        empty={{
          title: "No orders match these filters",
          description:
            "Orders appear once a customer accepts a policy-cleared quotation.",
          icon: <Truck className="size-5" weight="duotone" />,
        }}
      />
    </>
  );
}
