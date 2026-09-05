import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/layout/status-badge";
import { Money, Percent } from "@/components/layout/money";
import { prisma } from "@/server/db";
import { requireInternal } from "@/server/auth/guards";
import { ratioBp } from "@/domain/money/money";
import { resolveUnitPrice } from "@/domain/pricing/resolve-price";
import { ProductFormDialog } from "../_components/product-form-dialog";
import { VariantsEditor } from "../_components/variants-editor";
import { ProductStatusToggle } from "../_components/product-status-toggle";

export const metadata = { title: "Product · Admin" };

export default async function ProductDetail({ params }: PageProps<"/admin/products/[id]">) {
  const user = await requireInternal();
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      attributes: { include: { values: true }, orderBy: { sortOrder: "asc" } },
      stockLevels: { include: { warehouse: true } },
      priceListItems: { include: { priceList: true } },
    },
  });
  if (!product) notFound();

  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  const priceLists = await prisma.priceList.findMany({
    where: { isActive: true },
    include: { items: { where: { productId: id } } },
    orderBy: { name: "asc" },
  });
  const canManage = user.role === "ADMIN";

  const marginBp = ratioBp(product.basePriceMinor - product.costPriceMinor, product.basePriceMinor);
  const combinations = product.attributes.reduce(
    (acc, a) => acc * Math.max(1, a.values.length),
    product.attributes.length ? 1 : 0,
  );

  return (
    <>
      <PageHeader
        title={product.name}
        description={`${product.sku} · ${product.category.name} · per ${product.unit}`}
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              <ProductStatusToggle id={product.id} status={product.status} />
              <ProductFormDialog
                categories={categories}
                product={{
                  id: product.id,
                  sku: product.sku,
                  name: product.name,
                  description: product.description ?? "",
                  categoryId: product.categoryId,
                  type: product.type,
                  unit: product.unit,
                  basePrice: (product.basePriceMinor / 100).toFixed(2),
                  costPrice: (product.costPriceMinor / 100).toFixed(2),
                  taxPercent: (product.taxBp / 100).toString(),
                  minMarginPercent: (product.minMarginBp / 100).toString(),
                  isPromoted: product.isPromoted,
                }}
              />
            </div>
          ) : null
        }
      />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
          <TabsTrigger value="price-lists">Price lists</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          {product.type === "SUBSCRIPTION" ? <TabsTrigger value="plans">Plans</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="general" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-none">
              <CardContent className="space-y-3 p-5 text-sm">
                <Row label="Type" value={<StatusBadge value={product.type} />} />
                <Row label="Status" value={<StatusBadge value={product.status} />} />
                <Row label="List price" value={<Money minor={product.basePriceMinor} />} />
                <Row label="Cost price" value={<Money minor={product.costPriceMinor} />} />
                <Row label="Margin at list" value={<Percent bp={marginBp} />} />
                <Row label="Tax" value={<Percent bp={product.taxBp} />} />
                <Row label="Minimum margin" value={<Percent bp={product.minMarginBp} />} />
                <Row label="Promoted" value={product.isPromoted ? "Yes" : "No"} />
                <Row label="Variant combinations" value={<span className="tabular">{combinations}</span>} />
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardContent className="p-5 text-sm">
                <p className="font-display mb-2 font-semibold">Description</p>
                <p className="text-muted-foreground leading-relaxed">
                  {product.description ?? "No description yet."}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="variants" className="pt-4">
          <VariantsEditor
            productId={product.id}
            canManage={canManage}
            attributes={product.attributes.map((a) => ({
              name: a.name,
              sortOrder: a.sortOrder,
              values: a.values.map((v) => ({
                value: v.value,
                extraPrice: (v.extraPriceMinor / 100).toFixed(2),
              })),
            }))}
          />
        </TabsContent>

        <TabsContent value="price-lists" className="pt-4">
          <Card className="shadow-none">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Price list</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead className="text-right">Override</TableHead>
                    <TableHead className="text-right">Resolved unit price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priceLists.map((pl) => {
                    const resolved = resolveUnitPrice(
                      { id: product.id, basePriceMinor: product.basePriceMinor },
                      [],
                      {
                        rule: pl.rule,
                        percentOffBp: pl.percentOffBp,
                        items: pl.items.map((i) => ({ productId: i.productId, priceMinor: i.priceMinor })),
                      },
                    );
                    return (
                      <TableRow key={pl.id}>
                        <TableCell>
                          <Link href={`/admin/price-lists/${pl.id}`} className="font-medium hover:underline">
                            {pl.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <StatusBadge value={pl.rule} />
                          {pl.rule === "PERCENT_OFF_BASE" ? (
                            <span className="text-muted-foreground ml-2 text-xs">
                              <Percent bp={pl.percentOffBp} /> off
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          {pl.items[0] ? <Money minor={pl.items[0].priceMinor} /> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <Money minor={resolved} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="pt-4">
          <Card className="shadow-none">
            <CardContent className="p-0">
              {product.type !== "PHYSICAL" ? (
                <p className="text-muted-foreground p-6 text-sm">
                  {product.type === "SERVICE" ? "Services" : "Subscriptions"} never consume stock.
                </p>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Warehouse</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                      <TableHead className="text-right">Reserved</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Reorder point</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {product.stockLevels.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Link href={`/admin/warehouses/${s.warehouseId}`} className="font-medium hover:underline">
                            {s.warehouse.name}
                          </Link>
                        </TableCell>
                        <TableCell className="tabular text-right">{s.onHand}</TableCell>
                        <TableCell className="tabular text-right">{s.reserved}</TableCell>
                        <TableCell className="tabular text-right font-medium">
                          {s.onHand - s.reserved}
                        </TableCell>
                        <TableCell className="tabular text-right">{s.reorderPoint}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {product.type === "SUBSCRIPTION" ? (
          <TabsContent value="plans" className="pt-4">
            <Card className="shadow-none">
              <CardContent className="text-muted-foreground p-6 text-sm">
                Tiers, per-cycle plans and entitlements for this product are configured in{" "}
                <Link href="/admin/plans" className="text-primary-700 font-medium hover:underline">
                  Plans &amp; entitlements
                </Link>{" "}
                (phase 08).
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
