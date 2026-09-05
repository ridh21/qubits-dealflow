"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencySelect } from "@/components/forms/currency-select";
import { Pencil, Plus } from "@/components/icons";
import { DEFAULT_CURRENCY } from "@/domain/money/money";
import { createPriceListAction, updatePriceListAction } from "@/server/actions/admin";

const ANY_TIER = "__any__";

export interface PriceListValues {
  id?: string;
  name: string;
  currency: string;
  tier: string;
  rule: string;
  percentOff: string;
}

const EMPTY: PriceListValues = {
  name: "",
  currency: DEFAULT_CURRENCY,
  tier: ANY_TIER,
  rule: "NO_ADJUSTMENT",
  percentOff: "0",
};

export function PriceListFormDialog({ list }: { list?: PriceListValues }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<PriceListValues>(list ?? EMPTY);
  const [pending, startTransition] = useTransition();

  const editing = Boolean(list?.id);

  function set<K extends keyof PriceListValues>(key: K, value: PriceListValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const payload = {
        name: values.name,
        currency: values.currency.toUpperCase(),
        tier: values.tier === ANY_TIER ? "" : values.tier,
        rule: values.rule,
        percentOffBp: Math.round((Number(values.percentOff) || 0) * 100),
      };
      const result = editing
        ? await updatePriceListAction(list!.id!, payload)
        : await createPriceListAction(payload);

      if (result.ok) {
        toast.success(editing ? "Price list published as a new version." : "Price list created.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={editing ? "outline" : "default"}>
          {editing ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          {editing ? "Edit price list" : "New price list"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit price list" : "New price list"}</DialogTitle>
          <DialogDescription>
            Saving bumps the version. Existing quotes keep the price they were built with.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="pl-name">Name</Label>
            <Input id="pl-name" value={values.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pl-currency">Currency</Label>
            <CurrencySelect
              id="pl-currency"
              value={values.currency}
              onChange={(v) => set("currency", v)}
            />
          </div>

          <div className="space-y-2">
            <Label>Applies to tier</Label>
            <Select value={values.tier} onValueChange={(v) => set("tier", v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_TIER}>Any tier</SelectItem>
                <SelectItem value="BRONZE">Bronze</SelectItem>
                <SelectItem value="SILVER">Silver</SelectItem>
                <SelectItem value="GOLD">Gold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Rule</Label>
            <Select value={values.rule} onValueChange={(v) => set("rule", v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NO_ADJUSTMENT">List price, per-item overrides</SelectItem>
                <SelectItem value="PERCENT_OFF_BASE">% off base price</SelectItem>
                <SelectItem value="FIXED_ITEMS">Fixed item prices</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pl-pct">Percent off</Label>
            <Input
              id="pl-pct"
              inputMode="decimal"
              disabled={values.rule !== "PERCENT_OFF_BASE"}
              value={values.percentOff}
              onChange={(e) => set("percentOff", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || values.name.trim().length < 2}>
            {pending ? "Saving…" : editing ? "Publish new version" : "Create price list"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
