"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowLeft, Prohibit } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { decideApprovalAction } from "@/server/actions/approvals";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import { FormError } from "@/components/layout/form-error";
import { toast } from "@/components/ui/toast";
export function DecisionControls({
  stepId,
  version,
  disabledReason,
  stepNumber,
  totalSteps,
  customerAccepted,
}: {
  stepId?: string;
  version: number;
  disabledReason?: string;
  /** 1-based position of the step awaiting this reviewer. */
  stepNumber?: number;
  totalSteps?: number;
  /** The customer has already accepted; the last approval confirms the order. */
  customerAccepted?: boolean;
}) {
  const [decision, setDecision] = useState<
      "APPROVE" | "REJECT" | "RETURN" | null
    >(null),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [pending, start] = useTransition(),
    router = useRouter();
  return (
    <>
      <WorkspaceActions>
        <Button
          disabled={!!disabledReason || !stepId}
          onClick={() => setDecision("APPROVE")}
        >
          <Check />
          {stepNumber && totalSteps && totalSteps > 1
            ? `Approve step ${stepNumber} of ${totalSteps}`
            : "Approve"}
        </Button>
        <Button
          variant="outline"
          disabled={!!disabledReason || !stepId}
          onClick={() => setDecision("RETURN")}
        >
          <ArrowLeft />
          Request revision
        </Button>
        <Button
          variant="destructive"
          disabled={!!disabledReason || !stepId}
          onClick={() => setDecision("REJECT")}
        >
          <Prohibit />
          Reject
        </Button>
        {disabledReason && (
          <p className="text-xs text-muted-foreground">{disabledReason}</p>
        )}
      </WorkspaceActions>
      <Dialog
        open={!!decision}
        onOpenChange={(open) => {
          if (!open && !pending) setDecision(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision === "APPROVE"
                ? "Approve this step"
                : decision === "RETURN"
                  ? "Request a revision"
                  : "Reject quotation"}
            </DialogTitle>
            <DialogDescription>
              Your decision is recorded against version {version}. A reason is
              required for rejection or revision.
            </DialogDescription>
            {decision === "APPROVE" && (
              <p className="text-muted-foreground text-sm">
                {stepNumber && totalSteps && stepNumber < totalSteps
                  ? `This clears step ${stepNumber} of ${totalSteps}. The quotation stays in approval until the remaining ${totalSteps - stepNumber === 1 ? "step is" : "steps are"} cleared.`
                  : customerAccepted
                    ? "This is the last step, and the customer has already accepted — approving confirms the order straight away."
                    : "This is the last step. The quotation goes back to the customer for acceptance."}
              </p>
            )}
          </DialogHeader>
          <Textarea
            aria-label="Decision note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <FormError message={error} />
          <Button
            disabled={pending || (decision !== "APPROVE" && !note.trim())}
            onClick={() =>
              start(async () => {
                const result = await decideApprovalAction({
                  stepId,
                  expectedVersion: version,
                  decision,
                  note,
                });
                if (!result.ok) {
                  setError(result.error.message);
                  toast.error(result.error.message);
                  return;
                }
                const d = result.data;
                if (d.decision === "REJECT") {
                  toast.success(`${d.quotationNumber} rejected.`);
                } else if (d.decision === "RETURN") {
                  toast.success(`${d.quotationNumber} returned for revision.`);
                } else if (d.nextRole) {
                  toast.success(
                    `Step ${d.stepNumber} of ${d.totalSteps} approved — now with ${d.nextRole.replaceAll("_", " ").toLowerCase()}.`,
                  );
                } else if (d.orderId) {
                  toast.success(
                    `${d.quotationNumber} approved — order confirmed.`,
                  );
                } else {
                  toast.success(
                    `${d.quotationNumber} approved — sent to the customer for acceptance.`,
                  );
                }
                setDecision(null);
                setNote("");
                setError("");
                router.refresh();
              })
            }
          >
            {pending ? "Recording…" : "Record decision"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
