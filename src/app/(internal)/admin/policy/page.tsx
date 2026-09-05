import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireInternal } from "@/server/auth/guards";
import { getPolicyOverview } from "@/server/queries/policy";
import {
  POLICY_META,
  PolicyKindZ,
  canPublishPolicy,
} from "@/domain/policy/schemas";
export const metadata = { title: "Policy Center · Admin" };
function summary(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  if ("tierCeilingsBp" in p) {
    const tiers = p.tierCeilingsBp as Record<string, number>;
    return [
      Object.entries(tiers)
        .map(([k, v]) => `${k.toLowerCase()} ${v / 100}%`)
        .join(" · "),
      `Chain: ${(p.reviewerChain as string[]).map((r) => (r === "FINANCE" ? "Finance" : "Sales Manager")).join(" → ")}`,
      `Overall ceiling: ${p.overallCeilingBp === null ? "disabled" : `${Number(p.overallCeilingBp) / 100}%`}`,
    ];
  }
  return Object.entries(p)
    .filter(([, v]) => typeof v !== "object")
    .slice(0, 4)
    .map(
      ([k, v]) =>
        `${k.replace(/([a-z])([A-Z])/g, "$1 $2")}: ${typeof v === "boolean" ? (v ? "enabled" : "disabled") : String(v)}`,
    );
}
export default async function PolicyCenterPage() {
  const [actor, active] = await Promise.all([
    requireInternal(),
    getPolicyOverview(),
  ]);
  return (
    <>
      <PageHeader
        title="Policy Center"
        description="Understand why a quotation is routed, preview changes and preserve every published decision."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_17rem]">
        <div className="grid gap-4 md:grid-cols-2">
          {PolicyKindZ.options.map((kind) => {
            const meta = POLICY_META[kind],
              row = active.find((p) => p.kind === kind);
            return (
              <Card key={kind} id={meta.slug} className="shadow-none">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>{meta.title}</CardTitle>
                    <Badge variant={row ? "secondary" : "outline"}>
                      {row ? `v${row.version}` : "Not configured"}
                    </Badge>
                  </div>
                  <CardDescription>{meta.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {row ? (
                      summary(row.payload).map((s) => <li key={s}>{s}</li>)
                    ) : (
                      <li>
                        Publish an initial policy to enable this workflow.
                        Missing configuration blocks evaluation.
                      </li>
                    )}
                  </ul>
                  {row && (
                    <p className="text-xs text-muted-foreground">
                      Published by {row.publishedByName} ·{" "}
                      <time dateTime={row.publishedAt.toISOString()}>
                        {row.publishedAt
                          .toISOString()
                          .slice(0, 16)
                          .replace("T", " ")}{" "}
                        UTC
                      </time>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm font-medium">
                    <Link
                      className="underline underline-offset-4"
                      href={`/admin/policy/${meta.slug}`}
                    >
                      {canPublishPolicy(actor.role, kind)
                        ? "Edit policy"
                        : "View policy"}
                    </Link>
                    {[
                      "DISCOUNT_RISK",
                      "FULFILLMENT",
                      "RECOMMENDATION",
                    ].includes(kind) && (
                      <Link
                        className="underline underline-offset-4"
                        href={`/admin/policy/${meta.slug}#simulator`}
                      >
                        Simulate
                      </Link>
                    )}
                    <Link
                      className="underline underline-offset-4"
                      href={`/admin/policy/history/${kind}`}
                    >
                      History
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <aside className="h-fit space-y-4 rounded-xl border p-5">
          <h2 className="font-semibold">How a quotation flows</h2>
          <ol className="space-y-3 text-sm">
            {[
              ["Pricing", "discount-risk"],
              ["Metrics", "discount-risk"],
              ["Rules", "discount-risk"],
              ["Route", "discount-risk"],
              ["Review steps", "discount-risk"],
              ["Customer portal", "portal"],
              ["Confirmed order", "fulfillment"],
              ["Warehouse split", "fulfillment"],
              ["Billing", "billing"],
            ].map(([label, slug], i) => (
              <li key={label}>
                <Link
                  className="hover:underline"
                  href={`/admin/policy/${slug}`}
                >
                  {i + 1}. {label}
                </Link>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Pending reviews retain their evaluated policy snapshot. Publishing
            affects new submissions and revisions.
          </p>
        </aside>
      </div>
    </>
  );
}
