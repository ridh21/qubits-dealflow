import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { KpiTile } from "@/components/layout/kpi-tile";
import { Card, CardContent } from "@/components/ui/card";
import { adminOverviewCounts } from "@/server/queries/admin";
import { Users, Buildings, Package, Tag, Warehouse, Envelope } from "@/components/icons";

export const metadata = { title: "Admin · DealFlow360" };

const SHORTCUTS = [
  { href: "/admin/users", title: "Users & roles", body: "Approve signups and assign roles and teams." },
  { href: "/admin/customers", title: "Customers", body: "Tiers, price lists and portal invitations." },
  { href: "/admin/products", title: "Products", body: "Catalogue, variants, cost, tax and margin floors." },
  { href: "/admin/price-lists", title: "Price lists", body: "Versioned list pricing per tier or customer." },
  { href: "/admin/warehouses", title: "Warehouses", body: "Stock ledger, reorder points and replenishment ETAs." },
  { href: "/admin/emails", title: "Email outbox", body: "Everything the system has queued or sent." },
];

export default async function AdminOverview() {
  const c = await adminOverviewCounts();

  return (
    <>
      <PageHeader
        title="Admin"
        description="Everything the quotation, approval, fulfillment and billing engines read from."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Pending approvals"
          value={c.pendingUsers}
          hint={`${c.users} accounts in total`}
          tone={c.pendingUsers > 0 ? "warning" : "default"}
          icon={<Users className="size-5" weight="duotone" />}
        />
        <KpiTile label="Active customers" value={c.customers} icon={<Buildings className="size-5" weight="duotone" />} />
        <KpiTile
          label="Active products"
          value={c.products}
          hint={`${c.priceLists} price lists`}
          icon={<Package className="size-5" weight="duotone" />}
        />
        <KpiTile
          label="Stock at or below reorder"
          value={c.lowStock}
          hint={`${c.warehouses} active warehouses`}
          tone={c.lowStock > 0 ? "warning" : "default"}
          icon={<Warehouse className="size-5" weight="duotone" />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SHORTCUTS.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <Card className="hover:border-primary/40 h-full shadow-none transition-colors">
              <CardContent className="space-y-1.5 p-5">
                <p className="font-display group-hover:text-primary-700 text-sm font-semibold transition-colors">
                  {s.title}
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.body}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {c.queuedEmails > 0 ? (
        <Card className="border-warning/40 bg-warning/8 shadow-none">
          <CardContent className="flex items-center gap-3 p-5 text-sm">
            <Envelope className="size-5" weight="duotone" />
            <span>
              {c.queuedEmails} email{c.queuedEmails === 1 ? "" : "s"} waiting in the outbox.
            </span>
            <Link href="/admin/emails" className="text-primary-700 ml-auto font-medium hover:underline">
              Open outbox →
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card className="shadow-none">
        <CardContent className="text-muted-foreground p-5 text-sm">
          <Tag className="mr-2 inline size-4" weight="duotone" />
          Policy Center (phase 03) and Plans &amp; entitlements (phase 08) plug into this sub-nav
          once those phases land.
        </CardContent>
      </Card>
    </>
  );
}
