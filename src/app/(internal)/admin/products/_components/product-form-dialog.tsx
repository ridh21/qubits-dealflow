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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Plus } from "@/components/icons";
import { createProductAction, updateProductAction } from "@/server/actions/admin";

export interface ProductValues {
  id?: string;
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  type: string;
  unit: string;
  basePrice: string;
  costPrice: string;
  taxPercent: string;
  minMarginPercent: string;
  isPromoted: boolean;
}

function emptyValues(categoryId: string): ProductValues {
  return {
    sku: "",
    name: "",
    description: "",
    categoryId,
    type: "PHYSICAL",
    unit: "Each",
    basePrice: "",
    costPrice: "",
    taxPercent: "0",
    minMarginPercent: "0",
    isPromoted: false,
  };
}

const toMinor = (v: string) => Math.round((Number(v) || 0) * 100);
const toBp = (v: string) => Math.round((Number(v) || 0) * 100);

export function ProductFormDialog({
  categories,
  product,
}: {
  categories: { id: string; name: string }[];
  product?: ProductValues;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ProductValues>(
    product ?? emptyValues(categories[0]?.id ?? ""),
  );
  const [pending, startTransition] = useTransition();

  const editing = Boolean(product?.id);

  function set<K extends keyof ProductValues>(key: K, value: ProductValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const payload = {
        sku: values.sku.trim(),
        name: values.name.trim(),
        description: values.description,
        categoryId: values.categoryId,
        type: values.type,
        unit: values.unit || "Each",
        basePriceMinor: toMinor(values.basePrice),
        costPriceMinor: toMinor(values.costPrice),
        taxBp: toBp(values.taxPercent),
        minMarginBp: toBp(values.minMarginPercent),
        isPromoted: values.isPromoted,
      };
      const result = editing
        ? await updateProductAction(product!.id!, payload)
        : await createProductAction(payload);

      if (result.ok) {
        toast.success(editing ? "Product updated." : "Product created.");
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
          {editing ? "Edit product" : "New product"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="p-sku">SKU</Label>
            <Input id="p-sku" value={values.sku} onChange={(e) => set("sku", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" value={values.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={values.categoryId} onValueChange={(v) => set("categoryId", v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={values.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PHYSICAL">Physical — holds stock</SelectItem>
                <SelectItem value="SERVICE">Service — bills on completion</SelectItem>
                <SelectItem value="SUBSCRIPTION">Subscription — bills per cycle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-price">List price</Label>
            <Input
              id="p-price"
              inputMode="decimal"
              value={values.basePrice}
              onChange={(e) => set("basePrice", e.target.value)}
              placeholder="1200.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-cost">Cost price</Label>
            <Input
              id="p-cost"
              inputMode="decimal"
              value={values.costPrice}
              onChange={(e) => set("costPrice", e.target.value)}
              placeholder="900.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-tax">Tax %</Label>
            <Input
              id="p-tax"
              inputMode="decimal"
              value={values.taxPercent}
              onChange={(e) => set("taxPercent", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-margin">Minimum margin %</Label>
            <Input
              id="p-margin"
              inputMode="decimal"
              value={values.minMarginPercent}
              onChange={(e) => set("minMarginPercent", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-unit">Unit</Label>
            <Input id="p-unit" value={values.unit} onChange={(e) => set("unit", e.target.value)} />
          </div>

          <div className="flex items-center justify-between gap-3 pt-6">
            <Label htmlFor="p-promoted" className="cursor-pointer">
              Promoted in upsell
            </Label>
            <Switch
              id="p-promoted"
              checked={values.isPromoted}
              onCheckedChange={(v) => set("isPromoted", v)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea
              id="p-desc"
              rows={3}
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !values.sku || !values.name}>
            {pending ? "Saving…" : editing ? "Save changes" : "Create product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
