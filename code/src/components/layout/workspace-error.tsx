"use client";

import { Repeat, WarningCircle } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { WorkspaceActions } from "./workspace-actions";

/** Keep server error details private while preserving a usable workspace. */
export function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <WorkspaceActions>
        <Button onClick={reset}>
          <Repeat aria-hidden="true" />
          Try again
        </Button>
      </WorkspaceActions>
      <section className="rounded-xl border bg-card p-8" aria-labelledby="workspace-error-title">
        <WarningCircle weight="duotone" className="mb-4 size-10 text-muted-foreground" aria-hidden="true" />
        <h1 id="workspace-error-title" className="text-2xl font-semibold">This page could not load</h1>
        <p className="mt-3 max-w-lg text-muted-foreground">
          Try again from the sidebar, or use navigation to open another page.
          If this followed a save, reload and check the record before submitting it again.
        </p>
        {error.digest && (
          <p className="mt-4 text-xs text-muted-foreground">Support reference: {error.digest}</p>
        )}
      </section>
    </>
  );
}
