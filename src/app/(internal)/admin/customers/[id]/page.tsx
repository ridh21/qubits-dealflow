import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/layout/status-badge";
import { Money } from "@/components/layout/money";
import { prisma } from "@/server/db";
import { requireInternal } from "@/server/auth/guards";
import { CustomerFormDialog } from "../_components/customer-form-dialog";
import { InvitePortalUserDialog } from "../_components/invite-portal-user-dialog";
import { CustomerActiveToggle } from "../_components/customer-active-toggle";

export const metadata = { title: "Customer · Admin" };

export default async function CustomerDetail({ params }: PageProps<"/admin/customers/[id]">) {
  const user = await requireInternal();
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      priceList: true,
      users: { where: { role: "CUSTOMER" }, orderBy: { createdAt: "asc" } },
      quotations: { orderBy: { createdAt: "desc" }, take: 5 },
      orders: { orderBy: { confirmedAt: "desc" }, take: 5 },
      invoices: { orderBy: { issuedAt: "desc" }, take: 5 },
    },
  });
  if (!customer) notFound();

  const priceLists = await prisma.priceList.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const canManage = user.role === "ADMIN";

  return (
    <>
      <PageHeader
        title={customer.name}
        description={`${customer.tier.toLowerCase()} tier · ${customer.priceList?.name ?? "Base prices"} · ${customer.currency}`}
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              <CustomerActiveToggle id={customer.id} isActive={customer.isActive} />
              <CustomerFormDialog
                priceLists={priceLists}
                customer={{
                  id: customer.id,
                  name: customer.name,
                  tier: customer.tier,
                  email: customer.email ?? "",
                  billingAddress: customer.billingAddress ?? "",
                  priceListId: customer.priceListId ?? "__none__",
                }}
              />
            </div>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-5 text-sm">
            <Field label="Status" value={<StatusBadge value={customer.isActive ? "ACTIVE" : "INACTIVE"} />} />
            <Field label="Billing email" value={customer.email ?? "—"} />
            <Field label="Billing address" value={customer.billingAddress ?? "—"} />
          </CardContent>
        </Card>

        <Card className="shadow-none lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-sm font-semibold">Portal users</p>
              {canManage ? <InvitePortalUserDialog customerId={customer.id} /> : null}
            </div>
            {customer.users.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No one from this company can sign in to the portal yet.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {customer.users.map((u) => (
                  <li key={u.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-muted-foreground text-xs">{u.email}</p>
                    </div>
                    <StatusBadge value={u.isActive ? "ACTIVE" : "INACTIVE"} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Section title="Recent activity">
        <div className="grid gap-4 lg:grid-cols-3">
          <RecentCard title="Quotations" empty="No quotations yet.">
            {customer.quotations.map((q) => (
              <li key={q.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/quotations/${q.id}`} className="font-medium hover:underline">
                  {q.number}
                </Link>
                <StatusBadge value={q.status} />
              </li>
            ))}
          </RecentCard>

          <RecentCard title="Orders" empty="No orders yet.">
            {customer.orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{o.number}</span>
                <StatusBadge value={o.fulfillmentStatus} />
              </li>
            ))}
          </RecentCard>

          <RecentCard title="Invoices" empty="No invoices yet.">
            {customer.invoices.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{i.number}</span>
                <Money minor={i.totalMinor} currency={i.currency} />
              </li>
            ))}
          </RecentCard>
        </div>
      </Section>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function RecentCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.flat().filter(Boolean).length > 0;

  return (
    <Card className="shadow-none">
      <CardContent className="p-5">
        <p className="font-display mb-2 text-sm font-semibold">{title}</p>
        {hasItems ? (
          <ul className="divide-y">{children}</ul>
        ) : (
          <p className="text-muted-foreground text-sm">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}
