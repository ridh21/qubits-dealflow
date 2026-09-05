import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePortalCustomer } from "@/server/auth/guards";
import { prisma } from "@/server/db";

export const metadata = { title: "My quotations · DealFlow360" };

export default async function PortalHome() {
  const user = await requirePortalCustomer();
  const customer = await prisma.customer.findUnique({
    where: { id: user.customerId },
    select: { name: true, tier: true },
  });

  return (
    <>
      <PageHeader
        title="My quotations"
        description={`${customer?.name ?? "Your company"} · ${customer?.tier.toLowerCase() ?? ""} tier`}
      />
      <Card className="shadow-none">
        <CardContent className="text-muted-foreground p-6 text-sm">
          Quotations shared with you will appear here. Negotiation, acceptance and subscription
          self-service arrive with phase 09.
        </CardContent>
      </Card>
    </>
  );
}
