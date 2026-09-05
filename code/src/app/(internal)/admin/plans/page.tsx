import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Repeat, ArrowRight } from "@/components/icons";
import { listPlanProducts } from "@/server/queries/plans";
export const metadata = { title: "Plans & entitlements · Admin" };
export default async function PlansPage() {
  const products = await listPlanProducts();
  return (
    <>
      <PageHeader
        title="Plans & entitlements"
        description="Set tier prices for every billing cycle. Publish entitlement changes with a notice to each affected holder."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <Link key={p.id} href={`/admin/plans/${p.id}`}>
            <Card className="h-full shadow-none transition-colors hover:border-primary/50">
              <CardContent className="space-y-4 p-5">
                <Repeat className="size-6 text-primary" weight="duotone" />
                <div>
                  <h2 className="font-display font-semibold">{p.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {p.sku} · {p.status.toLowerCase()}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {p._count.tiers} tiers · {p._count.plans} cycle plans ·{" "}
                  {p._count.entitlementDefs} entitlements
                </p>
                <span className="flex items-center gap-2 text-sm font-medium">
                  Manage plans <ArrowRight />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {!products.length && (
        <Card>
          <CardContent className="p-6 text-sm">
            Create a subscription product in the product catalogue to configure
            its plans.
          </CardContent>
        </Card>
      )}
    </>
  );
}
