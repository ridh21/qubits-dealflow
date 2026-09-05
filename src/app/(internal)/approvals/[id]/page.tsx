import Link from "next/link";
import { getApproval } from "@/server/queries/approvals";
import { PageHeader } from "@/components/layout/page-header";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { DecisionControls } from "../_components/decision-controls";
import type { RiskBucket } from "@/domain/risk/evaluate";
export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const {
      actor,
      request: r,
      policy,
      audits,
    } = await getApproval((await params).id),
    step = r.steps.find((s) => s.status === "PENDING");
  const disabledReason =
    actor.id === r.quotation.ownerId
      ? "You cannot approve your own quotation."
      : r.quotationVersion !== r.quotation.version
        ? "This version has been superseded."
        : !step
          ? "This review is complete."
          : actor.role !== "ADMIN" && actor.role !== step.role
            ? `Waiting for ${step.role.replaceAll("_", " ").toLowerCase()}.`
            : undefined;
  const buckets = r.metrics as unknown as RiskBucket[];
  return (
    <>
      <PageHeader
        title={`Review ${r.quotation.number} · v${r.quotationVersion}`}
        description={`${r.quotation.customer.name} · ${r.riskBand} risk · ${r.status}`}
      />
      <DecisionControls
        stepId={step?.id}
        version={r.quotationVersion}
        disabledReason={disabledReason}
      />
      <div className="flex gap-6 text-sm">
        <Link className="underline" href={`/quotations/${r.quotationId}`}>
          View quotation
        </Link>
        <Link className="underline" href="/admin/policy/history/DISCOUNT_RISK">
          Evaluated under policy v{policy.version}
        </Link>
      </div>
      <section className="rounded-xl border p-5">
        <h2 className="font-semibold mb-4">Reviewer progress</h2>
        <ol className="space-y-3">
          {r.steps.map((s) => (
            <li key={s.id}>
              {s.index + 1}. {s.role.replaceAll("_", " ")} · {s.status}
              {s.note && (
                <p className="text-sm text-muted-foreground">{s.note}</p>
              )}
            </li>
          ))}
        </ol>
      </section>
      <Table containerClassName="rounded-none border-0">
        <TableHeader>
          <TableRow>
            {[
              "Billing bucket",
              "Worst excess",
              "Blended excess",
              "Overall discount",
              "Overall excess",
            ].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {buckets.map((b) => (
            <TableRow key={b.cycle}>
              <TableCell>{b.cycle}</TableCell>
              <TableCell>{b.worstExcessBp / 100} pt</TableCell>
              <TableCell>{b.blendedExcessBp / 100} pt</TableCell>
              <TableCell>{(b.overallDiscountBp ?? 0) / 100}%</TableCell>
              <TableCell>
                {b.overallExcessBp === null
                  ? "Not configured"
                  : `${b.overallExcessBp / 100} pt`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <section className="space-y-3">
        <h2 className="font-semibold">Why this route was selected</h2>
        {buckets.flatMap((b) =>
          b.firedRules.map((rule, i) => (
            <div key={`${b.cycle}-${i}`} className="rounded-lg border p-4">
              <p className="font-medium">
                {b.cycle} · Level {rule.level}: {rule.label}
              </p>
              {rule.reasons.map((reason) => (
                <p key={reason} className="text-sm">
                  {reason}
                </p>
              ))}
            </div>
          )),
        )}
      </section>
      <section>
        <h2 className="font-semibold mb-4">Audit trail</h2>
        {audits.map((a) => (
          <div key={a.id} className="border-b py-3 text-sm">
            <p>
              {a.action.replaceAll("_", " ")} · v{a.version ?? "—"}
            </p>
            <p className="text-muted-foreground">
              {a.createdAt.toISOString().slice(0, 16)} UTC · {a.reason ?? ""}
            </p>
          </div>
        ))}
      </section>
    </>
  );
}
