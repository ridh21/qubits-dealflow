import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/layout/status-badge";
import { Percent } from "@/components/layout/money";
import { prisma } from "@/server/db";
import { requireInternal } from "@/server/auth/guards";
import { PriceListFormDialog } from "../_components/price-list-form-dialog";
import { PriceListItemsEditor } from "../_components/price-list-items-editor";

export const metadata = { title: "Price list · Admin" };

export default async function PriceListDetail({ params }: PageProps<"/admin/price-lists/[id]">) {
  const user = await requireInternal();
  const { id } = await params;

  const list = await prisma.priceList.findUnique({
    where: { id },
    include: {
      items: { include: { product: true }, orderBy: { product: { name: "asc" } } },
      customers: { select: { id: true, name: true, tier: true } },
    },
  });
  if (!list) notFound();

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, sku: true, basePriceMinor: true },
  });
  const canManage = user.role === "ADMIN";

  return (
    <>
      <PageHeader
        title={list.name}
        description={`${list.currency} · version ${list.version} · ${list.customers.length} customer${list.customers.length === 1 ? "" : "s"}`}
        actions={
          canManage ? (
            <PriceListFormDialog
              list={{
                id: list.id,
                name: list.name,
                currency: list.currency,
                tier: list.tier ?? "__any__",
                rule: list.rule,
                percentOff: (list.percentOffBp / 100).toString(),
              }}
            />
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Rule</span>
              <StatusBadge value={list.rule} />
            </div>
            {list.rule === "PERCENT_OFF_BASE" ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Discount</span>
                <Percent bp={list.percentOffBp} />
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tier</span>
              {list.tier ? <StatusBadge value={list.tier} /> : <span>Any</span>}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none lg:col-span-2">
          <CardContent className="p-5">
            <p className="font-display mb-2 text-sm font-semibold">Customers on this list</p>
            {list.customers.length === 0 ? (
              <p className="text-muted-foreground text-sm">No customers assigned yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {list.customers.map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/customers/${c.id}`}
                    className="hover:border-primary/40 rounded-md border px-3 py-1.5 text-sm transition-colors"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PriceListItemsEditor
        priceListId={list.id}
        canManage={canManage}
        products={products}
        items={list.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.product.name,
          sku: i.product.sku,
          priceMinor: i.priceMinor,
          basePriceMinor: i.product.basePriceMinor,
        }))}
      />
    </>
  );
}
