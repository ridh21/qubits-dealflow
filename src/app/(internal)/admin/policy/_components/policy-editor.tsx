"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog, GuardedLink } from "@/components/confirm-dialog";
import {
  type PolicyKind,
  type PolicyPayload,
  POLICY_META,
} from "@/domain/policy/schemas";
import { parsePolicy } from "@/domain/policy/validate-discount-risk";
import { diffPolicy } from "@/domain/policy/diff";
import { DomainError } from "@/domain/errors";
import { publishPolicyAction } from "@/server/actions/policy";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DiscountEditor } from "./discount-editor";
import { SimpleEditor } from "./simple-editor";
import { RecommendationEditor } from "./recommendation-editor";
import { DiffView } from "./diff-view";
import { RiskSimulator, OperationalSimulator } from "./simulator";
import { FormError } from "@/components/layout/form-error";
interface Props {
  kind: PolicyKind;
  initial: PolicyPayload<PolicyKind>;
  activeId: string | null;
  version: number;
  editable: boolean;
  categories: { id: string; name: string }[];
  products: { id: string; name: string }[];
  pendingCount: number;
}
export function PolicyEditor({
  kind,
  initial,
  activeId,
  version,
  editable,
  categories,
  products,
  pendingCount,
}: Props) {
  const [draft, setDraft] = useState(initial),
    [reason, setReason] = useState(""),
    [open, setOpen] = useState(false),
    [pending, start] = useTransition(),
    [message, setMessage] = useState("");
  const router = useRouter(),
    dirty = diffPolicy(initial, draft).length > 0;
  let errors: { path: string; message: string }[] = [];
  try {
    parsePolicy(kind, draft);
  } catch (e) {
    errors =
      e instanceof DomainError && Array.isArray(e.meta?.errors)
        ? (e.meta.errors as typeof errors)
        : [
            {
              path: "policy",
              message: e instanceof Error ? e.message : "Check the policy.",
            },
          ];
  }
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <GuardedLink
          className="underline"
          href="/admin/policy"
          guard={dirty}
          title="Discard your unpublished changes?"
          description="This policy has edits that have not been published. Leaving now discards them."
          destructive
        >
          All policies
        </GuardedLink>
        <span>
          {activeId
            ? `Active version ${version}`
            : "No active version · review these initial defaults"}
        </span>
        <GuardedLink
          className="underline"
          href={`/admin/policy/history/${kind}`}
          guard={dirty}
          title="Discard your unpublished changes?"
          description="This policy has edits that have not been published. Leaving now discards them."
          destructive
        >
          Version history
        </GuardedLink>
      </div>
      {!editable && (
        <p className="rounded-lg border bg-muted p-4 text-sm">
          Read-only access. You can inspect this policy and simulate its
          behavior.
        </p>
      )}
      <form
        className="space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        <fieldset
          disabled={!editable || pending}
          className="space-y-8 rounded-xl border bg-card p-5 sm:p-6"
        >
          <legend className="px-2 font-semibold">
            {POLICY_META[kind].title} settings
          </legend>
          {kind === "DISCOUNT_RISK" ? (
            <DiscountEditor
              value={draft as PolicyPayload<"DISCOUNT_RISK">}
              onChange={setDraft}
              categories={categories}
            />
          ) : (
            <SimpleEditor
              value={
                draft as PolicyPayload<Exclude<PolicyKind, "DISCOUNT_RISK">>
              }
              onChange={setDraft}
            />
          )}{" "}
          {kind === "RECOMMENDATION" && (
            <RecommendationEditor
              value={draft as PolicyPayload<"RECOMMENDATION">}
              onChange={setDraft}
              products={products}
            />
          )}
        </fieldset>
        {errors.length > 0 && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive"
          >
            <p className="font-medium">
              Resolve these fields before publishing or simulating:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {errors.map((e, i) => (
                <li key={i}>
                  {e.path}: {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {editable && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={pending || errors.length > 0 || (!dirty && !!activeId)}
            >
              Review & publish
            </Button>
            <ConfirmDialog
              title="Discard your unpublished changes?"
              description="The editor returns to the last published version. This cannot be undone."
              confirmLabel="Discard changes"
              cancelLabel="Keep editing"
              destructive
              onConfirm={() => {
                setDraft(initial);
                setMessage("");
                toast.success("Unpublished changes discarded.");
              }}
              trigger={
                <Button type="button" variant="outline" disabled={!dirty || pending}>
                  Discard changes
                </Button>
              }
            />
            <span className="text-sm text-muted-foreground">
              {dirty ? "Unpublished changes" : "No unpublished changes"}
            </span>
          </div>
        )}
      </form>
      {kind === "DISCOUNT_RISK" && (
        <RiskSimulator
          key={JSON.stringify(draft)}
          draft={draft as PolicyPayload<"DISCOUNT_RISK">}
          active={activeId ? (initial as PolicyPayload<"DISCOUNT_RISK">) : null}
          categories={categories}
        />
      )}
      {(kind === "FULFILLMENT" || kind === "RECOMMENDATION") && (
        <OperationalSimulator
          key={JSON.stringify(draft)}
          kind={kind}
          draft={draft}
          active={activeId ? initial : null}
        />
      )}
      <p role="status" className="text-sm">
        {message}
      </p>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!pending) setOpen(v);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Publish {POLICY_META[kind].title}</DialogTitle>
            <DialogDescription>
              A new immutable version will apply to new submissions and
              revisions. {pendingCount} pending approval requests retain their
              existing policy versions
              {kind === "DISCOUNT_RISK" && activeId
                ? `, including v${version}`
                : ""}
              .
            </DialogDescription>
          </DialogHeader>
          <DiffView before={activeId ? initial : {}} after={draft} />
          <div className="space-y-2">
            <Label htmlFor="publish-reason">Reason for publication</Label>
            <Textarea
              id="publish-reason"
              value={reason}
              maxLength={1000}
              placeholder="Explain what changed and why…"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <FormError message={message} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              disabled={pending || !reason.trim() || errors.length > 0}
              onClick={() =>
                start(async () => {
                  const result = await publishPolicyAction(
                    kind,
                    draft,
                    reason,
                    activeId,
                  );
                  if (!result.ok) {
                    setMessage(result.error.message);
                    return;
                  }
                  setMessage(`Published version ${result.data.version}.`);
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              {pending ? "Publishing…" : "Publish new version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
