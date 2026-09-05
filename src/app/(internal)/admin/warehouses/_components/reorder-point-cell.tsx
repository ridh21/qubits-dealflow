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
import { setReorderPointAction } from "@/server/actions/admin";

export function ReorderPointCell({
  warehouseId,
  productId,
  productName,
  reorderPoint,
  canManage,
}: {
  warehouseId: string;
  productId: string;
  productName: string;
  reorderPoint: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(reorderPoint));
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await setReorderPointAction({
        warehouseId,
        productId,
        reorderPoint: Number(value),
      });
      if (result.ok) {
        toast.success("Reorder point updated.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  if (!canManage) {
    return <span className="tabular">{reorderPoint}</span>;
  }
  return (
    <>
      <Button
        variant="link"
        className="tabular h-auto p-0 font-normal underline-offset-4 hover:underline"
        onClick={() => {
          setValue(String(reorderPoint));
          setOpen(true);
        }}
      >
        {reorderPoint}
      </Button>
      <Dialog open={open} onOpenChange={(o) => (o ? null : setOpen(false))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set reorder point</DialogTitle>
            <DialogDescription>
              Deal-health flags this product for replenishment once available stock
              falls to this level.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rp-value">{productName}</Label>
            <Input
              id="rp-value"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="10"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={pending || value === "" || !Number.isInteger(Number(value)) || Number(value) < 0}
            >
              {pending ? "Saving…" : "Save reorder point"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
