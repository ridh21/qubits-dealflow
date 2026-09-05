import { PageHeader } from "@/components/layout/page-header";
import { KpiTile } from "@/components/layout/kpi-tile";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { FiltersBar } from "@/components/filters/filters-bar";
import { SearchInput } from "@/components/filters/search-input";
import { SelectFilter } from "@/components/filters/select-filter";
import { StatusBadge } from "@/components/layout/status-badge";
import { Money, Percent } from "@/components/layout/money";
import { listProducts } from "@/server/queries/admin";
import { requireInternal } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { Package } from "@/components/icons";
import { ProductFormDialog } from "./_components/product-form-dialog";
import { ratioBp } from "@/domain/money/money";

export const metadata = { title: "Products · Admin" };

type Row = Awaited<ReturnType<typeof listProducts>>["rows"][number];

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const user = await requireInternal();
  const sp = await searchParams;
  const { rows, total, page, pageSize, pageCount } = await listProducts(sp);

  const [categories, activeCount, archivedCount, priceListCount] = await Promise.all([
    prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.product.count({ where: { status: "ARCHIVED" } }),
    prisma.priceList.count({ where: { isActive: true } }),
  ]);
  const canManage = user.role === "ADMIN";

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Product",
      sortable: true,
      cell: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-muted-foreground text-xs">{r.sku}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      cell: (r) => <span className="text-muted-foreground">{r.category.name}</span>,
    },
    { key: "type", header: "Type", cell: (r) => <StatusBadge value={r.type} /> },
    {
      key: "basePriceMinor",
      header: "List price",
      sortable: true,
      align: "right",
      cell: (r) => <Money minor={r.basePriceMinor} />,
    },
    {
      key: "cost",
      header: "Cost",
      align: "right",
      cell: (r) => <Money minor={r.costPriceMinor} className="text-muted-foreground" />,
    },
    {
      key: "margin",
      header: "Margin",
      align: "right",
      cell: (r) => (
        <Percent bp={ratioBp(r.basePriceMinor - r.costPriceMinor, r.basePriceMinor)} />
      ),
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge value={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Products"
        description="Cost and tax here drive quotation margin, approval risk and invoice totals."
        actions={canManage ? <ProductFormDialog categories={categories} /> : null}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Active products" value={activeCount} icon={<Package className="size-5" weight="duotone" />} />
        <KpiTile label="Archived" value={archivedCount} />
        <KpiTile label="Categories" value={categories.length} />
        <KpiTile label="Price lists" value={priceListCount} />
      </div>

      <FiltersBar>
        <SearchInput placeholder="Search name or SKU…" />
        <SelectFilter
          param="categoryId"
          label="Category"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <SelectFilter
          param="type"
          label="Type"
          width="w-[160px]"
          options={[
            { value: "PHYSICAL", label: "Physical" },
            { value: "SERVICE", label: "Service" },
            { value: "SUBSCRIPTION", label: "Subscription" },
          ]}
        />
        <SelectFilter
          param="status"
          label="Status"
          width="w-[150px]"
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "ARCHIVED", label: "Archived" },
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
        getRowHref={(r) => `/admin/products/${r.id}`}
        empty={{
          title: "No products match these filters",
          description: "Add a product so reps can quote it.",
          icon: <Package className="size-8" weight="duotone" />,
        }}
      />
    </>
  );
}
