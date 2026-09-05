import { listInvoices } from "@/server/queries/invoices";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { FiltersBar } from "@/components/filters/filters-bar";
import { SearchInput } from "@/components/filters/search-input";
import { SelectFilter } from "@/components/filters/select-filter";
import { StatusBadge } from "@/components/layout/status-badge";
import { Money } from "@/components/layout/money";
import { Receipt } from "@/components/icons";

export const metadata = { title: "Invoices · DealFlow360" };

type Row = Awaited<ReturnType<typeof listInvoices>>["rows"][number];

export default async function InvoicesPage({
  searchParams,
}: PageProps<"/invoices">) {
  const sp = await searchParams;
  const { rows, total, page, pageSize, pageCount } = await listInvoices(sp);

  const columns: Column<Row>[] = [
    { key: "number", header: "Invoice", sortable: true, cell: (i) => i.number },
    { key: "customer", header: "Customer", cell: (i) => i.customer.name },
    {
      key: "type",
      header: "Type",
      cell: (i) => (
        <span className="text-muted-foreground">
          {i.type.replaceAll("_", " ").toLowerCase()}
        </span>
      ),
    },
    {
      key: "totalMinor",
      header: "Total",
      sortable: true,
      align: "right",
      cell: (i) => <Money minor={i.totalMinor} currency={i.currency} />,
    },
    {
      key: "balanceMinor",
      header: "Balance",
      sortable: true,
      align: "right",
      cell: (i) => (
        <Money
          minor={i.balanceMinor}
          currency={i.currency}
          className={i.balanceMinor > 0 ? "font-medium" : "text-muted-foreground"}
        />
      ),
    },
    {
      key: "paymentStatus",
      header: "Payment",
      sortable: true,
      cell: (i) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge value={i.paymentStatus} />
          {i.isOverdue ? <StatusBadge value="OVERDUE" /> : null}
        </div>
      ),
    },
    {
      key: "dueAt",
      header: "Due",
      sortable: true,
      align: "right",
      cell: (i) => (
        <span className="tabular text-muted-foreground">
          {i.dueAt.toISOString().slice(0, 10)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Goods on dispatch, services on completion, subscriptions at period start."
      />

      <FiltersBar>
        <SearchInput placeholder="Search invoice or customer…" />
        <SelectFilter
          param="type"
          label="Type"
          width="w-[160px]"
          options={[
            { value: "ONE_TIME", label: "One-time" },
            { value: "SERVICE", label: "Service" },
            { value: "RECURRING", label: "Recurring" },
            { value: "PRORATION", label: "Proration" },
          ]}
        />
        <SelectFilter
          param="payment"
          label="Payment"
          width="w-[160px]"
          options={[
            { value: "unpaid", label: "Unpaid" },
            { value: "partial", label: "Partially paid" },
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
        caption="Invoices"
        getRowKey={(i) => i.id}
        getRowHref={(i) => `/invoices/${i.id}`}
        empty={{
          title: "No invoices match these filters",
          description:
            "Complete an eligible fulfillment or subscription billing event to raise one.",
          icon: <Receipt className="size-5" weight="duotone" />,
        }}
      />
    </>
  );
}
