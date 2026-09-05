import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireInternal } from "@/server/auth/guards";
import { ShieldCheck } from "@/components/icons";

export const metadata = { title: "Policy Center · Admin" };

export default async function PolicyCenterPage() {
  await requireInternal();
  return (
    <>
      <PageHeader
        title="Policy Center"
        description="Versioned discount ceilings, risk thresholds, reviewer chains, fulfillment weighting and billing defaults."
      />
      <Card className="shadow-none">
        <CardContent className="flex items-start gap-4 p-6">
          <ShieldCheck className="text-primary size-6 shrink-0" weight="duotone" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Arriving in phase 03.</p>
            <p className="text-muted-foreground leading-relaxed">
              The schema is already in place — <code>PolicyVersion</code> stores each published
              version per policy kind, and approval requests snapshot the version they were
              evaluated against so a pending review never shifts under a reviewer.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
