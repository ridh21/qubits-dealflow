"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Plus } from "@/components/icons";
import { createCustomerAction, updateCustomerAction } from "@/server/actions/admin";

const NO_LIST = "__none__";

export interface CustomerValues {
  id?: string;
  name: string;
  tier: string;
  email: string;
  billingAddress: string;
  priceListId: string;
}

const EMPTY: CustomerValues = {
  name: "",
  tier: "BRONZE",
  email: "",
  billingAddress: "",
  priceListId: NO_LIST,
};

export function CustomerFormDialog({
  priceLists,
  customer,
}: {
  priceLists: { id: string; name: string }[];
  customer?: CustomerValues;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<CustomerValues>(customer ?? EMPTY);
  const [pending, startTransition] = useTransition();

  const editing = Boolean(customer?.id);

  function set<K extends keyof CustomerValues>(key: K, value: CustomerValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const payload = {
        name: values.name,
        tier: values.tier,
        email: values.email,
        billingAddress: values.billingAddress,
        priceListId: values.priceListId === NO_LIST ? "" : values.priceListId,
      };
      const result = editing
        ? await updateCustomerAction(customer!.id!, payload)
        : await createCustomerAction(payload);

      if (result.ok) {
        toast.success(editing ? "Customer updated." : "Customer created.");
        setOpen(false);
        if (!editing) setValues(EMPTY);
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
          {editing ? "Edit customer" : "New customer"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit customer" : "New customer"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="c-name">Company name</Label>
            <Input id="c-name" value={values.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Tier</Label>
            <Select value={values.tier} onValueChange={(v) => set("tier", v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRONZE">Bronze</SelectItem>
                <SelectItem value="SILVER">Silver</SelectItem>
                <SelectItem value="GOLD">Gold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Price list</Label>
            <Select value={values.priceListId} onValueChange={(v) => set("priceListId", v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LIST}>Base prices</SelectItem>
                {priceLists.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="c-email">Billing email</Label>
            <Input
              id="c-email"
              type="email"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="c-addr">Billing address</Label>
            <Textarea
              id="c-addr"
              rows={3}
              value={values.billingAddress}
              onChange={(e) => set("billingAddress", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || values.name.trim().length < 2}>
            {pending ? "Saving…" : editing ? "Save changes" : "Create customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
