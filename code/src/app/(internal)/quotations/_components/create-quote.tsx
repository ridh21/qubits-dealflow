"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createQuoteAction } from "@/server/actions/quotations";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
export function CreateQuote({
  customers,
}: {
  customers: { id: string; name: string; tier: string }[];
}) {
  const [id, setId] = useState(""),
    [error, setError] = useState(""),
    [pending, start] = useTransition(),
    router = useRouter();
  return (
    <form
      className="max-w-lg space-y-4 rounded-xl border p-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createQuoteAction({ customerId: id });
          if (r.ok) router.push(`/quotations/${r.data.id}`);
          else setError(r.error.message);
        });
      }}
    >
      <Label>Customer</Label>
      <Select value={id} onValueChange={setId}>
        <SelectTrigger aria-label="Customer">
          <SelectValue placeholder="Choose a customer" />
        </SelectTrigger>
        <SelectContent>
          {customers.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name} · {c.tier}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-sm text-muted-foreground">
        The customer’s tier and price list determine catalogue pricing and
        discount ceilings.
      </p>
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
      <Button disabled={!id || pending} type="submit">
        {pending ? "Creating…" : "Create quotation"}
      </Button>
    </form>
  );
}
