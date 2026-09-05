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
import { Plus, SlidersHorizontal } from "@/components/icons";
import { adjustStockAction, receiveStockAction } from "@/server/actions/admin";

interface Product {
  id: string;
  name: string;
  sku: string;
}

export function StockDialogs({
  warehouseId,
  products,
}: {
  warehouseId: string;
  products: Product[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"receive" | "adjust" | null>(null);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function close() {
    setMode(null);
    setQty("");
    setNote("");
  }

  function submit() {
    startTransition(async () => {
      const result =
        mode === "receive"
          ? await receiveStockAction({ warehouseId, productId, qty: Number(qty), note })
          : await adjustStockAction({ warehouseId, productId, delta: Number(qty), reason: note });

      if (result.ok) {
        toast.success(mode === "receive" ? "Stock received." : "Stock adjusted.");
        close();
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  const receiving = mode === "receive";

  return (
    <>
      <Button variant="outline" onClick={() => setMode("adjust")}>
        <SlidersHorizontal className="size-4" /> Adjust
      </Button>
      <Button onClick={() => setMode("receive")}>
        <Plus className="size-4" /> Receive stock
      </Button>

      <Dialog open={mode !== null} onOpenChange={(o) => (o ? null : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{receiving ? "Receive stock" : "Adjust stock"}</DialogTitle>
            <DialogDescription>
              {receiving
                ? "Adds to on-hand and writes a RECEIPT movement."
                : "Use a negative number to write stock off. On-hand can never fall below what is already reserved."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.sku}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="st-qty">{receiving ? "Quantity received" : "Adjustment"}</Label>
              <Input
                id="st-qty"
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder={receiving ? "10" : "-2"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="st-note">{receiving ? "Note" : "Reason"}</Label>
              <Textarea
                id="st-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={receiving ? "PO-1042 delivery" : "Damaged in transit"}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={pending || !qty || (!receiving && note.trim().length < 3)}
            >
              {pending ? "Saving…" : receiving ? "Receive" : "Adjust"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
