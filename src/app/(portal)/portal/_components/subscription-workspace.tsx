"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { getMySubscription } from "@/server/queries/portal";
import { portalPauseAction } from "@/server/actions/portal";
import { firstBoundaryOnOrAfter } from "@/domain/boundaries/boundaries";
import { PageHeader } from "@/components/layout/page-header";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/forms/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Pause, Play, Check, X } from "@/components/icons";
import { formatMinor } from "@/domain/money/money";
export function PortalSubscription({
  data,
}: {
  data: Awaited<ReturnType<typeof getMySubscription>>;
}) {
  const s = data.subscription,
    router = useRouter();
  const [pending, start] = useTransition();
  const [action, setAction] = useState<"PAUSE" | "RESUME" | "WITHDRAW" | null>(
    null,
  );
  const [date, setDate] = useState<Date | undefined>(data.boundaries[0]);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const boundary = date
    ? firstBoundaryOnOrAfter(s.billingAnchor, s.plan.interval, date)
    : undefined;
  function open(next: typeof action) {
    setKey(crypto.randomUUID());
    setError("");
    setAction(next);
  }
  function submit() {
    if (!action) return;
    start(async () => {
      const result = await portalPauseAction({
        id: s.id,
        action,
        requestedDate: date,
        idempotencyKey: key,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setAction(null);
      router.refresh();
    });
  }
  return (
    <>
      <WorkspaceActions>
        {data.allowPauseResume && !s.cancelEffectiveAt && (
          <>
            {s.status === "ACTIVE" && (
              <Button onClick={() => open("PAUSE")}>
                <Pause />
                Pause subscription
              </Button>
            )}
            {["PAUSED", "PAUSE_SCHEDULED"].includes(s.status) && (
              <Button onClick={() => open("RESUME")}>
                <Play />
                {s.resumeAt ? "Change resume cycle" : "Choose resume cycle"}
              </Button>
            )}
            {s.status === "PAUSE_SCHEDULED" && (
              <Button variant="outline" onClick={() => open("WITHDRAW")}>
                <X />
                Withdraw pause
              </Button>
            )}
          </>
        )}
      </WorkspaceActions>
      <PageHeader
        title={`${s.orderLine.productName} · ${s.plan.tier?.name ?? s.plan.name}`}
        description={`${s.plan.interval.toLowerCase()} · ${s.status.toLowerCase().replaceAll("_", " ")}`}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <p>
          Next bill
          <br />
          <strong>
            {s.nextBillingDate?.toLocaleDateString() ?? "No scheduled bill"}
          </strong>
        </p>
        <p>
          Pause effective
          <br />
          <strong>{s.pauseEffectiveAt?.toLocaleDateString() ?? "—"}</strong>
        </p>
        <p>
          Resume
          <br />
          <strong>{s.resumeAt?.toLocaleDateString() ?? "—"}</strong>
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {[
          { title: "Current period entitlements", rows: data.entitlements },
          {
            title: "From your next billing cycle",
            rows: data.nextEntitlements,
          },
        ].map((group) => (
          <section
            key={group.title}
            className="space-y-3 rounded-xl border p-6"
          >
            <h2 className="font-semibold">{group.title}</h2>
            {group.rows.map((e, index) => (
              <p key={index}>
                {e.label}: {e.value} {e.unit}
                {e.per ? ` / ${e.per}` : ""}
              </p>
            ))}
            {!group.rows.length && (
              <p className="text-sm text-muted-foreground">
                No published entitlements.
              </p>
            )}
          </section>
        ))}
      </div>
      <section className="space-y-3">
        <h2 className="font-semibold">Billing schedule</h2>
        {s.schedule.map((item) => (
          <p
            key={item.id}
            className="flex flex-wrap justify-between gap-2 border-b py-3"
          >
            <span>
              {item.periodStart.toLocaleDateString()} –{" "}
              {item.periodEnd.toLocaleDateString()}
            </span>
            <span>
              {formatMinor(item.amountMinor, s.order.currency)} ·{" "}
              {item.status.toLowerCase().replaceAll("_", " ")}
            </span>
          </p>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Subscription history</h2>
        {s.transitions.map((t) => (
          <p key={t.id} className="text-sm">
            {t.effectiveAt.toLocaleDateString()} ·{" "}
            {t.type.toLowerCase().replaceAll("_", " ")}
          </p>
        ))}
      </section>
      <Dialog
        open={!!action}
        onOpenChange={(value) => {
          if (!value && !pending) setAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "PAUSE"
                ? "Pause subscription"
                : action === "WITHDRAW"
                  ? "Withdraw pause"
                  : "Choose resume cycle"}
            </DialogTitle>
            <DialogDescription>
              {action === "PAUSE"
                ? `Your pause takes effect ${s.currentPeriodEnd?.toLocaleDateString()}, at the end of your current paid period. You won't be billed while paused.`
                : action === "WITHDRAW"
                  ? "Your subscription will continue billing on its original schedule."
                  : "Resume at a billing boundary, after at least one full cycle paused."}
            </DialogDescription>
          </DialogHeader>
          {action === "RESUME" && (
            <>
              <Select
                value={
                  data.boundaries.some((b) => b.getTime() === date?.getTime())
                    ? date?.toISOString()
                    : ""
                }
                onValueChange={(value) => setDate(new Date(value))}
              >
                <SelectTrigger aria-label="Eligible resume cycles">
                  <SelectValue placeholder="Select a cycle" />
                </SelectTrigger>
                <SelectContent>
                  {data.boundaries.map((b) => (
                    <SelectItem key={b.toISOString()} value={b.toISOString()}>
                      {b.toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DatePicker
                label="Requested resume date"
                value={date}
                onChange={setDate}
              />
              {boundary && date && boundary.getTime() !== date.getTime() && (
                <p className="text-sm">
                  We will adjust your resume date to{" "}
                  {boundary.toLocaleDateString()}, the next billing boundary.
                </p>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Button
            disabled={pending || (action === "RESUME" && !date)}
            onClick={submit}
          >
            <Check />
            {pending ? "Saving…" : "Confirm schedule"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
