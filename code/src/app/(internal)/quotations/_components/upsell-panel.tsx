"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { suggestionsFor } from "@/server/services/upsell.service";
import { addQuoteLineAction } from "@/server/actions/quotations";
import { Button } from "@/components/ui/button";
import { formatMinor } from "@/domain/money/money";
export function UpsellPanel({
  items,
  id,
  version,
  currency,
}: {
  items: Awaited<ReturnType<typeof suggestionsFor>>;
  id: string;
  version: number;
  currency: string;
}) {
  const [dismissed, setDismissed] = useState<string[]>([]),
    [error, setError] = useState(""),
    [pending, start] = useTransition(),
    router = useRouter();
  if (!items.length) return null;
  return (
    <section className="space-y-4 rounded-xl border p-5">
      <h2 className="text-lg font-semibold">Suggested additions</h2>
      <p role="alert">{error}</p>
      {items
        .filter((i) => !dismissed.includes(i.productId))
        .map((i) => (
          <div
            key={i.productId}
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <div>
              <p className="font-medium">
                {i.name}
                {i.promoBp ? ` · ${i.promoBp / 100}% promotion` : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                Margin contribution {formatMinor(i.marginDeltaMinor, currency)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await addQuoteLineAction({
                      id,
                      expectedVersion: version,
                      productId: i.productId,
                      qty: 1,
                      discountBp: i.promoBp,
                      addedFromUpsell: true,
                    });
                    if (r.ok) router.refresh();
                    else setError(r.error.message);
                  })
                }
              >
                Add
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const next = [...dismissed, i.productId];
                  setDismissed(next);
                  localStorage.setItem(
                    `dismiss:${id}:${version}`,
                    JSON.stringify(next),
                  );
                }}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ))}
    </section>
  );
}
