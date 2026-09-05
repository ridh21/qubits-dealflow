"use client";
import { useState, useTransition } from "react";
import type { PolicyPayload } from "@/domain/policy/schemas";
import {
  simulateDiscountRisk,
  type SimInput,
  type SimResult,
} from "@/domain/risk/evaluate";
import {
  listPolicyQuotesAction,
  loadRiskSampleAction,
  simulateFulfillmentAction,
  previewRecommendationsAction,
} from "@/server/actions/policy";
import { NumberField, ChoiceField, ToggleField } from "./fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { formatMinor } from "@/domain/money/money";
export function QuotePicker({ onSelect }: { onSelect: (id: string) => void }) {
  const [query, setQuery] = useState(""),
    [quotes, setQuotes] = useState<{ id: string; number: string }[]>([]),
    [pending, start] = useTransition(),
    [error, setError] = useState("");
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          aria-label="Search quotation number"
          placeholder="Quotation number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await listPolicyQuotesAction(query);
              if (result.ok) {
                setQuotes(result.data);
                setError(
                  result.data.length
                    ? ""
                    : "No quotations found in your scope.",
                );
              } else setError(result.error.message);
            })
          }
        >
          {pending ? "Searching…" : "Find quotation"}
        </Button>
      </div>
      {quotes.length > 0 && (
        <ChoiceField
          label="Load quotation"
          value=""
          options={quotes.map((q) => ({ value: q.id, label: q.number }))}
          onChange={onSelect}
        />
      )}
      <p role="status" className="text-sm">
        {error}
      </p>
    </div>
  );
}
const pct = (v: number | null) =>
  v === null ? "N/A" : `${(v / 100).toFixed(2)}%`;
function RiskResult({ result, title }: { result: SimResult; title: string }) {
  return (
    <div className="min-w-0 space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="font-medium">
        Level {result.requiredLevel} ·{" "}
        {result.route.length
          ? result.route
              .map((r) => (r === "FINANCE" ? "Finance" : "Sales Manager"))
              .join(" → ")
          : "No approval required"}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Line</TableHead>
            <TableHead>Effective</TableHead>
            <TableHead>Limit</TableHead>
            <TableHead>Excess</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.lines.map((l, i) => (
            <TableRow key={l.id}>
              <TableCell>{i + 1}</TableCell>
              <TableCell>{pct(l.effectiveDiscountBp)}</TableCell>
              <TableCell>{pct(l.limitBp)}</TableCell>
              <TableCell>{pct(l.excessBp)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {result.buckets.map((b) => (
        <div key={b.cycle} className="space-y-2 text-sm">
          <p className="font-medium">
            {b.cycle} · Level {b.requiredLevel}
          </p>
          <p>
            Worst: {pct(b.worstExcessBp)} · Blended: {pct(b.blendedExcessBp)} ·
            Overall discount: {pct(b.overallDiscountBp)} · Overall excess:{" "}
            {pct(b.overallExcessBp)}
          </p>
          {b.firedRules.map((r, i) => (
            <p key={i}>
              {r.label}: {r.reasons.join(" ")}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
export function RiskSimulator({
  draft,
  active,
  categories,
}: {
  draft: PolicyPayload<"DISCOUNT_RISK">;
  active: PolicyPayload<"DISCOUNT_RISK"> | null;
  categories: { id: string; name: string }[];
}) {
  const [sample, setSample] = useState<SimInput>({
    tier: "GOLD",
    orderDiscountBp: 0,
    lines: [
      {
        id: "sample-1",
        categoryId: categories[0]?.id ?? "",
        baseMinor: 10000,
        discountBp: 1200,
        cycle: "ONE_TIME",
      },
    ],
  });
  const [compare, setCompare] = useState(true),
    [result, setResult] = useState<{
      draft: SimResult;
      active?: SimResult;
      activeError?: string;
    } | null>(null),
    [error, setError] = useState(""),
    [pending, start] = useTransition();
  const update = (s: SimInput) => {
    setSample(s);
    setResult(null);
  };
  return (
    <section
      id="simulator"
      className="space-y-5 rounded-xl border bg-muted/20 p-5"
    >
      <h2 className="font-semibold">Try this draft</h2>
      <p className="text-sm text-muted-foreground">
        Load a quotation or enter ad-hoc line totals. Base is quantity ×
        resolved unit price, before discounts and tax. Results use both line and
        order discounts.
      </p>
      <QuotePicker
        onSelect={(id) =>
          start(async () => {
            const r = await loadRiskSampleAction(id);
            if (r.ok) {
              update(r.data);
              setError("");
            } else setError(r.error.message);
          })
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ChoiceField
          label="Customer tier"
          value={sample.tier}
          options={["BRONZE", "SILVER", "GOLD"].map((v) => ({
            value: v as SimInput["tier"],
            label: v,
          }))}
          onChange={(v) => update({ ...sample, tier: v })}
        />
        <NumberField
          label="Order discount (%)"
          bp
          value={sample.orderDiscountBp}
          onChange={(v) => update({ ...sample, orderDiscountBp: v })}
        />
      </div>
      {sample.lines.map((l, i) => {
        const change = (patch: Partial<typeof l>) =>
          update({
            ...sample,
            lines: sample.lines.map((l, j) =>
              j === i ? { ...l, ...patch } : l,
            ),
          });
        return (
          <div
            key={l.id}
            className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            <ChoiceField
              label={`Line ${i + 1} category`}
              value={l.categoryId}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              onChange={(v) => change({ categoryId: v })}
            />
            <NumberField
              label="Base (minor units)"
              value={l.baseMinor}
              onChange={(v) => change({ baseMinor: v })}
            />
            <NumberField
              label="Line discount (%)"
              bp
              value={l.discountBp}
              onChange={(v) => change({ discountBp: v })}
            />
            <ChoiceField
              label="Billing cycle"
              value={l.cycle}
              options={[
                "ONE_TIME",
                "WEEKLY",
                "MONTHLY",
                "QUARTERLY",
                "YEARLY",
              ].map((v) => ({
                value: v as typeof l.cycle,
                label: v.replaceAll("_", " "),
              }))}
              onChange={(v) => change({ cycle: v })}
            />
            <Button
              type="button"
              variant="ghost"
              disabled={sample.lines.length === 1}
              onClick={() =>
                update({
                  ...sample,
                  lines: sample.lines.filter((_, j) => i !== j),
                })
              }
            >
              Remove line
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          update({
            ...sample,
            lines: [
              ...sample.lines,
              {
                id: crypto.randomUUID(),
                categoryId: categories[0]?.id ?? "",
                baseMinor: 10000,
                discountBp: 0,
                cycle: "ONE_TIME",
              },
            ],
          })
        }
      >
        Add sample line
      </Button>
      <ToggleField
        label="Compare with active policy"
        value={compare}
        onChange={setCompare}
      />
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          try {
            const draftResult = simulateDiscountRisk(draft, sample);
            let activeResult: SimResult | undefined,
              activeError: string | undefined;
            if (compare && active) {
              try {
                activeResult = simulateDiscountRisk(active, sample);
              } catch (e) {
                activeError =
                  e instanceof Error
                    ? e.message
                    : "Active policy cannot evaluate this sample.";
              }
            }
            setResult({
              draft: draftResult,
              active: activeResult,
              activeError,
            });
            setError("");
          } catch (e) {
            setResult(null);
            setError(e instanceof Error ? e.message : "Check sample inputs.");
          }
        }}
      >
        Evaluate sample
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {result && (
        <div className="grid gap-4 xl:grid-cols-2">
          <RiskResult title="Draft policy" result={result.draft} />
          {compare && result.active && (
            <RiskResult title="Active policy" result={result.active} />
          )}{" "}
          {compare && result.activeError && (
            <p role="alert">Active policy: {result.activeError}</p>
          )}
        </div>
      )}
    </section>
  );
}
type FulfillmentResult = Extract<
  Awaited<ReturnType<typeof simulateFulfillmentAction>>,
  { ok: true }
>["data"];
type Suggestions = Extract<
  Awaited<ReturnType<typeof previewRecommendationsAction>>,
  { ok: true }
>["data"];
export function OperationalSimulator({
  kind,
  draft,
  active,
}: {
  kind: "FULFILLMENT" | "RECOMMENDATION";
  draft: unknown;
  active: unknown;
}) {
  const [id, setId] = useState(""),
    [pending, start] = useTransition(),
    [error, setError] = useState("");
  const [plans, setPlans] = useState<
      { title: string; result: FulfillmentResult }[]
    >([]),
    [suggestions, setSuggestions] = useState<
      { title: string; result: Suggestions }[]
    >([]);
  return (
    <section
      id="simulator"
      className="space-y-4 rounded-xl border bg-muted/20 p-5"
    >
      <h2 className="font-semibold">Compare draft with active</h2>
      <p className="text-sm text-muted-foreground">
        {kind === "FULFILLMENT"
          ? "Read-only greedy allocation: maximize quantity, then minimize weighted shipping and shipment penalties. This does not guarantee a globally cheapest split or reserve stock."
          : "Suggestions use the selected customer’s resolved price, current availability, promotion and margin rules. Adding a product must still rerun discount governance."}
      </p>
      <QuotePicker
        onSelect={(v) => {
          setId(v);
          setPlans([]);
          setSuggestions([]);
        }}
      />
      {id && <p className="text-sm">Quotation selected.</p>}
      <Button
        type="button"
        disabled={!id || pending}
        onClick={() =>
          start(async () => {
            setError("");
            setPlans([]);
            setSuggestions([]);
            const versions = [
              { title: "Draft", payload: draft },
              ...(active ? [{ title: "Active", payload: active }] : []),
            ];
            for (const v of versions) {
              if (kind === "FULFILLMENT") {
                const r = await simulateFulfillmentAction(v.payload, id);
                if (r.ok)
                  setPlans((p) => [...p, { title: v.title, result: r.data }]);
                else setError((e) => `${e} ${v.title}: ${r.error.message}`);
              } else {
                const r = await previewRecommendationsAction(v.payload, id);
                if (r.ok)
                  setSuggestions((p) => [
                    ...p,
                    { title: v.title, result: r.data },
                  ]);
                else setError((e) => `${e} ${v.title}: ${r.error.message}`);
              }
            }
          })
        }
      >
        {pending ? "Evaluating…" : "Run comparison"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((p) => (
          <div key={p.title} className="space-y-3 rounded-lg border p-4">
            <h3 className="font-semibold">
              {p.title} · Objective cost: {p.result.objectiveCostMinor} minor
              units
            </h3>
            {p.result.shipments.map((s) => (
              <p key={s.warehouseId} className="text-sm">
                {s.code}: {s.allocations.reduce((n, l) => n + l.qty, 0)} units ·
                weighted cost {s.costMinor}
              </p>
            ))}
            <p className="text-sm">
              Backordered units:{" "}
              {p.result.backorders.reduce((n, l) => n + l.qty, 0)}
            </p>
          </div>
        ))}
        {suggestions.map((s) => (
          <div key={s.title} className="space-y-3 rounded-lg border p-4">
            <h3 className="font-semibold">{s.title}</h3>
            {!s.result.length && <p>No eligible suggestions.</p>}
            {s.result.map((p) => (
              <p key={p.productId} className="text-sm">
                {p.name} · score {p.score} · price {formatMinor(p.priceMinor)} ·
                incremental margin {formatMinor(p.marginMinor)}
                {p.promotionBp ? ` · Promotion ${pct(p.promotionBp)}` : ""}
              </p>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
