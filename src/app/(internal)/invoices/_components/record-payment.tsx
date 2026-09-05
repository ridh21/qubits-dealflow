"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CurrencyInr } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/forms/money-input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import { recordPaymentAction } from "@/server/actions/payments";
import { FormError } from "@/components/layout/form-error";
export function RecordPayment({
  invoiceId,
  balance,
}: {
  invoiceId: string;
  balance: number;
}) {
  const [open, setOpen] = useState(false),
    [amount, setAmount] = useState(balance),
    [method, setMethod] = useState("BANK_TRANSFER"),
    [reference, setReference] = useState(""),
    [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [pending, start] = useTransition(),
    router = useRouter();
  return (
    <>
      <WorkspaceActions>
        <Button
          disabled={!balance}
          onClick={() => {
            setAmount(balance);
            setKey(crypto.randomUUID());
            setOpen(true);
          }}
        >
          <CurrencyInr />
          Record payment
        </Button>
      </WorkspaceActions>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!pending) setOpen(v);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              The amount must not exceed the remaining balance. Repeated
              submission records one payment.
            </DialogDescription>
          </DialogHeader>
          <MoneyInput
            aria-label="Payment amount"
            value={amount}
            onChange={setAmount}
          />
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger aria-label="Payment method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["BANK_TRANSFER", "CARD", "CASH", "OTHER"].map((m) => (
                <SelectItem key={m} value={m}>
                  {m.replaceAll("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label="Payment reference"
            placeholder="Reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <FormError message={error} />
          <Button
            disabled={pending || amount <= 0 || amount > balance}
            onClick={() =>
              start(async () => {
                const r = await recordPaymentAction({
                  invoiceId,
                  amountMinor: amount,
                  method,
                  reference,
                  idempotencyKey: key,
                });
                if (!r.ok) {
                  setError(r.error.message);
                  return;
                }
                setOpen(false);
                router.refresh();
              })
            }
          >
            {pending ? "Recording…" : "Record payment"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
