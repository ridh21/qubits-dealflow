import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireInternal } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { Repeat } from "@/components/icons";

export const metadata = { title: "Plans & entitlements · Admin" };

export default async function PlansPage() {
  await requireInternal();
  const products = await prisma.product.findMany({
    where: { type: "SUBSCRIPTION", status: "ACTIVE" },
    orderBy: { name: "asc" },
    include: { _count: { select: { tiers: true, plans: true, entitlementDefs: true } } },
  });

  return (
    <>
      <PageHeader
        title="Plans & entitlements"
        description="Tiers, per-cycle plans and the entitlement matrix for every subscription product."
      />

      <Card className="shadow-none">
        <CardContent className="flex items-start gap-4 p-6">
          <Repeat className="text-primary size-6 shrink-0" weight="duotone" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Arriving in phase 08.</p>
            <p className="text-muted-foreground leading-relaxed">
              Subscription products are already in the catalogue below. Phase 08 adds tiers,
              a plan per billing cycle, the entitlement matrix with tier-level autofill and
              per-cycle overrides, and the change notices emailed to holders.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <Link key={p.id} href={`/admin/products/${p.id}`}>
            <Card className="hover:border-primary/40 h-full shadow-none transition-colors">
              <CardContent className="space-y-1 p-5">
                <p className="font-display text-sm font-semibold">{p.name}</p>
                <p className="text-muted-foreground text-xs">{p.sku}</p>
                <p className="text-muted-foreground text-sm">
                  {p._count.tiers} tiers · {p._count.plans} plans · {p._count.entitlementDefs}{" "}
                  entitlements
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
