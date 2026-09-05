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
export function DecisionControls({
  stepId,
  version,
  disabledReason,
}: {
  stepId?: string;
  version: number;
  disabledReason?: string;
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
          Approve step
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
                  return;
                }
                setDecision(null);
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
