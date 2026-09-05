"use client";
import { useState, useTransition, useEffect } from "react";
import { submitQuoteAction } from "@/server/actions/approvals";
import { PaperPlaneTilt } from "@/components/icons";
import { useRouter } from "next/navigation";
import { VersionHistory } from "./version-history";
import Link from "next/link";
import {
  Check,
  Plus,
  Repeat,
  Pencil,
  ArrowSquareOut,
  ArrowLeft,
  Trash,
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
import { Button } from "@/components/ui/button";
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

type Props = {
  data: Awaited<ReturnType<typeof getQuotation>>;
  products: Awaited<ReturnType<typeof quotationCatalogue>>;
  children?: React.ReactNode;
};
export function QuoteBuilder({
  data: { quote: q, actor },
  products,
  children,
}: Props) {
  const [lines, setLines] = useState(
      q.lines.map((l) => ({ id: l.id, qty: l.qty, discountBp: l.discountBp })),
    ),
    [discount, setDiscount] = useState(q.orderDiscountBp),
    [note, setNote] = useState(q.customerNote ?? ""),
    [delivery, setDelivery] = useState(q.requestedDeliveryDate ?? undefined),
    [valid, setValid] = useState(q.validUntil ?? undefined);
  const [picker, setPicker] = useState(false),
    [productId, setProductId] = useState(""),
    [planId, setPlanId] = useState(""),
    [variants, setVariants] = useState<Record<string, string>>({}),
    [qty, setQty] = useState(1),
    [search, setSearch] = useState(""),
    [history, setHistory] = useState(false),
    [reason, setReason] = useState(""),
    [operation, setOperation] = useState<"revise" | "cancel" | null>(null),
    [error, setError] = useState(""),
    [pending, start] = useTransition();
  const router = useRouter(),
    editable =
      ["DRAFT", "REVISION_REQUESTED"].includes(q.status) &&
      actor.role !== "FINANCE",
    version = { id: q.id, expectedVersion: q.version };
  const dirty =
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
  useEffect(() => {
    if (!dirty && !pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    const navigate = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a[href]");
      if (
        link &&
        !window.confirm("Leave without saving your quotation changes?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty, pending]);
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
              disabled={pending || !dirty}
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
              disabled={pending || dirty}
              onClick={() => setPicker(true)}
            >
              <Plus aria-hidden="true" />
              Add product
            </Button>
            <Button
              variant="outline"
              disabled={pending || dirty}
              onClick={() => {
                if (
                  window.confirm(
                    "Replace line prices, costs and tax with current catalogue values?",
                  )
                )
                  run(() => repriceQuoteAction(version));
              }}
            >
              <Repeat aria-hidden="true" />
              Reprice from catalogue
            </Button>
          </>
        )}
        {!editable &&
          actor.role !== "FINANCE" &&
          !["CONFIRMED", "CANCELLED", "EXPIRED"].includes(q.status) && (
            <Button onClick={() => setOperation("revise")}>
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
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (!dirty || window.confirm("Discard unsaved changes and reload?"))
              window.location.reload();
          }}
        >
          Reload data
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin">
            <ArrowSquareOut aria-hidden="true" />
            Go to back-end
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/quotations">
            <ArrowLeft aria-hidden="true" />
            Close workspace
          </Link>
        </Button>
        {actor.role !== "FINANCE" &&
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
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
      <div className="rounded-lg border bg-muted p-4 text-sm">
        {dirty
          ? "Unsaved changes. Save to recalculate totals and discount limits."
          : editable
            ? "Draft terms are editable. Prices are snapshotted; repricing is explicit."
            : `Terms locked · ${q.status.replaceAll("_", " ").toLowerCase()}. Create a revision to change them.`}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <p className="text-sm text-muted-foreground">Customer</p>
          <p className="font-medium">
            {q.customer.name} · {q.customer.tier}
          </p>
          <p className="text-sm text-muted-foreground">Owner: {q.owner.name}</p>
        </div>
        <DatePicker
          label="Valid until"
          value={valid}
          onChange={setValid}
          disabled={!editable || pending}
        />
        <DatePicker
          label="Requested delivery"
          value={delivery}
          onChange={setDelivery}
          disabled={!editable || pending}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
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
                    disabled={!editable || pending}
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
                    disabled={!editable || pending}
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
                <TableCell colSpan={8}>
                  Add a product from the sidebar to start this quotation.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <Label htmlFor="order-discount">Order discount (%)</Label>
          <PercentInput
            id="order-discount"
            className="max-w-40"
            value={discount}
            onChange={setDiscount}
            disabled={!editable || pending}
          />
          <p className="text-sm text-muted-foreground">
            Allocated proportionally over amounts after line discounts.
          </p>
          <Label htmlFor="customer-note">Customer note</Label>
          <Textarea
            id="customer-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!editable || pending}
          />
        </section>
        <section className="space-y-4 rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Saved totals</h2>
          <p>
            One-time net{" "}
            <strong>{formatMinor(q.oneTimeNetMinor, q.currency)}</strong>
          </p>
          <p>
            One-time tax{" "}
            {formatMinor(
              q.lines
                .filter((l) => !l.interval)
                .reduce((s, l) => s + l.taxMinor, 0),
              q.currency,
            )}
          </p>
          <p>One-time margin {formatMinor(q.oneTimeMarginMinor, q.currency)}</p>
          {Object.entries(recurring).map(([cycle, s]) => (
            <div key={cycle} className="border-t pt-3">
              <p className="font-medium">
                {cycle.toLowerCase()} · {formatMinor(s.netMinor, q.currency)}{" "}
                net per initial period
              </p>
              <p className="text-sm text-muted-foreground">
                Tax {formatMinor(s.taxMinor ?? 0, q.currency)} · margin{" "}
                {formatMinor(s.marginMinor, q.currency)}
              </p>
            </div>
          ))}
        </section>
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
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
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
        customerNames={{ [q.customerId]: q.customer.name }}
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
              {operation === "revise" ? "Create revision" : "Cancel quotation"}
            </DialogTitle>
            <DialogDescription>
              Prior approvals and acceptance will no longer apply. Explain your
              decision.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            disabled={!reason.trim() || pending}
            variant={operation === "cancel" ? "destructive" : "default"}
            onClick={() =>
              run(() =>
                (operation === "revise"
                  ? reviseQuoteAction
                  : cancelQuoteAction)({ ...version, reason }),
              )
            }
          >
            Confirm {operation === "revise" ? "revision" : "cancellation"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
