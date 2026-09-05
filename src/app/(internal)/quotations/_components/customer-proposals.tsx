"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { NegotiationMessage } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Check, X, Envelope, WarningCircle } from "@/components/icons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
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
  const [proposalId, setProposalId] = useState("");
  const openMessages = messages.filter(
    (m) => m.author === "CUSTOMER" && m.status === "OPEN",
  );
  const activeMessage =
    openMessages.find((m) => m.id === proposalId) ?? openMessages[0];
  const [selected, setSelected] = useState<{
    id: string;
    decision: "APPLY" | "DECLINE";
    expectedVersion: number;
    sourceVersion: number;
    body: string;
  } | null>(null);
  function respond() {
    if (!selected) return;
    start(async () => {
      const result = await respondToProposalAction({
        messageId: selected.id,
        decision: selected.decision,
        reply,
        expectedVersion: selected.expectedVersion,
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
      {/* A select plus two decisions is a form, not a toolbar button, so it
          lives in the page beside the conversation it acts on. */}
      {canRespond && activeMessage && (
        <Card>
          <CardHeader>
            <CardTitle>Respond to customer request</CardTitle>
            <CardDescription>
              Review the request against current version {version} before
              applying it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          <Label htmlFor="proposal-response">Customer request</Label>
          <Select value={activeMessage.id} onValueChange={setProposalId}>
            <SelectTrigger id="proposal-response" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {openMessages.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  v{m.quotationVersion} · {m.body.slice(0, 60)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
          <Button
            disabled={
              pending || !["SENT", "UNDER_NEGOTIATION"].includes(status)
            }
            onClick={() =>
              setSelected({
                id: activeMessage.id,
                decision: "APPLY",
                expectedVersion: version,
                sourceVersion: activeMessage.quotationVersion,
                body: activeMessage.body,
              })
            }
          >
            <Check />
            Apply request to v{version}
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              setSelected({
                id: activeMessage.id,
                decision: "DECLINE",
                expectedVersion: version,
                sourceVersion: activeMessage.quotationVersion,
                body: activeMessage.body,
              })
            }
          >
            <X />
            Decline request
          </Button>
          </div>
          </CardContent>
        </Card>
      )}
      {error ? (
        <Alert variant="destructive">
          <WarningCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Customer conversation</CardTitle>
            <CardDescription>
              {messages.length} {messages.length === 1 ? "message" : "messages"} across versions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            </article>
          ))}
          </CardContent>
        </Card>
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
                ? `Apply this request to current version ${selected.expectedVersion}, even if it was proposed on an earlier version. This creates a new revision and rechecks approval; the customer must accept the updated terms.`
                : "Your reply will appear in the customer portal."}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <p className="rounded-lg bg-muted p-3 text-sm">
              Request from v{selected.sourceVersion}: {selected.body}
            </p>
          )}
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
