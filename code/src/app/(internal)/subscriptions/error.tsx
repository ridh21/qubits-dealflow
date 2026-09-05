"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="rounded-xl border p-8">
      <h2 className="text-lg font-semibold">Subscriptions could not load</h2>
      <p className="my-3 text-sm text-muted-foreground">
        Check your connection and try again. Subscription management requires a
        Finance or Admin account.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
