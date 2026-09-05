import { PageHeader } from "@/components/layout/page-header";
import { KpiTile } from "@/components/layout/kpi-tile";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/server/db";
import { requireInternal } from "@/server/auth/guards";
import { FileText, Users, Package, Envelope } from "@/components/icons";

export const metadata = { title: "Dashboard · DealFlow360" };

export default async function DashboardPage() {
  const user = await requireInternal();

  const [quotations, customers, products, queuedEmails, pendingUsers] = await Promise.all([
    prisma.quotation.count(),
    prisma.customer.count({ where: { isActive: true } }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.emailMessage.count({ where: { status: "QUEUED" } }),
    prisma.user.count({ where: { role: "PENDING" } }),
  ]);

  return (
    <>
      <PageHeader
        title={`Welcome, ${(user.name ?? "there").split(" ")[0]}`}
        description="Quotation, approval, fulfillment and billing activity across the workspace."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Quotations" value={quotations} icon={<FileText className="size-5" weight="duotone" />} />
        <KpiTile label="Active customers" value={customers} icon={<Users className="size-5" weight="duotone" />} />
        <KpiTile label="Active products" value={products} icon={<Package className="size-5" weight="duotone" />} />
        <KpiTile
          label="Queued emails"
          value={queuedEmails}
          tone={queuedEmails > 0 ? "warning" : "default"}
          icon={<Envelope className="size-5" weight="duotone" />}
        />
      </div>

      {pendingUsers > 0 ? (
        <Card className="border-warning/40 bg-warning/8 shadow-none">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="font-medium">
                {pendingUsers} account{pendingUsers === 1 ? "" : "s"} waiting for a role
              </p>
              <p className="text-muted-foreground text-sm">
                New signups cannot sign in until an admin assigns their role.
              </p>
            </div>
            <a href="/admin/users?role=PENDING" className="text-primary-700 text-sm font-medium hover:underline">
              Review in Admin →
            </a>
          </CardContent>
        </Card>
      ) : null}

      <Card className="shadow-none">
        <CardContent className="text-muted-foreground p-6 text-sm">
          Quotation pipeline, approval queue and deal-health widgets arrive with phases 04–10. The
          catalogue, customers, warehouses and stock are already live under Admin.
        </CardContent>
      </Card>
    </>
  );
}
