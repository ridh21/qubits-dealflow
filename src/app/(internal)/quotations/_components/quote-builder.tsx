"use client";
import { useState, useTransition, useEffect } from "react";
import { submitQuoteAction } from "@/server/actions/approvals";
import { PaperPlaneTilt } from "@/components/icons";
import { useRouter } from "next/navigation";
import { VersionHistory } from "./version-history";
import { CustomerPicker, type CustomerOption } from "./customer-picker";
import {
  canEditQuotation,
  canManageQuotation,
  canReviseQuotation,
} from "./quotation-access";
import { changeQuotationCustomerAction } from "../_actions/change-customer";
import {
  Check,
  Plus,
  Repeat,
  Pencil,
  Trash,
  Info,
  WarningCircle,
} from "@/components/icons";
import type {
  getQuotation,
  quotationCatalogue,
} from "@/server/queries/quotations";
import {
  addQuoteLineAction,
  saveQuoteAction,
  removeQuoteLineAction,
  repriceQuoteAction,
  reviseQuoteAction,
  cancelQuoteAction,
} from "@/server/actions/quotations";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/layout/form-error";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/forms/date-picker";
import { PercentInput } from "@/components/forms/percent-input";
import { formatMinor, formatBp } from "@/domain/money/money";
import type { ActionResult } from "@/domain/errors";
import type { CycleSummary } from "@/domain/pricing/types";

/** One label/amount pair, with the number right-aligned and tabular. */
function TotalRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground capitalize">{label}</dt>
      <dd className={strong ? "tabular font-semibold" : "tabular"}>{value}</dd>
    </div>
  );
}

type Props = {
  data: Awaited<ReturnType<typeof getQuotation>>;
  products: Awaited<ReturnType<typeof quotationCatalogue>>;
  customers: CustomerOption[];
  children?: React.ReactNode;
};
export function QuoteBuilder({
  data: { quote: q, actor },
  products,
  customers,
  children,
}: Props) {
  const [lines, setLines] = useState(
      q.lines.map((l) => ({ id: l.id, qty: l.qty, discountBp: l.discountBp })),
    ),
    [discount, setDiscount] = useState(q.orderDiscountBp),
    [note, setNote] = useState(q.customerNote ?? ""),
    [delivery, setDelivery] = useState(q.requestedDeliveryDate ?? undefined),
    [valid, setValid] = useState(q.validUntil ?? undefined),
    [customerId, setCustomerId] = useState(q.customerId);
  const [picker, setPicker] = useState(false),
    [productId, setProductId] = useState(""),
    [planId, setPlanId] = useState(""),
    [variants, setVariants] = useState<Record<string, string>>({}),
    [qty, setQty] = useState(1),
    [search, setSearch] = useState(""),
    [history, setHistory] = useState(false),
    [reason, setReason] = useState(""),
    [operation, setOperation] = useState<
      "revise" | "cancel" | "customer" | null
    >(null),
    [error, setError] = useState(""),
    // Href held back by the unsaved-changes guard until the user decides.
    [leaveTo, setLeaveTo] = useState<string | null>(null),
    [pending, start] = useTransition();
  const router = useRouter(),
    editable = canEditQuotation(q, actor),
    version = { id: q.id, expectedVersion: q.version };
  const termsDirty =
    JSON.stringify(lines) !==
      JSON.stringify(
        q.lines.map((l) => ({
          id: l.id,
          qty: l.qty,
          discountBp: l.discountBp,
        })),
      ) ||
    discount !== q.orderDiscountBp ||
    note !== (q.customerNote ?? "") ||
    delivery?.getTime() !== q.requestedDeliveryDate?.getTime() ||
    valid?.getTime() !== q.validUntil?.getTime();
  const customerChanged = customerId !== q.customerId;
  const dirty = termsDirty || customerChanged;
  const customerOptions = customers.some(
    (customer) => customer.id === q.customerId,
  )
    ? customers
    : [
        { id: q.customerId, name: q.customer.name, tier: q.customer.tier },
        ...customers,
      ];
  const selectedCustomer = customerOptions.find(
    (customer) => customer.id === customerId,
  );
  useEffect(() => {
    if (!dirty && !pending) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const navigate = (e: MouseEvent) => {
      const link =
        e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!link) return;
      if (pending) {
        e.preventDefault();
        e.stopPropagation();
        setError(
          "Wait for the current action to finish before leaving the workspace.",
        );
        return;
      }
      // Let the browser handle new-tab and download intents untouched.
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      const href = link.getAttribute("href");
      if (!href) return;
      // Hold the navigation and ask in-app instead of via window.confirm.
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(href);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty, pending]);
  /** Refills the builder from the saved quotation, dropping local edits. */
  function reloadFromServer() {
    setLines(
      q.lines.map((line) => ({
        id: line.id,
        qty: line.qty,
        discountBp: line.discountBp,
      })),
    );
    setDiscount(q.orderDiscountBp);
    setNote(q.customerNote ?? "");
    setDelivery(q.requestedDeliveryDate ?? undefined);
    setValid(q.validUntil ?? undefined);
    setCustomerId(q.customerId);
    setError("");
    router.refresh();
  }
  function run(fn: () => Promise<ActionResult<unknown>>) {
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      setError("");
      setPicker(false);
      setOperation(null);
      router.refresh();
    });
  }
  const product = products.find((p) => p.id === productId),
    recurring = (q.recurringByCycle ?? {}) as unknown as Record<
      string,
      CycleSummary
    >;
  return (
    <>
      <WorkspaceActions>
        {editable && (
          <>
            <Button
              disabled={pending || !termsDirty || customerChanged}
              onClick={() =>
                run(() =>
                  saveQuoteAction({
                    ...version,
                    lines,
                    orderDiscountBp: discount,
                    customerNote: note || null,
                    requestedDeliveryDate: delivery ?? null,
                    validUntil: valid ?? null,
                  }),
                )
              }
            >
              <Check aria-hidden="true" />
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <Button
              variant="outline"
              disabled={pending || termsDirty || !customerChanged}
              onClick={() => setOperation("customer")}
            >
              <Repeat aria-hidden="true" />
              Apply customer change
            </Button>
            <Button
              variant="outline"
              disabled={pending || dirty}
              onClick={() => setPicker(true)}
            >
              <Plus aria-hidden="true" />
              Add product
            </Button>
            <ConfirmDialog
              title="Reprice from catalogue?"
              description="Line prices, costs and tax are replaced with current catalogue values. Negotiated line prices on this quotation are lost."
              confirmLabel="Reprice lines"
              cancelLabel="Keep current prices"
              onConfirm={() => run(() => repriceQuoteAction(version))}
              trigger={
                <Button variant="outline" disabled={pending || dirty}>
                  <Repeat aria-hidden="true" />
                  Reprice from catalogue
                </Button>
              }
            />
          </>
        )}
        {!editable && canReviseQuotation(q, actor) && (
          <Button disabled={pending} onClick={() => setOperation("revise")}>
            <Pencil aria-hidden="true" />
            Create revision
          </Button>
        )}
        {editable && (
          <Button
            disabled={pending || dirty || !q.lines.length}
            onClick={() => run(() => submitQuoteAction(version))}
          >
            <PaperPlaneTilt aria-hidden="true" />
            Submit for approval
          </Button>
        )}
        {children}
        <Button variant="outline" onClick={() => setHistory(true)}>
          Version history
        </Button>
        {/* Only offered when there is something to discard - on a clean
            builder this was the page reload the browser already does.
            "Go to back-end" and "Close workspace" were removed outright: both
            just duplicated links the sidebar already provides. */}
        {dirty && (
          <ConfirmDialog
            title="Discard unsaved changes and reload?"
            description="The builder is refilled from the saved quotation. Your unsaved edits are lost."
            confirmLabel="Discard and reload"
            cancelLabel="Keep editing"
            destructive
            onConfirm={reloadFromServer}
            trigger={
              <Button variant="outline" disabled={pending}>
                Discard changes
              </Button>
            }
          />
        )}
        {canManageQuotation(q, actor) &&
          !["CONFIRMED", "CANCELLED"].includes(q.status) && (
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => setOperation("cancel")}
            >
              <Trash aria-hidden="true" />
              Cancel quotation
            </Button>
          )}
      </WorkspaceActions>
      {/* Only rendered when there is something to say - an always-present
          empty alert box is what made this page read as cluttered. */}
      {error ? (
        <Alert variant="destructive">
          <WarningCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {customerChanged || dirty || !editable ? (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            {customerChanged
              ? "Customer change pending. Apply it from the toolbar to reprice this quotation."
              : dirty
                ? "Unsaved changes. Save to recalculate totals and discount limits."
                : `Terms locked · ${q.status.replaceAll("_", " ").toLowerCase()}. Create a revision to change them.`}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Terms</CardTitle>
          <CardDescription>
            {editable
              ? "Prices are snapshotted when a line is added; repricing is explicit."
              : "These terms are locked to the accepted version."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Customer</Label>
            {editable ? (
              <CustomerPicker
                customers={customerOptions}
                value={customerId}
                onChange={setCustomerId}
                disabled={pending || termsDirty}
              />
            ) : (
              <p className="font-medium">
                {q.customer.name} · {q.customer.tier}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              Owner: {q.owner.name}
            </p>
          </div>
          <DatePicker
            label="Valid until"
            value={valid}
            onChange={setValid}
            disabled={!editable || pending || customerChanged}
          />
          <DatePicker
            label="Requested delivery"
            value={delivery}
            onChange={setDelivery}
            disabled={!editable || pending || customerChanged}
          />
        </CardContent>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader className="border-b pb-4">
          <CardTitle>Lines</CardTitle>
          <CardDescription>
            {q.lines.length} {q.lines.length === 1 ? "line" : "lines"} · effective
            discount is checked against each line&apos;s limit.
          </CardDescription>
        </CardHeader>
        <Table containerClassName="rounded-none border-0">
          <TableHeader>
            <TableRow>
              {[
                "Product / plan",
                "Quantity",
                "Unit price",
                "Line discount",
                "Effective / limit",
                "Net",
                "Margin",
                "",
              ].map((h, i) => (
                <TableHead key={i}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.lines.map((l, i) => (
              <TableRow key={l.id}>
                <TableCell className="min-w-48">
                  <p className="font-medium">{l.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.variantLabel}
                    {l.plan
                      ? `${l.plan.tier?.name ?? l.plan.name} · ${l.interval}`
                      : ""}
                  </p>
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`Quantity for ${l.productName}`}
                    type="number"
                    min={1}
                    className="w-20"
                    value={lines[i].qty}
                    disabled={!editable || pending || customerChanged}
                    onChange={(e) =>
                      setLines(
                        lines.map((x, j) =>
                          j === i ? { ...x, qty: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  {formatMinor(l.unitPriceMinor, q.currency)}
                </TableCell>
                <TableCell>
                  <PercentInput
                    aria-label={`Discount for ${l.productName}`}
                    className="w-24"
                    value={lines[i].discountBp}
                    disabled={!editable || pending || customerChanged}
                    onChange={(value) =>
                      setLines(
                        lines.map((x, j) =>
                          j === i ? { ...x, discountBp: value } : x,
                        ),
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  <p
                    title={`Order discount allocated: ${formatMinor(l.orderDiscountAllocMinor, q.currency)}`}
                  >
                    {formatBp(l.effectiveDiscountBp)} / {formatBp(l.limitBp)}
                  </p>
                  <span
                    className={
                      l.excessBp ? "text-destructive" : "text-muted-foreground"
                    }
                  >
                    {l.excessBp
                      ? `Over +${l.excessBp / 100} pt`
                      : "Within limit"}
                  </span>
                </TableCell>
                <TableCell>{formatMinor(l.netMinor, q.currency)}</TableCell>
                <TableCell>{formatMinor(l.marginMinor, q.currency)}</TableCell>
                <TableCell>
                  {editable && (
                    <Button
                      variant="ghost"
                      disabled={pending || dirty}
                      aria-label={`Remove ${l.productName}`}
                      onClick={() =>
                        run(() =>
                          removeQuoteLineAction({ ...version, lineId: l.id }),
                        )
                      }
                    >
                      Remove
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!q.lines.length && (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground py-10 text-center">
                  No lines yet. Use “Add product” in the toolbar to start this
                  quotation.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <div className="grid items-start gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Adjustments</CardTitle>
            <CardDescription>
              The order discount is allocated proportionally over amounts after
              line discounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="order-discount">Order discount (%)</Label>
              <PercentInput
                id="order-discount"
                className="max-w-40"
                value={discount}
                onChange={setDiscount}
                disabled={!editable || pending || customerChanged}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-note">Customer note</Label>
              <Textarea
                id="customer-note"
                rows={4}
                placeholder="Visible to the customer on the shared quotation."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={!editable || pending || customerChanged}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Saved totals</CardTitle>
            <CardDescription>
              From the last save, not your unsaved edits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="space-y-2">
              <TotalRow
                label="One-time net"
                value={formatMinor(q.oneTimeNetMinor, q.currency)}
                strong
              />
              <TotalRow
                label="One-time tax"
                value={formatMinor(
                  q.lines
                    .filter((l) => !l.interval)
                    .reduce((s, l) => s + l.taxMinor, 0),
                  q.currency,
                )}
              />
              <TotalRow
                label="One-time margin"
                value={formatMinor(q.oneTimeMarginMinor, q.currency)}
              />
            </dl>
            {Object.entries(recurring).map(([cycle, s]) => (
              <dl key={cycle} className="space-y-2 border-t pt-3">
                <TotalRow
                  label={`${cycle.toLowerCase()} net`}
                  value={formatMinor(s.netMinor, q.currency)}
                  strong
                />
                <TotalRow
                  label="Tax"
                  value={formatMinor(s.taxMinor ?? 0, q.currency)}
                />
                <TotalRow
                  label="Margin"
                  value={formatMinor(s.marginMinor, q.currency)}
                />
              </dl>
            ))}
          </CardContent>
        </Card>
      </div>
      <Sheet open={picker} onOpenChange={setPicker}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Add a product</SheetTitle>
            <SheetDescription>
              Choose a product, options and billing plan.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4">
            <Input
              placeholder="Search catalogue"
              aria-label="Search catalogue"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              value={productId}
              onValueChange={(id) => {
                setProductId(id);
                setPlanId("");
                setVariants({});
              }}
            >
              <SelectTrigger aria-label="Product">
                <SelectValue placeholder="Choose product" />
              </SelectTrigger>
              <SelectContent>
                {products
                  .filter((p) =>
                    p.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.category.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {product?.attributes.map((a) => (
              <Select
                key={a.id}
                value={variants[a.id] ?? ""}
                onValueChange={(v) => setVariants({ ...variants, [a.id]: v })}
              >
                <SelectTrigger aria-label={a.name}>
                  <SelectValue placeholder={a.name} />
                </SelectTrigger>
                <SelectContent>
                  {a.values.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.value} (+{formatMinor(v.extraPriceMinor, q.currency)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
            {product?.type === "SUBSCRIPTION" && (
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger aria-label="Subscription plan">
                  <SelectValue placeholder="Choose tier and cycle" />
                </SelectTrigger>
                <SelectContent>
                  {product.plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.tier?.name ?? p.name} · {p.interval} ·{" "}
                      {formatMinor(p.priceMinor, q.currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Label htmlFor="add-qty">Quantity</Label>
            <Input
              id="add-qty"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
            <FormError message={error} />
            <Button
              disabled={
                pending ||
                !product ||
                qty < 1 ||
                (product.type === "SUBSCRIPTION" && !planId)
              }
              onClick={() =>
                run(() =>
                  addQuoteLineAction({
                    ...version,
                    productId,
                    planId: planId || undefined,
                    variantValueIds: Object.values(variants),
                    qty,
                    discountBp: 0,
                  }),
                )
              }
            >
              Add line
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <VersionHistory
        open={history}
        onOpenChange={setHistory}
        versions={q.versions}
        actorNames={{
          [q.ownerId]: q.owner.name,
          [actor.id]: actor.name ?? "You",
        }}
        customerNames={Object.fromEntries(
          customerOptions.map((customer) => [customer.id, customer.name]),
        )}
      />
      <Dialog
        open={!!operation}
        onOpenChange={(open) => {
          if (!open) setOperation(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {operation === "customer"
                ? "Change quotation customer"
                : operation === "revise"
                  ? "Create revision"
                  : "Cancel quotation"}
            </DialogTitle>
            <DialogDescription>
              {operation === "customer"
                ? `Switch from ${q.customer.name} to ${selectedCustomer?.name ?? "the selected customer"}? All lines will be repriced using the new customer's price list, currency and discount limits. This saves a new snapshot.`
                : "Prior approvals and acceptance will no longer apply. Explain your decision."}
            </DialogDescription>
          </DialogHeader>
          {operation !== "customer" && (
            <Textarea
              aria-label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
          <Button
            disabled={
              pending ||
              (operation === "customer"
                ? !customerChanged || termsDirty
                : !reason.trim())
            }
            variant={operation === "cancel" ? "destructive" : "default"}
            onClick={() =>
              run(() =>
                operation === "customer"
                  ? changeQuotationCustomerAction({ ...version, customerId })
                  : (operation === "revise"
                      ? reviseQuoteAction
                      : cancelQuoteAction)({ ...version, reason }),
              )
            }
          >
            Confirm{" "}
            {operation === "customer"
              ? "customer change"
              : operation === "revise"
                ? "revision"
                : "cancellation"}
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={leaveTo !== null}
        onOpenChange={(open) => !open && setLeaveTo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              This quotation has unsaved changes. Leaving now discards them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                const href = leaveTo;
                setLeaveTo(null);
                if (href) router.push(href);
              }}
            >
              Discard and leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
