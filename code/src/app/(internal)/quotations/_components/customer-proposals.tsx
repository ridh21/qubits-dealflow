"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { NegotiationMessage } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Check, X, Envelope } from "@/components/icons";
import {
  respondToProposalAction,
  sendToCustomerAction,
} from "@/server/actions/negotiation";
export function CustomerProposals({
  id,
  version,
  status,
  messages,
  canRespond,
}: {
  id: string;
  version: number;
  status: string;
  messages: NegotiationMessage[];
  canRespond: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [selected, setSelected] = useState<{
    id: string;
    decision: "APPLY" | "DECLINE";
  } | null>(null);
  function respond() {
    if (!selected) return;
    start(async () => {
      const result = await respondToProposalAction({
        messageId: selected.id,
        decision: selected.decision,
        reply,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSelected(null);
      setReply("");
      setError("");
      router.refresh();
    });
  }
  return (
    <>
      {canRespond && status === "APPROVED" && (
        <WorkspaceActions>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await sendToCustomerAction({
                  id,
                  expectedVersion: version,
                });
                if (!result.ok) setError(result.error.message);
                else router.refresh();
              })
            }
          >
            <Envelope />
            Send to customer
          </Button>
        </WorkspaceActions>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {messages.length > 0 && (
        <section className="space-y-4 rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Customer conversation</h2>
          {messages.map((message) => (
            <article
              key={message.id}
              className="space-y-2 border-b pb-4 last:border-0"
            >
              <p className="text-xs text-muted-foreground">
                {message.author.toLowerCase()} · v{message.quotationVersion} ·{" "}
                {message.status.toLowerCase()}
              </p>
              <p className="whitespace-pre-wrap text-sm">{message.body}</p>
              {message.proposedQty !== null && (
                <p className="text-sm">
                  Requested quantity: {message.proposedQty}
                </p>
              )}
              {message.counterDiscountBp !== null && (
                <p className="text-sm">
                  Requested discount: {message.counterDiscountBp / 100}%
                </p>
              )}
              {message.requestedDeliveryDate && (
                <p className="text-sm">
                  Requested delivery:{" "}
                  {new Date(message.requestedDeliveryDate).toLocaleDateString()}
                </p>
              )}
              {canRespond &&
                message.author === "CUSTOMER" &&
                message.status === "OPEN" &&
                message.quotationVersion === version &&
                ["SENT", "UNDER_NEGOTIATION"].includes(status) && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        setSelected({ id: message.id, decision: "APPLY" })
                      }
                    >
                      <Check />
                      Apply proposal
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setSelected({ id: message.id, decision: "DECLINE" })
                      }
                    >
                      <X />
                      Decline
                    </Button>
                  </div>
                )}
            </article>
          ))}
        </section>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!pending && !open) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected?.decision === "APPLY"
                ? "Apply customer proposal"
                : "Decline customer proposal"}
            </DialogTitle>
            <DialogDescription>
              {selected?.decision === "APPLY"
                ? "This creates a new quotation version and checks its approval requirements. The customer must accept the updated terms."
                : "Your reply will appear in the customer portal."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Reply to customer"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <Button disabled={pending || !reply.trim()} onClick={respond}>
            <Check />
            {pending ? "Saving…" : "Confirm response"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
