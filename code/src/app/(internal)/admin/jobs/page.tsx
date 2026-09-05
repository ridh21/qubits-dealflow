import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/guards";
import { getBillingRun, listBillingRuns } from "@/server/queries/jobs";
import { NotFound } from "@/domain/errors";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { JobActions } from "./_components/job-actions";

export const metadata = { title: "Operational jobs · Admin" };
const labels = { SUCCEEDED: "Succeeded", PARTIAL_FAILURE: "Completed with failures", FAILED: "Failed", UNFINISHED: "No outcome recorded" };
const date = (value: string) => `${new Date(value).toISOString().replace("T", " ").slice(0, 19)} UTC`;
export default async function JobsPage({ searchParams }: { searchParams: Promise<{ page?: string; run?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const history = await listBillingRuns(Number(params.page ?? 1));
  const selectedId = params.run ?? history.rows[0]?.runId;
  let selected: Awaited<ReturnType<typeof getBillingRun>> | null = null;
  if (selectedId) {
    try { selected = await getBillingRun(selectedId); }
    catch (error) { if (error instanceof NotFound) notFound(); throw error; }
  }
  return <>
    <PageHeader title="Operational jobs" description="Billing run history, recorded outcomes and retries. Times are shown in UTC." />
    <JobActions runId={selected?.runId} canRetry={selected?.canRetry ?? false} page={history.page} hasNext={history.hasNext} />
    <section aria-label="Billing run history" className="rounded-xl border">
      <Table>
        <TableHeader><TableRow><TableHead>Started</TableHead><TableHead>Outcome</TableHead><TableHead>Invoices</TableHead><TableHead>Failures</TableHead><TableHead>Run</TableHead></TableRow></TableHeader>
        <TableBody>{history.rows.map((run) => <TableRow key={run.runId} data-state={run.runId === selectedId ? "selected" : undefined}>
          <TableCell className="tabular text-xs">{date(run.startedAt)}</TableCell>
          <TableCell><Badge variant={run.status === "SUCCEEDED" ? "secondary" : "outline"}>{labels[run.status]}</Badge></TableCell>
          <TableCell className="tabular">{run.outcome?.invoices ?? "—"}</TableCell>
          <TableCell className="tabular">{run.outcome?.failureCount ?? "—"}</TableCell>
          <TableCell><Link className="font-mono text-xs underline underline-offset-4" href={`/admin/jobs?page=${history.page}&run=${run.runId}`}>{run.runId.slice(0, 8)}<span className="sr-only"> — view billing run</span></Link></TableCell>
        </TableRow>)}</TableBody>
      </Table>
      {!history.rows.length ? <p className="p-6 text-sm text-muted-foreground">No billing runs have been recorded yet. Scheduled and manual billing runs will appear here.</p> : null}
    </section>
    {selected ? <Card className="shadow-none"><CardContent className="space-y-5 p-5">
      <div className="space-y-1"><h2 className="font-display text-lg font-semibold">{labels[selected.status]}</h2>
        <p className="break-all font-mono text-xs text-muted-foreground">Correlation ID: {selected.runId}</p>
      </div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-muted-foreground">Billing cutoff</dt><dd>{selected.asOf ? date(selected.asOf) : "Unavailable"}</dd></div>
        <div><dt className="text-muted-foreground">Finished</dt><dd>{selected.finishedAt ? date(selected.finishedAt) : "Not recorded"}</dd></div>
        <div><dt className="text-muted-foreground">Orders started / transitions</dt><dd>{selected.outcome ? `${selected.outcome.ordersStarted} / ${selected.outcome.transitions}` : "Unavailable"}</dd></div>
        <div><dt className="text-muted-foreground">Triggered by</dt><dd>{selected.trigger === "ADMIN_RETRY" ? "Admin retry" : selected.trigger === "API" ? "Scheduled API" : "System or manual billing"}</dd></div>
      </dl>
      {selected.retryOf ? <p className="text-sm">Retry of <Link className="underline underline-offset-4" href={`/admin/jobs?run=${selected.retryOf}`}>{selected.retryOf}</Link></p> : null}
      {selected.status === "UNFINISHED" ? <p className="rounded-lg bg-muted p-3 text-sm">This run may still be running, or its completion could not be saved. Check worker logs with the correlation ID before starting more billing. Retry is available for recorded failures.</p> : null}
      {selected.outcome?.observationFailures ? <p className="text-sm text-destructive">{selected.outcome.observationFailures} individual failure records could not be saved. The completion summary retains up to 100 failure details.</p> : null}
      {selected.failures.length ? <div className="space-y-3"><h3 className="font-semibold">Failures requiring attention</h3>
        <ul className="divide-y rounded-lg border">{selected.failures.map((failure, index) => <li key={`${failure.scope}:${failure.id}:${index}`} className="space-y-1 p-3 text-sm">
          <p className="font-medium">{failure.scope.toLowerCase().replaceAll("_", " ")} · {failure.code}</p>
          <p>{failure.message}</p><p className="break-all font-mono text-xs text-muted-foreground">{failure.id}</p>
        </li>)}</ul>
        {(selected.outcome?.failureCount ?? 0) > selected.failures.length ? <p className="text-xs text-muted-foreground">Showing the first {selected.failures.length} failures of {selected.outcome?.failureCount}. Additional item records may be available in the audit log.</p> : null}
      </div> : selected.status === "SUCCEEDED" ? <p className="text-sm text-muted-foreground">No failures were recorded for this run.</p> : null}
    </CardContent></Card> : null}
  </>;
}
