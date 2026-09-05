"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Pencil, Plus } from "@/components/icons";
import { createWarehouseAction, updateWarehouseAction } from "@/server/actions/admin";

export interface WarehouseValues {
  id?: string;
  name: string;
  code: string;
  perUnit: string;
  fixed: string;
  priority: string;
}

const EMPTY: WarehouseValues = { name: "", code: "", perUnit: "0", fixed: "0", priority: "0" };

export function WarehouseFormDialog({ warehouse }: { warehouse?: WarehouseValues }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<WarehouseValues>(warehouse ?? EMPTY);
  const [pending, startTransition] = useTransition();

  const editing = Boolean(warehouse?.id);

  function set<K extends keyof WarehouseValues>(key: K, value: WarehouseValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const payload = {
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        shippingCostWeightMinor: Math.round((Number(values.perUnit) || 0) * 100),
        fixedShipmentCostMinor: Math.round((Number(values.fixed) || 0) * 100),
        priority: Number(values.priority) || 0,
      };
      const result = editing
        ? await updateWarehouseAction(warehouse!.id!, payload)
        : await createWarehouseAction(payload);

      if (result.ok) {
        toast.success(editing ? "Warehouse updated." : "Warehouse created.");
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
          {editing ? "Edit warehouse" : "New warehouse"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit warehouse" : "New warehouse"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="w-name">Name</Label>
            <Input id="w-name" value={values.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="w-code">Code</Label>
            <Input
              id="w-code"
              value={values.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              placeholder="MAIN"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="w-unit">Shipping cost per unit</Label>
            <Input
              id="w-unit"
              inputMode="decimal"
              value={values.perUnit}
              onChange={(e) => set("perUnit", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="w-fixed">Fixed cost per shipment</Label>
            <Input
              id="w-fixed"
              inputMode="decimal"
              value={values.fixed}
              onChange={(e) => set("fixed", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="w-priority">Priority</Label>
            <Input
              id="w-priority"
              inputMode="numeric"
              value={values.priority}
              onChange={(e) => set("priority", e.target.value)}
            />
            <p className="text-muted-foreground text-xs">Lower wins ties in the split optimiser.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !values.name || !values.code}>
            {pending ? "Saving…" : editing ? "Save changes" : "Create warehouse"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
