"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/layout/status-badge";
import { Plus, Prohibit } from "@/components/icons";
import {
  cancelReplenishmentAction,
  createReplenishmentAction,
  receiveStockAction,
} from "@/server/actions/admin";

interface Plan {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  eta: string;
  status: string;
}

export function ReplenishmentTable({
  warehouseId,
  plans,
  products,
  canManage,
}: {
  warehouseId: string;
  plans: Plan[];
  products: { id: string; name: string; sku: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [eta, setEta] = useState("");
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const result = await createReplenishmentAction({
        warehouseId,
        productId,
        qty: Number(qty),
        eta,
      });
      if (result.ok) {
        toast.success("Replenishment planned.");
        setQty("");
        setEta("");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  function receive(plan: Plan) {
    startTransition(async () => {
      const result = await receiveStockAction({
        warehouseId,
        productId: plan.productId,
        qty: plan.qty,
        note: "Planned replenishment received",
        replenishmentPlanId: plan.id,
      });
      if (result.ok) {
        toast.success("Stock received against the plan.");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  function cancel(planId: string) {
    startTransition(async () => {
      const result = await cancelReplenishmentAction(planId, warehouseId);
      if (result.ok) {
        toast.success("Plan cancelled.");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-4 p-5">
        <div>
          <p className="font-display text-sm font-semibold">Replenishment plans</p>
          <p className="text-muted-foreground text-sm">
            The ETA here is what deal-health slippage detection reads in phase 10.
          </p>
        </div>

        {canManage ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="w-[260px]">
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
              <Label htmlFor="rp-qty">Quantity</Label>
              <Input
                id="rp-qty"
                className="w-24"
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-eta">ETA</Label>
              <Input
                id="rp-eta"
                type="datetime-local"
                className="w-[220px]"
                value={eta}
                onChange={(e) => setEta(e.target.value)}
              />
            </div>
            <Button onClick={create} disabled={pending || !qty || !eta}>
              <Plus className="size-4" /> Plan replenishment
            </Button>
          </div>
        ) : null}

        {plans.length === 0 ? (
          <p className="text-muted-foreground text-sm">No replenishment planned for this warehouse.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.productName}</TableCell>
                    <TableCell className="tabular text-right">{p.qty}</TableCell>
                    <TableCell className="tabular text-sm">
                      {new Date(p.eta).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={p.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && p.status === "PLANNED" ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => receive(p)} disabled={pending}>
                            Receive
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground"
                            onClick={() => cancel(p.id)}
                            disabled={pending}
                            aria-label="Cancel plan"
                          >
                            <Prohibit className="size-4" />
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
