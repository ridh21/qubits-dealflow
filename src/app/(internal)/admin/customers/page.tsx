import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { FiltersBar } from "@/components/filters/filters-bar";
import { SearchInput } from "@/components/filters/search-input";
import { SelectFilter } from "@/components/filters/select-filter";
import { StatusBadge } from "@/components/layout/status-badge";
import { listCustomers } from "@/server/queries/admin";
import { requireInternal } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { Buildings } from "@/components/icons";
import { CustomerFormDialog } from "./_components/customer-form-dialog";

export const metadata = { title: "Customers · Admin" };

type Row = Awaited<ReturnType<typeof listCustomers>>["rows"][number];

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const user = await requireInternal();
  const sp = await searchParams;
  const { rows, total, page, pageSize, pageCount } = await listCustomers(sp);
  const priceLists = await prisma.priceList.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const canManage = user.role === "ADMIN";

  const columns: Column<Row>[] = [
    { key: "name", header: "Customer", sortable: true, cell: (r) => r.name },
    { key: "tier", header: "Tier", sortable: true, cell: (r) => <StatusBadge value={r.tier} /> },
    {
      key: "priceList",
      header: "Price list",
      cell: (r) => <span className="text-muted-foreground">{r.priceList?.name ?? "Standard"}</span>,
    },
    {
      key: "portalUsers",
      header: "Portal users",
      align: "right",
      cell: (r) => <span className="tabular">{r._count.users}</span>,
    },
    {
      key: "quotations",
      header: "Quotes",
      align: "right",
      cell: (r) => <span className="tabular">{r._count.quotations}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge value={r.isActive ? "ACTIVE" : "INACTIVE"} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        description="Tier and price list decide the starting price on every quotation line."
        actions={canManage ? <CustomerFormDialog priceLists={priceLists} /> : null}
      />

      <FiltersBar>
        <SearchInput placeholder="Search customers…" />
        <SelectFilter
          param="tier"
          label="Tier"
          width="w-[140px]"
          options={[
            { value: "BRONZE", label: "Bronze" },
            { value: "SILVER", label: "Silver" },
            { value: "GOLD", label: "Gold" },
          ]}
        />
        <SelectFilter
          param="priceListId"
          label="Price list"
          options={priceLists.map((p) => ({ value: p.id, label: p.name }))}
        />
        <SelectFilter
          param="status"
          label="Status"
          width="w-[150px]"
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
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
        getRowKey={(r) => r.id}
        getRowHref={(r) => `/admin/customers/${r.id}`}
        empty={{
          title: "No customers match these filters",
          description: "Add a customer to start quoting.",
          icon: <Buildings className="size-8" weight="duotone" />,
        }}
      />
    </>
  );
}
