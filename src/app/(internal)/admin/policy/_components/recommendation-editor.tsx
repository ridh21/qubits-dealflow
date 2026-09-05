"use client";
import { useState, useTransition } from "react";
import type { PolicyPayload } from "@/domain/policy/schemas";
import { refreshCopurchaseRulesAction } from "@/server/actions/policy";
import { Button } from "@/components/ui/button";
import { ChoiceField, NumberField } from "./fields";
type Policy = PolicyPayload<"RECOMMENDATION">;
export function RecommendationEditor({
  value: p,
  onChange,
  products,
}: {
  value: Policy;
  onChange: (p: Policy) => void;
  products: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition(),
    [message, setMessage] = useState("");
  const options = products.map((p) => ({ value: p.id, label: p.name }));
  return (
    <section className="space-y-5">
      <h2 className="font-semibold">Product relationships</h2>
      <p className="text-sm text-muted-foreground">
        Rules and refresh results remain in this draft until you publish. Manual
        pairs take precedence over co-purchase history.
      </p>
      {p.rules.map((r, i) => (
        <div
          key={i}
          className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <ChoiceField
            label="When quote contains"
            value={r.productId}
            options={options}
            onChange={(v) =>
              onChange({
                ...p,
                rules: p.rules.map((r, j) =>
                  i === j ? { ...r, productId: v, source: "MANUAL" } : r,
                ),
              })
            }
          />
          <ChoiceField
            label="Suggest product"
            value={r.suggestedProductId}
            options={options}
            onChange={(v) =>
              onChange({
                ...p,
                rules: p.rules.map((r, j) =>
                  i === j
                    ? { ...r, suggestedProductId: v, source: "MANUAL" }
                    : r,
                ),
              })
            }
          />
          <NumberField
            label={`Weight (${r.source === "MANUAL" ? "manual" : "co-purchase"})`}
            min={1}
            value={r.weight}
            onChange={(v) =>
              onChange({
                ...p,
                rules: p.rules.map((r, j) =>
                  i === j ? { ...r, weight: v, source: "MANUAL" } : r,
                ),
              })
            }
          />
          <Button
            type="button"
            variant="ghost"
            className="self-end"
            onClick={() =>
              onChange({ ...p, rules: p.rules.filter((_, j) => i !== j) })
            }
          >
            Remove pair
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={products.length < 2}
          onClick={() =>
            onChange({
              ...p,
              rules: [
                ...p.rules,
                {
                  productId: products[0].id,
                  suggestedProductId: products[1].id,
                  weight: 1,
                  source: "MANUAL",
                },
              ],
            })
          }
        >
          Add relationship
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await refreshCopurchaseRulesAction();
              if (!result.ok) {
                setMessage(result.error.message);
                return;
              }
              const manual = p.rules.filter((r) => r.source === "MANUAL");
              const refreshed = result.data.filter(
                (r) =>
                  !manual.some(
                    (m) =>
                      m.productId === r.productId &&
                      m.suggestedProductId === r.suggestedProductId,
                  ),
              );
              onChange({ ...p, rules: [...manual, ...refreshed] });
              setMessage(
                `${refreshed.length} co-purchase pairs staged. Review and publish to activate.`,
              );
            })
          }
        >
          {pending ? "Refreshing…" : "Refresh from confirmed orders"}
        </Button>
      </div>
      <p role="status" className="text-sm">
        {message}
      </p>
      <h2 className="font-semibold">Promotions</h2>
      {Object.entries(p.promotions).map(([id, bp]) => (
        <div key={id} className="flex items-end gap-3">
          <NumberField
            label={`${products.find((p) => p.id === id)?.name ?? id} discount (%)`}
            bp
            value={bp}
            onChange={(v) =>
              onChange({ ...p, promotions: { ...p.promotions, [id]: v } })
            }
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const promotions = { ...p.promotions };
              delete promotions[id];
              onChange({ ...p, promotions });
            }}
          >
            Remove promotion
          </Button>
        </div>
      ))}
      <ChoiceField
        label="Add a promotion for"
        value=""
        options={options.filter((o) => p.promotions[o.value] === undefined)}
        onChange={(id) =>
          onChange({ ...p, promotions: { ...p.promotions, [id]: 0 } })
        }
      />
    </section>
  );
}
