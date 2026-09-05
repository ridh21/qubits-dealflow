"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PortalQuote } from "@/server/portal/select";
import {
  acceptQuotationAction,
  submitProposalsAction,
  withdrawProposalAction,
} from "@/server/actions/portal";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { DatePicker } from "@/components/forms/date-picker";
import { Check, Envelope, X } from "@/components/icons";
import { formatMinor } from "@/domain/money/money";
export function PortalQuoteWorkspace({ quote: q }: { quote: PortalQuote }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<"request" | "accept" | null>(null);
  const [lineId, setLine] = useState("general");
  const [body, setBody] = useState("");
  const [qty, setQty] = useState("");
  const [discount, setDiscount] = useState("");
  const [date, setDate] = useState<Date>();
  const expired = !!q.validUntil && new Date(q.validUntil) < new Date();
  const open = q.messages.filter(
    (m) =>
      m.author === "CUSTOMER" &&
      m.status === "OPEN" &&
      m.quotationVersion === q.version,
  );
  const canAccept =
    !expired &&
    !open.length &&
    ["SENT", "UNDER_NEGOTIATION", "PENDING_APPROVAL"].includes(q.status);
  const summary = (kind: string) =>
    q.lines
      .filter((l) => l.product.type === kind)
      .reduce((sum, l) => sum + l.netMinor + l.taxMinor, 0);
  function submit() {
    start(async () => {
      const result =
        dialog === "accept"
          ? await acceptQuotationAction({ id: q.id, version: q.version })
          : await submitProposalsAction({
              id: q.id,
              version: q.version,
              proposals: [
                {
                  body,
                  lineId: lineId === "general" ? undefined : lineId,
                  proposedQty:
                    lineId !== "general" && qty !== ""
                      ? Number(qty)
                      : undefined,
                  counterDiscountBp:
                    lineId !== "general" && discount !== ""
                      ? Math.round(Number(discount) * 100)
                      : undefined,
                  requestedDeliveryDate: date,
                },
              ],
            });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError("");
      setDialog(null);
      router.refresh();
    });
  }
  return (
    <>
      <WorkspaceActions>
        <Button
          disabled={pending || !canAccept}
          onClick={() => setDialog("accept")}
        >
          <Check />
          Accept quotation v{q.version}
        </Button>
        <Button
          variant="outline"
          disabled={
            pending ||
            expired ||
            !["SENT", "UNDER_NEGOTIATION"].includes(q.status)
          }
          onClick={() => setDialog("request")}
        >
          <Envelope />
          Request changes
        </Button>
        <Button variant="outline" asChild>
          <Link href="/portal">Back to quotations</Link>
        </Button>
      </WorkspaceActions>
      <PageHeader
        title={`${q.number} · v${q.version}`}
        description={
          expired
            ? "This quotation has expired."
            : q.order
              ? `Confirmed — Order ${q.order.number}`
              : q.status === "PENDING_APPROVAL"
                ? "Awaiting internal approval"
                : q.approvedVersion === q.version
                  ? "Ready to accept"
                  : "Under negotiation"
        }
      />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {open.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Wait for a response or withdraw your open requests before accepting.
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {[
              "Product / plan",
              "Quantity",
              "Unit price",
              "Discount",
              "Total",
            ].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.lines.map((l) => (
            <TableRow key={l.id}>
              <TableCell>
                {l.productName}
                {l.variantLabel && (
                  <p className="text-xs text-muted-foreground">
                    {l.variantLabel}
                  </p>
                )}
                {l.plan && (
                  <p className="text-xs text-muted-foreground">
                    {l.plan.tier?.name} · {l.plan.interval.toLowerCase()}
                  </p>
                )}
              </TableCell>
              <TableCell>{l.qty}</TableCell>
              <TableCell>{formatMinor(l.unitPriceMinor, q.currency)}</TableCell>
              <TableCell>{l.effectiveDiscountBp / 100}%</TableCell>
              <TableCell>
                {formatMinor(l.netMinor + l.taxMinor, q.currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <section className="space-y-2 rounded-xl border p-6">
        <h2 className="font-semibold">Billing preview</h2>
        <p>
          Goods: {formatMinor(summary("PHYSICAL"), q.currency)} billed on
          dispatch.
        </p>
        <p>
          Services: {formatMinor(summary("SERVICE"), q.currency)} billed on
          completion.
        </p>
        {["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"].map((cycle) => {
          const lines = q.lines.filter((l) => l.interval === cycle);
          return lines.length ? (
            <p key={cycle}>
              {formatMinor(
                lines.reduce((sum, l) => sum + l.netMinor + l.taxMinor, 0),
                q.currency,
              )}{" "}
              {cycle.toLowerCase()} from activation.
            </p>
          ) : null;
        })}
      </section>
      <section className="space-y-4">
        <h2 className="font-semibold">Conversation</h2>
        {q.messages.map((m) => (
          <article key={m.id} className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">
              {m.author.toLowerCase()} · v{m.quotationVersion} ·{" "}
              {m.status.toLowerCase()}
            </p>
            <p className="whitespace-pre-wrap">{m.body}</p>
            {m.author === "CUSTOMER" &&
              m.status === "OPEN" &&
              m.quotationVersion === q.version && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const result = await withdrawProposalAction({
                        messageId: m.id,
                      });
                      if (!result.ok) setError(result.error.message);
                      else router.refresh();
                    })
                  }
                >
                  <X />
                  Withdraw request
                </Button>
              )}
          </article>
        ))}
      </section>
      <Dialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open && !pending) setDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "accept"
                ? `Accept ${q.number} v${q.version}`
                : "Request changes"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "accept"
                ? `You are accepting the displayed version with an initial total of ${formatMinor(q.totalMinor, q.currency)}. Recurring charges repeat by cycle. ${q.approvedVersion !== q.version ? "Your order will be created after internal approval." : "An order will be created."}`
                : "Requests do not change your quotation until reviewed. You'll review and accept any updated version."}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {dialog === "request" && (
            <div className="space-y-4">
              <Select value={lineId} onValueChange={setLine}>
                <SelectTrigger aria-label="Request for">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General request</SelectItem>
                  {q.lines.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.productName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lineId !== "general" && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    Requested quantity
                    <Input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    Counter discount %
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                    />
                  </label>
                </div>
              )}
              <DatePicker
                label="Requested delivery date"
                value={date}
                onChange={setDate}
              />
              <Textarea
                aria-label="Your request"
                placeholder="Tell us what you'd like to change"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          )}
          <Button
            disabled={pending || (dialog === "request" && !body.trim())}
            onClick={submit}
          >
            <Check />
            {pending
              ? "Saving…"
              : dialog === "accept"
                ? "Confirm acceptance"
                : "Submit request"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
