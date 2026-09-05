"use client";
import { useState } from "react";
import { type PolicyPayload, ApprovalRoleZ } from "@/domain/policy/schemas";
import { NumberField, ToggleField, ChoiceField } from "./fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
type Policy = PolicyPayload<"DISCOUNT_RISK">;
export function DiscountEditor({
  value: p,
  onChange,
  categories,
}: {
  value: Policy;
  onChange: (p: Policy) => void;
  categories: { id: string; name: string }[];
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const reorder = (from: number, to: number) => {
    const chain = [...p.reviewerChain];
    const [role] = chain.splice(from, 1);
    chain.splice(to, 0, role);
    onChange({ ...p, reviewerChain: chain });
  };
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="font-semibold">Discount ceilings</h2>
        <p className="text-sm text-muted-foreground">
          A line’s limit is the lower of its customer tier and category
          ceilings. Percentages use two decimal places.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {(["BRONZE", "SILVER", "GOLD"] as const).map((t) => (
            <NumberField
              key={t}
              label={`${t[0] + t.slice(1).toLowerCase()} ceiling (%)`}
              bp
              value={p.tierCeilingsBp[t]}
              onChange={(v) =>
                onChange({
                  ...p,
                  tierCeilingsBp: { ...p.tierCeilingsBp, [t]: v },
                })
              }
            />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {categories.map((c) => (
            <NumberField
              key={c.id}
              label={`${c.name} ceiling (%)`}
              bp
              value={p.categoryCeilingsBp[c.id] ?? NaN}
              onChange={(v) =>
                onChange({
                  ...p,
                  categoryCeilingsBp: { ...p.categoryCeilingsBp, [c.id]: v },
                })
              }
            />
          ))}
        </div>
        <ToggleField
          label="Enable an overall discount ceiling"
          value={p.overallCeilingBp !== null}
          onChange={(v) => onChange({ ...p, overallCeilingBp: v ? 0 : null })}
          hint="When disabled, overall-ceiling rule conditions are inactive. Line and blended conditions still apply."
        />
        {p.overallCeilingBp !== null && (
          <NumberField
            label="Overall ceiling (%)"
            bp
            value={p.overallCeilingBp}
            onChange={(v) => onChange({ ...p, overallCeilingBp: v })}
          />
        )}
      </section>
      <section className="space-y-4">
        <h2 className="font-semibold">Reviewer chain & response time</h2>
        <p className="text-sm text-muted-foreground">
          Level N requires the first N reviewers in order. Drag a row or use the
          move buttons.
        </p>
        {p.reviewerChain.map((role, i) => (
          <div
            key={role}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null) reorder(dragIndex, i);
              setDragIndex(null);
            }}
            className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
          >
            <span className="self-center text-sm font-medium">
              {i + 1}. {role === "FINANCE" ? "Finance" : "Sales Manager"}
            </span>
            <div className="w-36">
              <NumberField
                label="SLA (hours)"
                min={1}
                value={p.slaHoursByRole[role]}
                onChange={(v) =>
                  onChange({
                    ...p,
                    slaHoursByRole: { ...p.slaHoursByRole, [role]: v },
                  })
                }
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={i === 0}
              onClick={() => reorder(i, i - 1)}
            >
              Move up
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={i === p.reviewerChain.length - 1}
              onClick={() => reorder(i, i + 1)}
            >
              Move down
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                onChange({
                  ...p,
                  reviewerChain: p.reviewerChain.filter((_, j) => j !== i),
                })
              }
            >
              Remove
            </Button>
          </div>
        ))}
        {ApprovalRoleZ.options
          .filter((r) => !p.reviewerChain.includes(r))
          .map((r) => (
            <Button
              key={r}
              type="button"
              variant="outline"
              onClick={() =>
                onChange({ ...p, reviewerChain: [...p.reviewerChain, r] })
              }
            >
              Add {r === "FINANCE" ? "Finance" : "Sales Manager"}
            </Button>
          ))}
      </section>
      <section className="space-y-4">
        <h2 className="font-semibold">Routing rules</h2>
        <p className="text-sm text-muted-foreground">
          Conditions within each rule use OR. The highest matching level wins.
          Excess = max(0, effective discount − line limit). Worst = largest line
          excess. Blended = sum(base × excess) ÷ sum(base). Overall discount =
          (sum(base) − sum(net)) ÷ sum(base). Thresholds below are percentage
          points.
        </p>
        {p.routingRules.map((r, i) => {
          const update = (patch: Partial<typeof r>) =>
            onChange({
              ...p,
              routingRules: p.routingRules.map((row, j) =>
                i === j ? { ...row, ...patch } : row,
              ),
            });
          return (
            <div key={i} className="space-y-4 rounded-lg border p-4">
              <div className="grid gap-4 sm:grid-cols-[8rem_1fr_auto]">
                <NumberField
                  label="Level"
                  min={1}
                  max={2}
                  value={r.level}
                  onChange={(v) => update({ level: v })}
                />
                <div className="space-y-2">
                  <Label htmlFor={`rule-${i}`}>Rule label</Label>
                  <Input
                    id={`rule-${i}`}
                    value={r.label}
                    maxLength={200}
                    onChange={(e) => update({ label: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="self-end"
                  onClick={() =>
                    onChange({
                      ...p,
                      routingRules: p.routingRules.filter((_, j) => i !== j),
                    })
                  }
                >
                  Remove rule
                </Button>
              </div>
              <ToggleField
                label="Any positive line excess"
                value={r.anyLineExcess}
                onChange={(v) => update({ anyLineExcess: v })}
              />
              <div className="grid gap-4 md:grid-cols-3">
                {(
                  [
                    ["worstExcessGteBp", "Worst line excess"],
                    ["blendedExcessGteBp", "Blended excess"],
                    ["overallExcessGteBp", "Overall ceiling excess"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-3">
                    <ToggleField
                      label={label}
                      value={r[key] !== null}
                      onChange={(v) => update({ [key]: v ? 1 : null })}
                    />
                    {r[key] !== null && (
                      <NumberField
                        label={`${label} ≥ (points)`}
                        bp
                        value={r[key]}
                        onChange={(v) => update({ [key]: v })}
                      />
                    )}{" "}
                    {key === "overallExcessGteBp" &&
                      p.overallCeilingBp === null && (
                        <p className="text-xs text-muted-foreground">
                          Inactive until the overall ceiling is enabled.
                        </p>
                      )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          disabled={p.routingRules.length >= 2}
          onClick={() =>
            onChange({
              ...p,
              routingRules: [
                ...p.routingRules,
                {
                  level: p.routingRules.length + 1,
                  label: "New routing rule",
                  anyLineExcess: false,
                  worstExcessGteBp: null,
                  blendedExcessGteBp: null,
                  overallExcessGteBp: null,
                },
              ],
            })
          }
        >
          Add routing rule
        </Button>
      </section>
      <section className="space-y-4">
        <h2 className="font-semibold">Evaluation safeguards</h2>
        <ChoiceField
          label="Recurring evaluation basis"
          value={p.evaluateRecurringInCycleBuckets ? "BUCKETS" : "COMBINED"}
          options={[
            {
              value: "BUCKETS",
              label: "Separate one-time and each recurring cycle (recommended)",
            },
            { value: "COMBINED", label: "Combined initial-period charges" },
          ]}
          onChange={(v) =>
            onChange({ ...p, evaluateRecurringInCycleBuckets: v === "BUCKETS" })
          }
        />
        <p className="text-xs text-muted-foreground">
          Combined evaluation explicitly weights monthly and annual initial
          charges together; it is not lifetime value.
        </p>
        <ToggleField
          label="Reject zero-price lines on submission"
          value={p.rejectZeroPriceLines}
          onChange={(v) => onChange({ ...p, rejectZeroPriceLines: v })}
        />
        <ToggleField
          label="Block approval of your own quote"
          value={p.blockOwnQuoteApproval}
          onChange={(v) => onChange({ ...p, blockOwnQuoteApproval: v })}
        />
      </section>
    </div>
  );
}
