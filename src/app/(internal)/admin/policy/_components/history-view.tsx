"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restorePolicyAction } from "@/server/actions/policy";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ChoiceField } from "./fields";
import { DiffView } from "./diff-view";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormError } from "@/components/layout/form-error";
interface Version {
  id: string;
  version: number;
  payload: unknown;
  isActive: boolean;
  publishedByName: string;
  publishedAt: string;
  reason: string | null;
}
export function HistoryView({
  rows,
  compareVersions,
  editable,
  activeId,
  activePayload,
}: {
  rows: Version[];
  compareVersions: { id: string; version: number; payload: unknown }[];
  editable: boolean;
  activeId: string | null;
  activePayload: unknown;
}) {
  const [from, setFrom] = useState(
      compareVersions[1]?.id ?? compareVersions[0]?.id ?? "",
    ),
    [to, setTo] = useState(compareVersions[0]?.id ?? ""),
    [restore, setRestore] = useState<Version | null>(null),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState(""),
    [pending, start] = useTransition();
  const router = useRouter(),
    options = compareVersions.map((r) => ({
      value: r.id,
      label: `Version ${r.version}`,
    }));
  return (
    <div className="space-y-6">
      {compareVersions.length > 0 && (
        <section className="space-y-4 rounded-xl border p-5">
          <h2 className="font-semibold">Compare published versions</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <ChoiceField
              label="Before"
              value={from}
              options={options}
              onChange={setFrom}
            />
            <ChoiceField
              label="After"
              value={to}
              options={options}
              onChange={setTo}
            />
          </div>
          <DiffView
            before={compareVersions.find((r) => r.id === from)?.payload}
            after={compareVersions.find((r) => r.id === to)?.payload}
          />
        </section>
      )}
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No versions match this filter.
        </p>
      )}
      {rows.map((r) => (
        <article key={r.id} className="space-y-3 rounded-xl border p-5">
          <h2 className="font-semibold">
            Version {r.version}
            {r.isActive ? " · Active" : ""}
          </h2>
          <p className="text-sm text-muted-foreground">
            {r.publishedByName} · {r.publishedAt.replace("T", " ").slice(0, 16)}{" "}
            UTC
          </p>
          <p className="text-sm">{r.reason ?? "No reason recorded"}</p>
          {editable && (
            <Button
              type="button"
              variant="outline"
              disabled={r.isActive}
              onClick={() => {
                setRestore(r);
                setReason("");
                setMessage("");
              }}
            >
              Restore as new version
            </Button>
          )}
        </article>
      ))}
      <p role="status">{message}</p>
      <Dialog
        open={restore !== null}
        onOpenChange={(v) => {
          if (!v && !pending) setRestore(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Restore version {restore?.version}</DialogTitle>
            <DialogDescription>
              This publishes a new version. Existing history and pending
              approval snapshots stay intact.
            </DialogDescription>
          </DialogHeader>
          <DiffView
            before={activePayload ?? {}}
            after={restore?.payload ?? {}}
          />
          <Label htmlFor="restore-reason">Reason for restoring</Label>
          <Textarea
            id="restore-reason"
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <FormError message={message} />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setRestore(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={pending || !reason.trim()}
              onClick={() =>
                start(async () => {
                  if (!restore) return;
                  const r = await restorePolicyAction(
                    restore.id,
                    reason,
                    activeId,
                  );
                  if (!r.ok) {
                    setMessage(r.error.message);
                    return;
                  }
                  setRestore(null);
                  setMessage(
                    `Published restored policy as version ${r.data.version}.`,
                  );
                  router.refresh();
                })
              }
            >
              {pending ? "Publishing…" : "Publish restored version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
