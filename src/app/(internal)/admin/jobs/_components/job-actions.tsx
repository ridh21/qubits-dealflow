"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/ui/toast";
import { ArrowClockwise, Repeat } from "@phosphor-icons/react";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import { Button } from "@/components/ui/button";
import { retryBillingRunAction } from "@/server/actions/jobs";

export function JobActions({ runId, canRetry, page, hasNext }: {
  runId?: string; canRetry: boolean; page: number; hasNext: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <WorkspaceActions>
    <Button variant="outline" disabled={pending} onClick={() => router.refresh()}>
      <ArrowClockwise /> Refresh job history
    </Button>
    <Button disabled={pending || !canRetry || !runId} onClick={() => start(async () => {
      if (!runId) return;
      try {
        const result = await retryBillingRunAction({ runId });
        if (!result.ok) { toast.error(result.error.message); router.refresh(); return; }
        if (result.data.status === "SUCCEEDED") toast.success("Billing retry completed.");
        else toast.warning("Retry finished with failures. Review the new run.");
        router.push(`/admin/jobs?run=${result.data.runId}`);
        router.refresh();
      } catch {
        toast.error("Retry response was interrupted. Refresh history before retrying.");
        router.refresh();
      }
    })}>
      <Repeat /> {pending ? "Retrying billing…" : "Retry selected run"}
    </Button>
    <p className="text-xs text-muted-foreground">Retries use the selected run’s billing cutoff and preserve previously issued invoices.</p>
    {page > 1 ? <Link className="text-sm underline underline-offset-4" href={`/admin/jobs?page=${page - 1}`}>Newer runs</Link> : null}
    {hasNext ? <Link className="text-sm underline underline-offset-4" href={`/admin/jobs?page=${page + 1}`}>Older runs</Link> : null}
  </WorkspaceActions>;
}
