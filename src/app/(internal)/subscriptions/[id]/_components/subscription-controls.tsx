"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CalendarBlank,
  Pencil,
  Prohibit,
  ClockCounterClockwise,
  Repeat,
} from "@/components/icons";
import { DatePicker } from "@/components/forms/date-picker";
import { Money } from "@/components/layout/money";
import {
  activationAction,
  modifySubscriptionAction,
  cancelSubscriptionAction,
  pauseResumeAction,
  previewChangeAction,
  previewCancelAction,
} from "@/server/actions/subscriptions";
import type { ActionResult } from "@/domain/errors";
import { dateLabel, label } from "../../_components/format";
import { firstBoundaryOnOrAfter } from "@/domain/boundaries/boundaries";
import type { RecurringInterval } from "@prisma/client";
import { FormError } from "@/components/layout/form-error";

type Props = {
  id: string;
  status: string;
  qty: number;
  planId: string;
  currency: string;
  activationDate: string;
  periodEnd: string | null;
  pauseAt: string | null;
  resumeAt: string | null;
  cancelAt: string | null;
  anchor: string;
  interval: RecurringInterval;
  boundaries: string[];
  plans: { id: string; name: string; interval: string; priceMinor: number }[];
};
type Command =
  "modify" | "cancel" | "activation" | "pause" | "resume" | "withdraw";
type Preview = {
  chargeMinor?: number;
  creditMinor: number;
  chargeTaxMinor?: number;
  creditTaxMinor?: number;
  effectiveAt: Date;
  differentCycle?: boolean;
};
export function SubscriptionControls(props: Props) {
  const [command, setCommand] = useState<Command | null>(null);
  const active = ["ACTIVE", "PAUSE_SCHEDULED"].includes(props.status);
  return (
    <>
      <WorkspaceActions>
        {props.status === "SCHEDULED" && (
          <Button variant="outline" onClick={() => setCommand("activation")}>
            <CalendarBlank />
            Set activation date
          </Button>
        )}
        {active && !props.cancelAt && (
          <Button onClick={() => setCommand("modify")}>
            <Pencil />
            Modify subscription
          </Button>
        )}
        {props.status === "ACTIVE" && !props.cancelAt && (
          <Button variant="outline" onClick={() => setCommand("pause")}>
            <ClockCounterClockwise />
            Schedule pause
          </Button>
        )}
        {["PAUSE_SCHEDULED", "PAUSED"].includes(props.status) &&
          !props.cancelAt && (
            <Button variant="outline" onClick={() => setCommand("resume")}>
              <Repeat />
              {props.resumeAt ? "Change resume" : "Select resume"}
            </Button>
          )}
        {props.status === "PAUSE_SCHEDULED" && !props.cancelAt && (
          <Button variant="outline" onClick={() => setCommand("withdraw")}>
            <ClockCounterClockwise />
            Withdraw pause
          </Button>
        )}
        {props.status !== "CANCELLED" && !props.cancelAt && (
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => setCommand("cancel")}
          >
            <Prohibit />
            Cancel subscription
          </Button>
        )}
      </WorkspaceActions>
      <Dialog
        open={command !== null}
        onOpenChange={(open) => {
          if (!open) setCommand(null);
        }}
      >
        {command && (
          <CommandForm
            key={command}
            {...props}
            command={command}
            close={() => setCommand(null)}
          />
        )}
      </Dialog>
    </>
  );
}
function CommandForm(props: Props & { command: Command; close: () => void }) {
  const { command } = props;
  const router = useRouter();
  const [qty, setQty] = useState(props.qty),
    [plan, setPlan] = useState(props.planId);
  const [mode, setMode] = useState<"END_OF_PERIOD" | "IMMEDIATE">(
    "END_OF_PERIOD",
  );
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(props.activationDate.slice(0, 10));
  const [resume, setResume] = useState(
    props.boundaries.includes(props.resumeAt ?? "")
      ? props.resumeAt!
      : (props.boundaries[0] ?? ""),
  );
  const [customDate, setCustomDate] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<{
    input: string;
    data?: Preview;
    error?: string;
  } | null>(null);
  const inputKey = JSON.stringify({ qty, plan, mode });
  const needsPreview = command === "modify" || command === "cancel";
  useEffect(() => {
    if (!needsPreview) return;
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const result =
          command === "modify"
            ? await previewChangeAction({
                id: props.id,
                newQty: qty,
                newPlanId: plan,
              })
            : await previewCancelAction({ id: props.id, mode });
        if (current)
          setPreview(
            result.ok
              ? { input: inputKey, data: result.data }
              : { input: inputKey, error: result.error.message },
          );
      } catch {
        if (current)
          setPreview({
            input: inputKey,
            error: "Could not load preview. Change a field to retry.",
          });
      }
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [command, props.id, qty, plan, mode, inputKey, needsPreview]);
  const ready = preview?.input === inputKey && !!preview.data;
  const selected = props.plans.find((item) => item.id === plan);
  const titles: Record<Command, string> = {
    modify: "Modify subscription",
    cancel: "Cancel subscription",
    activation: "Set activation date",
    pause: "Schedule a pause",
    resume: "Choose a resume boundary",
    withdraw: "Withdraw scheduled pause",
  };
  const descriptions: Record<Command, string> = {
    modify: "Review the live billing adjustment before applying your changes.",
    cancel: "Review when access ends and the credit that will be issued.",
    activation: "Billing begins at activation. Choose a future date (IST).",
    pause: `Pause takes effect ${dateLabel(props.periodEnd)} — the end of the current paid period. No recurring invoices are issued while paused.`,
    resume:
      "Resume at a billing boundary after at least one complete paused cycle. A full period is billed on resume.",
    withdraw:
      "Keep this subscription active. The scheduled pause and resume date will be cleared.",
  };
  const previewData = ready ? preview.data : undefined;
  function submit() {
    start(async () => {
      try {
        let result: ActionResult<unknown>;
        const base = { id: props.id, idempotencyKey: key };
        if (command === "modify")
          result = await modifySubscriptionAction({
            ...base,
            newQty: qty,
            newPlanId: plan,
          });
        else if (command === "cancel")
          result = await cancelSubscriptionAction({ ...base, mode, reason });
        else if (command === "activation")
          result = await activationAction({
            id: props.id,
            date: new Date(`${date}T00:00:00Z`).toISOString(),
          });
        else
          result = await pauseResumeAction({
            ...base,
            action:
              command === "pause"
                ? "PAUSE"
                : command === "withdraw"
                  ? "WITHDRAW"
                  : "RESUME",
            ...(command === "resume" ? { requestedDate: resume } : {}),
          });
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        toast.success("Subscription updated");
        props.close();
        router.refresh();
      } catch {
        toast.error("Could not save. Retry to safely complete this request.");
      }
    });
  }
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{titles[command]}</DialogTitle>
        <DialogDescription>{descriptions[command]}</DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-5"
      >
        <fieldset disabled={pending} className="space-y-4">
          {command === "modify" && (
            <>
              <label className="block space-y-2 text-sm">
                Quantity
                <Input
                  type="number"
                  min={1}
                  max={1000000}
                  step={1}
                  required
                  value={qty || ""}
                  onChange={(event) => setQty(Number(event.target.value))}
                />
              </label>
              <label className="block space-y-2 text-sm">
                Plan and cycle
                <select
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={plan}
                  onChange={(event) => setPlan(event.target.value)}
                >
                  {!props.plans.some((item) => item.id === props.planId) && (
                    <option value={props.planId}>
                      Current plan (inactive)
                    </option>
                  )}
                  {props.plans.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} · {label(item.interval)}
                    </option>
                  ))}
                </select>
              </label>
              {selected && (
                <p className="text-sm text-muted-foreground">
                  Catalog unit price:{" "}
                  <Money
                    minor={selected.priceMinor}
                    currency={props.currency}
                  />{" "}
                  / {label(selected.interval)}. Existing discounts are retained.
                </p>
              )}
            </>
          )}
          {command === "cancel" && (
            <>
              <fieldset className="space-y-3">
                <legend className="mb-2 text-sm font-medium">
                  Cancellation timing
                </legend>
                {(["END_OF_PERIOD", "IMMEDIATE"] as const).map((value) => (
                  <label
                    key={value}
                    className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                  >
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === value}
                      onChange={() => setMode(value)}
                    />
                    {value === "END_OF_PERIOD"
                      ? "End of current period · no credit"
                      : "Immediately · credit per plan policy"}
                  </label>
                ))}
              </fieldset>
              <label className="block space-y-2 text-sm">
                Reason
                <Textarea
                  required
                  maxLength={1000}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <p className="text-sm text-muted-foreground">
                Cancellation clears the scheduled resume.
              </p>
            </>
          )}
          {command === "activation" && (
            <label className="block space-y-2 text-sm">
              Activation date (IST)
              <Input
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
          )}
          {command === "resume" && (
            <>
              <label className="block space-y-2 text-sm">
                Eligible boundary
                <select
                  required
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={resume}
                  onChange={(event) => {
                    setResume(event.target.value);
                    setCustomDate("");
                  }}
                >
                  {!props.boundaries.includes(resume) && resume && (
                    <option value={resume}>{dateLabel(resume)}</option>
                  )}
                  {props.boundaries.map((boundary) => (
                    <option key={boundary} value={boundary}>
                      {dateLabel(boundary)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="space-y-2">
                <p className="text-sm">Or request a later date (IST)</p>
                <DatePicker
                  label="Choose requested resume date"
                  disabled={pending}
                  value={
                    customDate ? new Date(`${customDate}T12:00:00`) : undefined
                  }
                  onChange={(chosen) => {
                    if (!chosen) {
                      setCustomDate("");
                      return;
                    }
                    const value = `${chosen.getFullYear()}-${String(chosen.getMonth() + 1).padStart(2, "0")}-${String(chosen.getDate()).padStart(2, "0")}`;
                    setCustomDate(value);
                    const earliest = props.boundaries[0];
                    if (!earliest) return;
                    const requested = new Date(
                      Math.max(
                        Date.parse(`${value}T00:00:00Z`),
                        Date.parse(earliest),
                      ),
                    );
                    setResume(
                      firstBoundaryOnOrAfter(
                        new Date(props.anchor),
                        props.interval,
                        requested,
                      ).toISOString(),
                    );
                  }}
                />
              </div>
              {customDate && (
                <p className="rounded-lg bg-muted p-3 text-sm" role="status">
                  Requested {dateLabel(customDate)}. Resume is aligned to{" "}
                  {dateLabel(resume)}. Confirm below to use this billing
                  boundary.
                </p>
              )}
            </>
          )}
          {needsPreview && (
            <div
              className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm"
              aria-live="polite"
            >
              {preview?.input === inputKey && preview.error ? (
                <FormError message={preview.error} />
              ) : previewData ? (
                <>
                  <p className="font-medium">
                    Effective {dateLabel(previewData.effectiveAt)}
                  </p>
                  {command === "modify" && (
                    <p>
                      Charge including tax{" "}
                      <span className="float-right">
                        <Money
                          minor={
                            (previewData.chargeMinor ?? 0) +
                            (previewData.chargeTaxMinor ?? 0)
                          }
                          currency={props.currency}
                        />
                      </span>
                    </p>
                  )}
                  <p>
                    Credit including tax{" "}
                    <span className="float-right">
                      <Money
                        minor={
                          previewData.creditMinor +
                          (previewData.creditTaxMinor ?? 0)
                        }
                        currency={props.currency}
                      />
                    </span>
                  </p>
                  {previewData.differentCycle && (
                    <p className="text-muted-foreground">
                      Changing cycle resets the billing anchor and clears
                      scheduled pause/resume dates.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Final amounts are recalculated when confirmed.
                  </p>
                </>
              ) : (
                <p>Calculating preview…</p>
              )}
            </div>
          )}
        </fieldset>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={props.close}
          >
            Back
          </Button>
          <Button
            type="submit"
            variant={command === "cancel" ? "destructive" : "default"}
            disabled={
              pending ||
              (needsPreview && !ready) ||
              (command === "modify" &&
                qty === props.qty &&
                plan === props.planId) ||
              (command === "resume" && !resume)
            }
          >
            {pending ? "Saving…" : "Confirm"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
