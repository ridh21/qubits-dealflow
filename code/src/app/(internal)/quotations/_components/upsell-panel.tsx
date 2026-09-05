"use client";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import {
  createUpsellDismissals,
  dismissedProductIds,
  upsellDismissalKey,
} from "./upsell-dismissals";
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
  const key = upsellDismissalKey(id, version);
  const store = useMemo(
    () => createUpsellDismissals(key, () => window.localStorage),
    [key],
  );
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const dismissed = useMemo(() => dismissedProductIds(snapshot), [snapshot]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) store.refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, store]);
  const [error, setError] = useState(""),
    [pending, start] = useTransition(),
    router = useRouter();
  if (!items.length) return null;
  return (
    <section className="space-y-4 rounded-xl border p-5">
      <h2 className="text-lg font-semibold">Suggested additions</h2>
      <p className="text-sm text-muted-foreground">
        Dismissed suggestions stay hidden for this revision on this browser.
      </p>
      <p role="alert">{error}</p>
      {items.every((item) => dismissed.includes(item.productId)) && (
        <p className="text-sm text-muted-foreground">
          All suggestions dismissed for this revision.
        </p>
      )}
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
                disabled={pending}
                aria-label={`Dismiss ${i.name} for this revision`}
                onClick={() => store.dismiss(i.productId)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ))}
    </section>
  );
}
