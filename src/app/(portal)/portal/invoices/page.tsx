import { PageHeader } from "@/components/layout/page-header";
import { portalActor, listMyInvoices } from "@/server/queries/portal";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { FiltersBar } from "@/components/filters/filters-bar";
import { SearchInput } from "@/components/filters/search-input";
import { SelectFilter } from "@/components/filters/select-filter";
import { StatusBadge } from "@/components/layout/status-badge";
import { Money } from "@/components/layout/money";
import { Receipt } from "@/components/icons";

export const metadata = { title: "My invoices · DealFlow360" };

type Row = Awaited<ReturnType<typeof listMyInvoices>>["rows"][number];

export default async function InvoicesPage({
  searchParams,
}: PageProps<"/portal/invoices">) {
  const sp = await searchParams;
  const { rows, total, page, pageSize, pageCount } = await listMyInvoices(
    await portalActor(),
    sp,
  );

  const isOverdue = (row: Row) =>
    row.status !== "VOID" && row.balanceMinor > 0 && row.dueAt < new Date();

  const columns: Column<Row>[] = [
    { key: "number", header: "Invoice", sortable: true, cell: (r) => r.number },
    {
      key: "issuedAt",
      header: "Issued",
      sortable: true,
      cell: (r) => (
        <span className="tabular text-muted-foreground">
          {r.issuedAt.toISOString().slice(0, 10)}
        </span>
      ),
    },
    {
      key: "dueAt",
      header: "Due",
      sortable: true,
      cell: (r) => (
        <span
          className={
            isOverdue(r) ? "tabular text-destructive font-medium" : "tabular text-muted-foreground"
          }
        >
          {r.dueAt.toISOString().slice(0, 10)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) =>
        r.status === "VOID" ? (
          <StatusBadge value="VOID" />
        ) : (
          <div className="flex items-center gap-1.5">
            <StatusBadge value={r.paymentStatus} />
            {isOverdue(r) ? <StatusBadge value="OVERDUE" /> : null}
          </div>
        ),
    },
    {
      key: "balanceMinor",
      header: "Balance",
      sortable: true,
      align: "right",
      cell: (r) => (
        <Money
          minor={r.status === "VOID" ? 0 : r.balanceMinor}
          currency={r.currency}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="My invoices"
        description="Goods are billed on dispatch, services on completion, subscriptions at period start."
      />

      <FiltersBar>
        <SearchInput placeholder="Search invoice number…" />
        <SelectFilter
          param="payment"
          label="Payment"
          width="w-[170px]"
          options={[
            { value: "outstanding", label: "Outstanding" },
            { value: "paid", label: "Paid" },
            { value: "overdue", label: "Overdue" },
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
        caption="My invoices"
        getRowKey={(r) => r.id}
        getRowHref={(r) => `/portal/invoices/${r.id}`}
        empty={{
          title: "No invoices to show",
          description: "Invoices appear here once an order is dispatched or billed.",
          icon: <Receipt className="size-5" weight="duotone" />,
        }}
      />
    </>
  );
}
