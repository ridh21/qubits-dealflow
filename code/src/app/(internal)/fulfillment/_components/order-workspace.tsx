"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { getFulfillment } from "@/server/queries/fulfillment";
import {
  proposePlanAction,
  acceptPlanAction,
  shipAction,
  completeServiceAction,
  consolidateAction,
  decideConsolidationAction,
  overridePlanAction,
} from "@/server/actions/fulfillment";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Truck, Check, Package, Repeat, Pencil } from "@/components/icons";
import { formatMinor } from "@/domain/money/money";
import type { ActionResult } from "@/domain/errors";
export function OrderWorkspace({
  data: { order: o, actor, warehouses },
}: {
  data: Awaited<ReturnType<typeof getFulfillment>>;
}) {
  const [error, setError] = useState(""),
    [pending, start] = useTransition(),
    [override, setOverride] = useState(false),
    [note, setNote] = useState(""),
    [allocations, setAllocations] = useState(
      o.plan?.allocations.map((a) => ({
        orderLineId: a.orderLineId,
        warehouseId: a.warehouseId,
        qty: a.qty,
      })) ?? [],
    ),
    router = useRouter(),
    ops = ["ADMIN", "FINANCE"].includes(actor.role);
  function run(fn: () => Promise<ActionResult<unknown>>) {
    start(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError("");
      setOverride(false);
      router.refresh();
    });
  }
  return (
    <>
      <WorkspaceActions>
        {ops && !o.plan && (
          <Button
            disabled={pending}
            onClick={() => run(() => proposePlanAction({ orderId: o.id }))}
          >
            <Package />
            Suggest allocation
          </Button>
        )}
        {ops && o.plan?.status === "SUGGESTED" && (
          <>
            <Button
              disabled={pending}
              onClick={() =>
                run(() =>
                  acceptPlanAction({ orderId: o.id, planId: o.plan!.id }),
                )
              }
            >
              <Check />
              Accept & reserve stock
            </Button>
            <Button variant="outline" onClick={() => setOverride(true)}>
              <Pencil />
              Manual allocation
            </Button>
          </>
        )}
        <Button variant="outline" onClick={() => router.refresh()}>
          <Repeat />
          Reload stock
        </Button>
      </WorkspaceActions>
      <p role="alert" className="text-destructive text-sm">
        {error}
      </p>
      {o.plan && (
        <p className="rounded-lg border p-4">
          {o.plan.status} · {o.plan.estimatedShipments} estimated shipments ·{" "}
          {formatMinor(o.plan.estimatedCostMinor, o.currency)} estimated
          shipping
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {["Line", "Kind", "Ordered", "Shipped", "Invoiced"].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {o.lines.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{l.productName}</TableCell>
              <TableCell>{l.kind}</TableCell>
              <TableCell>{l.qty}</TableCell>
              <TableCell>{l.qtyShipped}</TableCell>
              <TableCell>{l.qtyInvoiced}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <section className="space-y-3">
        <h2 className="font-semibold">Allocations</h2>
        {o.plan?.allocations.map((a) => (
          <p key={a.id} className="rounded-lg border p-4">
            {a.warehouse.name} · {a.orderLine.productName} · {a.qty} units ·{" "}
            {a.reserved ? "Reserved" : "Not reserved"} · {a.qtyShipped} shipped
          </p>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Shipments</h2>
        {o.shipments.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
          >
            <p>
              {s.number} · {s.warehouse.name} · {s.status}
            </p>
            {ops && s.status === "PLANNED" && (
              <Button
                disabled={pending}
                onClick={() => run(() => shipAction({ shipmentId: s.id }))}
              >
                <Truck />
                Mark dispatched
              </Button>
            )}
          </div>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Services</h2>
        {o.lines
          .filter((l) => l.kind === "SERVICE")
          .map((l) => (
            <div
              key={l.id}
              className="flex justify-between gap-4 rounded-lg border p-4"
            >
              <p>
                {l.productName} ·{" "}
                {l.completion ? "Completed" : "Awaiting completion"}
              </p>
              {ops && !l.completion && (
                <Button
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      completeServiceAction({
                        lineId: l.id,
                        note: "Service completion recorded by operations",
                      }),
                    )
                  }
                >
                  <Check />
                  Record completion
                </Button>
              )}
            </div>
          ))}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Backorders</h2>
        {o.lines.flatMap((l) =>
          l.backorders
            .filter((b) =>
              ["OPEN", "CONSOLIDATION_SUGGESTED"].includes(b.status),
            )
            .map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap justify-between gap-4 rounded-lg border p-4"
              >
                <p>
                  {l.productName} · {b.qty} outstanding
                </p>
                {b.status === "CONSOLIDATION_SUGGESTED" &&
                  b.suggestedWarehouseId &&
                  b.suggestedQty && (
                    <div className="space-y-2">
                      <p>
                        Suggested: {b.suggestedQty} units from{" "}
                        {warehouses.find((w) => w.id === b.suggestedWarehouseId)
                          ?.name ?? "unavailable warehouse"}
                        . Nothing reserved yet.
                      </p>
                      {ops && (
                        <div className="flex gap-2">
                          <Button
                            disabled={pending}
                            onClick={() =>
                              run(() =>
                                decideConsolidationAction({
                                  backorderId: b.id,
                                  decision: "ACCEPT",
                                  warehouseId: b.suggestedWarehouseId,
                                  qty: b.suggestedQty,
                                }),
                              )
                            }
                          >
                            <Check />
                            Accept suggestion
                          </Button>
                          <Button
                            variant="outline"
                            disabled={pending}
                            onClick={() =>
                              run(() =>
                                decideConsolidationAction({
                                  backorderId: b.id,
                                  decision: "DECLINE",
                                  warehouseId: b.suggestedWarehouseId,
                                  qty: b.suggestedQty,
                                }),
                              )
                            }
                          >
                            Decline suggestion
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                {ops && (
                  <ConsolidationControls
                    key={`${b.id}:${b.suggestedWarehouseId}:${b.suggestedQty}`}
                    backorder={b}
                    productId={l.productId}
                    warehouses={warehouses}
                    disabled={
                      pending || !o.plan || o.plan.status === "SUGGESTED"
                    }
                    onReserve={(warehouseId, qty) =>
                      run(() =>
                        consolidateAction({
                          backorderId: b.id,
                          warehouseId,
                          qty,
                        }),
                      )
                    }
                  />
                )}
              </div>
            )),
        )}
      </section>
      <Dialog open={override} onOpenChange={setOverride}>
        <DialogContent className="max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Manual allocation</DialogTitle>
            <DialogDescription>
              Change quantities and warehouses. Availability is checked before
              reservation.
            </DialogDescription>
          </DialogHeader>
          {allocations.map((a, i) => (
            <div key={i} className="space-y-2">
              <p>{o.lines.find((l) => l.id === a.orderLineId)?.productName}</p>
              <Select
                value={a.warehouseId}
                onValueChange={(v) =>
                  setAllocations(
                    allocations.map((x, j) =>
                      j === i ? { ...x, warehouseId: v } : x,
                    ),
                  )
                }
              >
                <SelectTrigger aria-label={`Warehouse for allocation ${i + 1}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                aria-label={`Quantity for allocation ${i + 1}`}
                type="number"
                min={0}
                value={a.qty}
                onChange={(e) =>
                  setAllocations(
                    allocations.map((x, j) =>
                      j === i ? { ...x, qty: Number(e.target.value) } : x,
                    ),
                  )
                }
              />
            </div>
          ))}
          <Textarea
            aria-label="Allocation reason"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <p role="alert">{error}</p>
          <Button
            disabled={pending || !note.trim()}
            onClick={() =>
              run(() =>
                overridePlanAction({
                  orderId: o.id,
                  allocations: allocations.filter((a) => a.qty > 0),
                  note,
                }),
              )
            }
          >
            Save allocation
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

type FulfillmentData = Awaited<ReturnType<typeof getFulfillment>>;
type OpenBackorder =
  FulfillmentData["order"]["lines"][number]["backorders"][number];
function ConsolidationControls({
  backorder,
  productId,
  warehouses,
  disabled,
  onReserve,
}: {
  backorder: OpenBackorder;
  productId: string;
  warehouses: FulfillmentData["warehouses"];
  disabled: boolean;
  onReserve: (warehouseId: string, qty: number) => void;
}) {
  const [warehouseId, setWarehouseId] = useState(
    backorder.suggestedWarehouseId ?? warehouses[0]?.id ?? "",
  );
  const [enteredQty, setEnteredQty] = useState<string | null>(null);
  const warehouse = warehouses.find((w) => w.id === warehouseId);
  const stock = warehouse?.stockLevels.find(
    (level) => level.productId === productId,
  );
  const available = Math.max(0, (stock?.onHand ?? 0) - (stock?.reserved ?? 0));
  const maxQty = Math.min(backorder.qty, available);
  const qty = enteredQty === null ? maxQty : Number(enteredQty);
  const valid = Number.isInteger(qty) && qty > 0 && qty <= maxQty;
  return (
    <div className="space-y-2">
      <Select
        value={warehouseId}
        onValueChange={(id) => {
          setWarehouseId(id);
          setEnteredQty(null);
        }}
        disabled={disabled}
      >
        <SelectTrigger aria-label="Consolidation warehouse">
          <SelectValue placeholder="Choose warehouse" />
        </SelectTrigger>
        <SelectContent>
          {warehouses.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-sm text-muted-foreground">
        {available} available · up to {maxQty} units can be reserved
      </p>
      <Input
        aria-label="Consolidation quantity"
        type="number"
        min={1}
        max={maxQty}
        step={1}
        value={enteredQty ?? maxQty}
        disabled={disabled || maxQty === 0}
        onChange={(event) => setEnteredQty(event.target.value)}
      />
      <Button
        variant="outline"
        disabled={disabled || !warehouse || !valid}
        onClick={() => onReserve(warehouseId, qty)}
      >
        <Package />
        Reserve {valid ? qty : "selected"} units
      </Button>
    </div>
  );
}
