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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WarningCircle } from "@/components/icons";
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
    <Card>
      <CardHeader>
        <CardTitle>Suggested additions</CardTitle>
        <CardDescription>
          Dismissed suggestions stay hidden for this revision on this browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
      {error ? (
        <Alert variant="destructive">
          <WarningCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {items.every((item) => dismissed.includes(item.productId)) && (
        <p className="text-muted-foreground text-sm">
          All suggestions dismissed for this revision.
        </p>
      )}
      {items
        .filter((i) => !dismissed.includes(i.productId))
        .map((i) => (
          <div
            key={i.productId}
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-3"
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
      </CardContent>
    </Card>
  );
}
