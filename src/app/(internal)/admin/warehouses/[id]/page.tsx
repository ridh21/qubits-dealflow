import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { KpiTile } from "@/components/layout/kpi-tile";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { FiltersBar } from "@/components/filters/filters-bar";
import { SearchInput } from "@/components/filters/search-input";
import { SelectFilter } from "@/components/filters/select-filter";
import { StatusBadge } from "@/components/layout/status-badge";
import { Money } from "@/components/layout/money";
import { prisma } from "@/server/db";
import { requireInternal } from "@/server/auth/guards";
import { listMovements, listStock } from "@/server/queries/admin";
import { Warehouse as WarehouseIcon, Cube } from "@/components/icons";
import { WarehouseFormDialog } from "../_components/warehouse-form-dialog";
import { StockDialogs } from "../_components/stock-dialogs";
import { ReplenishmentTable } from "../_components/replenishment-table";

export const metadata = { title: "Warehouse · Admin" };

type StockRow = Awaited<ReturnType<typeof listStock>>["rows"][number];
type MovementRow = Awaited<ReturnType<typeof listMovements>>["rows"][number];

export default async function WarehouseDetail({
  params,
  searchParams,
}: PageProps<"/admin/warehouses/[id]">) {
  const user = await requireInternal();
  const { id } = await params;
  const sp = await searchParams;

  const warehouse = await prisma.warehouse.findUnique({ where: { id } });
  if (!warehouse) notFound();

  const tab = typeof sp.tab === "string" ? sp.tab : "stock";
  const [stock, movements, products, replenishments] = await Promise.all([
    listStock(id, sp),
    listMovements(id, sp),
    prisma.product.findMany({
      where: { status: "ACTIVE", type: "PHYSICAL" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true },
    }),
    prisma.replenishmentPlan.findMany({
      where: { warehouseId: id },
      orderBy: { eta: "asc" },
      include: { product: { select: { name: true } } },
    }),
  ]);

  const canManage = user.role === "ADMIN" || user.role === "FINANCE";
  const totals = stock.rows.reduce(
    (acc, r) => ({
      onHand: acc.onHand + r.onHand,
      reserved: acc.reserved + r.reserved,
      low: acc.low + (r.available <= r.reorderPoint ? 1 : 0),
    }),
    { onHand: 0, reserved: 0, low: 0 },
  );

  const stockColumns: Column<StockRow>[] = [
    {
      key: "product",
      header: "Product",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.product.name}</p>
          <p className="text-muted-foreground text-xs">{r.product.sku}</p>
        </div>
      ),
    },
    { key: "onHand", header: "On hand", align: "right", cell: (r) => <span className="tabular">{r.onHand}</span> },
    { key: "reserved", header: "Reserved", align: "right", cell: (r) => <span className="tabular">{r.reserved}</span> },
    {
      key: "available",
      header: "Available",
      align: "right",
      cell: (r) => (
        <span className={r.available <= r.reorderPoint ? "tabular text-destructive font-medium" : "tabular font-medium"}>
          {r.available}
        </span>
      ),
    },
    { key: "reorderPoint", header: "Reorder point", align: "right", cell: (r) => <span className="tabular">{r.reorderPoint}</span> },
    {
      key: "nextEta",
      header: "Next ETA",
      cell: (r) => (
        <span className="text-muted-foreground tabular text-xs">
          {r.nextEta ? r.nextEta.toLocaleDateString() : "—"}
        </span>
      ),
    },
  ];

  const movementColumns: Column<MovementRow>[] = [
    {
      key: "createdAt",
      header: "When",
      cell: (r) => <span className="text-muted-foreground tabular text-xs">{r.createdAt.toLocaleString()}</span>,
    },
    { key: "productName", header: "Product", cell: (r) => r.productName },
    { key: "type", header: "Type", cell: (r) => <StatusBadge value={r.type} /> },
    {
      key: "qty",
      header: "Qty",
      align: "right",
      cell: (r) => (
        <span className={r.qty < 0 ? "tabular text-destructive" : "tabular"}>
          {r.qty > 0 ? `+${r.qty}` : r.qty}
        </span>
      ),
    },
    { key: "note", header: "Note", cell: (r) => <span className="text-muted-foreground">{r.note ?? "—"}</span> },
  ];

  return (
    <>
      <PageHeader
        title={warehouse.name}
        description={`${warehouse.code} · priority ${warehouse.priority}`}
        actions={
          <div className="flex items-center gap-2">
            {canManage ? <StockDialogs warehouseId={id} products={products} /> : null}
            {user.role === "ADMIN" ? (
              <WarehouseFormDialog
                warehouse={{
                  id: warehouse.id,
                  name: warehouse.name,
                  code: warehouse.code,
                  perUnit: (warehouse.shippingCostWeightMinor / 100).toFixed(2),
                  fixed: (warehouse.fixedShipmentCostMinor / 100).toFixed(2),
                  priority: String(warehouse.priority),
                }}
              />
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="On hand" value={totals.onHand} icon={<Cube className="size-5" weight="duotone" />} />
        <KpiTile label="Reserved" value={totals.reserved} />
        <KpiTile label="At or below reorder" value={totals.low} tone={totals.low > 0 ? "warning" : "default"} />
        <KpiTile
          label="Shipment cost"
          value={<Money minor={warehouse.fixedShipmentCostMinor} />}
          hint={`plus ${(warehouse.shippingCostWeightMinor / 100).toFixed(2)} per unit`}
        />
      </div>

      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="replenishment">Replenishment</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4 pt-4">
          <FiltersBar>
            <SearchInput placeholder="Search products…" />
            <SelectFilter
              param="below"
              label="Stock level"
              width="w-[190px]"
              options={[{ value: "reorder", label: "At or below reorder" }]}
            />
          </FiltersBar>
          <DataTable
            columns={stockColumns}
            rows={stock.rows}
            total={stock.total}
            page={stock.page}
            pageSize={stock.pageSize}
            pageCount={stock.pageCount}
            getRowKey={(r) => r.id}
            empty={{
              title: "No stock recorded here yet",
              description: "Receive stock to start the ledger for this warehouse.",
              icon: <WarehouseIcon className="size-8" weight="duotone" />,
            }}
          />
        </TabsContent>

        <TabsContent value="replenishment" className="pt-4">
          <ReplenishmentTable
            warehouseId={id}
            canManage={canManage}
            products={products}
            plans={replenishments.map((p) => ({
              id: p.id,
              productName: p.product.name,
              productId: p.productId,
              qty: p.qty,
              eta: p.eta.toISOString(),
              status: p.status,
            }))}
          />
        </TabsContent>

        <TabsContent value="movements" className="space-y-4 pt-4">
          <FiltersBar>
            <SelectFilter
              param="type"
              label="Type"
              width="w-[160px]"
              options={[
                { value: "RECEIPT", label: "Receipt" },
                { value: "RESERVE", label: "Reserve" },
                { value: "RELEASE", label: "Release" },
                { value: "SHIP", label: "Ship" },
                { value: "ADJUST", label: "Adjust" },
              ]}
            />
          </FiltersBar>
          <DataTable
            columns={movementColumns}
            rows={movements.rows}
            total={movements.total}
            page={movements.page}
            pageSize={movements.pageSize}
            pageCount={movements.pageCount}
            getRowKey={(r) => r.id}
            empty={{ title: "No stock movements yet" }}
          />
        </TabsContent>
      </Tabs>

      <Card className="shadow-none">
        <CardContent className="text-muted-foreground p-5 text-sm">
          Reservations and dispatch write to this same ledger from phase 06 — every change to on-hand
          or reserved stock leaves a movement row.
        </CardContent>
      </Card>
    </>
  );
}
