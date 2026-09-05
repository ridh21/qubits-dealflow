"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PlusIcon,
  ArrowCounterClockwiseIcon,
  PaperPlaneTiltIcon,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/page-header";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  INTERVALS,
  effectiveMatrix,
  type Interval,
} from "@/domain/entitlements/effective";
import type { ActionResult } from "@/domain/errors";
import type {
  getPlanEditorData,
  listPlanNoticeHistory,
} from "@/server/queries/plans";
import type { EntitlementDraft } from "@/server/services/entitlement.service";
import { DEFAULT_CURRENCY } from "@/domain/money/money";
import {
  createTierAction,
  updateTierAction,
  savePlanAction,
  copyPricesAction,
} from "@/server/actions/plans";
import {
  saveDefinitionAction,
  archiveDefinitionAction,
  saveEntitlementValueAction,
  resetOverrideAction,
  discardDraftAction,
  previewPublishAction,
  publishChangesAction,
  noticeHistoryAction,
} from "@/server/actions/entitlements";

type Data = Awaited<ReturnType<typeof getPlanEditorData>>;
type History = Awaited<ReturnType<typeof listPlanNoticeHistory>>;
type Preview = Extract<
  Awaited<ReturnType<typeof previewPublishAction>>,
  { ok: true }
>["data"];
type Run = (
  work: () => Promise<ActionResult<unknown>>,
  done?: () => void,
) => void;
const cycleLabel = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase();
const display = (value: unknown) => (value == null ? "Unset" : String(value));

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Label className="flex flex-col items-start gap-2">
      {label}
      {children}
    </Label>
  );
}
function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((v) => (
          <SelectItem key={v} value={v}>
            {cycleLabel(v)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function PlanEditor({
  data,
  history,
}: {
  data: Data;
  history: History;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tierOpen, setTierOpen] = useState(false);
  const [defOpen, setDefOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reason, setReason] = useState("");
  const run: Run = (work, done) =>
    startTransition(async () => {
      try {
        const result = await work();
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        done?.();
        router.refresh();
      } catch {
        toast.error("The request failed. Please try again.");
      }
    });
  const cells = effectiveMatrix(
    data.draft.definitions,
    data.tiers.map((t) => t.id),
    data.draft.values,
  );
  return (
    <>
      <PageHeader
        title={data.product.name}
        description="Manage cycle prices and next-cycle entitlements. Prices are saved immediately; entitlement edits stay in a draft until published."
      />
      <WorkspaceActions>
        <Button disabled={pending} onClick={() => setTierOpen(true)}>
          <PlusIcon />
          Add tier
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => setDefOpen(true)}
        >
          <PlusIcon />
          Define entitlement
        </Button>
        <Button
          disabled={pending || !data.hasDraft}
          onClick={() =>
            run(async () => {
              const result = await previewPublishAction(data.product.id);
              if (result.ok) {
                setPreview(result.data);
                setReason("");
              }
              return result;
            })
          }
        >
          <PaperPlaneTiltIcon />
          Preview & publish
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" disabled={pending || !data.hasDraft}>
              <ArrowCounterClockwiseIcon />
              Discard draft
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <p className="mb-3 text-sm">
              Discard all unpublished entitlement changes for this product?
            </p>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => discardDraftAction(data.product.id))}
            >
              Discard changes
            </Button>
          </PopoverContent>
        </Popover>
      </WorkspaceActions>
      {data.hasDraft && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm"
        >
          Unpublished draft · Current holders keep their period entitlements.
          Use Preview & publish in the sidebar when ready.
        </div>
      )}
      <Tabs defaultValue="prices">
        <TabsList>
          <TabsTrigger value="prices">Tiers & prices</TabsTrigger>
          <TabsTrigger value="entitlements">Entitlements</TabsTrigger>
          <TabsTrigger value="history">Change history</TabsTrigger>
        </TabsList>
        <TabsContent value="prices">
          <div className="overflow-x-auto rounded-lg border">
            <Table containerClassName="rounded-none border-0">
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  {INTERVALS.map((i) => (
                    <TableHead key={i}>{cycleLabel(i)}</TableHead>
                  ))}
                  <TableHead>Copy prices</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.tiers.map((tier) => (
                  <TableRow key={tier.id}>
                    <TableCell>
                      <TierEdit
                        key={JSON.stringify(tier)}
                        tier={tier}
                        run={run}
                        pending={pending}
                      />
                    </TableCell>
                    {INTERVALS.map((interval) => (
                      <TableCell key={interval}>
                        <PriceCell
                          key={JSON.stringify(
                            data.plans.find(
                              (p) =>
                                p.tierId === tier.id && p.interval === interval,
                            ),
                          )}
                          tier={tier}
                          interval={interval}
                          plan={data.plans.find(
                            (p) =>
                              p.tierId === tier.id && p.interval === interval,
                          )}
                          run={run}
                          pending={pending}
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <CopyPrices
                        tierId={tier.id}
                        run={run}
                        pending={pending}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!data.tiers.length && (
            <p className="p-6 text-sm text-muted-foreground">
              Add a tier using the sidebar to start setting prices.
            </p>
          )}
        </TabsContent>
        <TabsContent value="entitlements">
          <div className="overflow-x-auto rounded-lg border">
            <Table containerClassName="rounded-none border-0">
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2}>Entitlement</TableHead>
                  {data.tiers.map((t) => (
                    <TableHead
                      className="border-l text-center"
                      key={t.id}
                      colSpan={5}
                    >
                      {t.name}
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow>
                  {data.tiers.flatMap((t) => [
                    <TableHead className="border-l" key={`${t.id}-default`}>
                      Tier default
                    </TableHead>,
                    ...INTERVALS.map((i) => (
                      <TableHead key={`${t.id}-${i}`}>
                        {cycleLabel(i)}
                      </TableHead>
                    )),
                  ])}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.draft.definitions
                  .toSorted((a, b) => a.sortOrder - b.sortOrder)
                  .map((def) => (
                    <TableRow key={def.id}>
                      <TableCell>
                        <DefinitionEdit
                          key={JSON.stringify(def)}
                          productId={data.product.id}
                          definition={def}
                          run={run}
                          pending={pending}
                        />
                      </TableCell>
                      {data.tiers.flatMap((tier) =>
                        [null, ...INTERVALS].map((interval) => {
                          const value = data.draft.values.find(
                            (v) =>
                              v.definitionId === def.id &&
                              v.tierId === tier.id &&
                              v.interval === interval,
                          );
                          const cell = cells.find(
                            (c) =>
                              c.definitionId === def.id &&
                              c.tierId === tier.id &&
                              c.interval === interval,
                          );
                          return (
                            <TableCell
                              className={
                                interval === null ? "border-l bg-muted/30" : ""
                              }
                              key={`${tier.id}-${interval}`}
                            >
                              <ValueCell
                                key={`${data.draft.revision}-${tier.id}-${interval}`}
                                definition={def}
                                tierId={tier.id}
                                interval={interval}
                                value={
                                  interval === null ? value?.value : cell?.value
                                }
                                source={
                                  interval === null
                                    ? "DEFAULT"
                                    : (cell?.source ?? "UNSET")
                                }
                                pending={pending}
                                run={run}
                              />
                            </TableCell>
                          );
                        }),
                      )}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          {!data.draft.definitions.length && (
            <p className="p-6 text-sm text-muted-foreground">
              Define an entitlement in the sidebar, then set a tier default to
              fill all four cycles.
            </p>
          )}
        </TabsContent>
        <TabsContent value="history">
          <NoticeHistory
            productId={data.product.id}
            tiers={data.tiers}
            initial={history}
          />
        </TabsContent>
      </Tabs>
      <Dialog open={tierOpen} onOpenChange={setTierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add tier</DialogTitle>
            <DialogDescription>
              Give the tier a name and display order.
            </DialogDescription>
          </DialogHeader>
          <TierForm
            run={run}
            pending={pending}
            onSave={(input) => createTierAction(data.product.id, input)}
            onDone={() => setTierOpen(false)}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={defOpen} onOpenChange={setDefOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Define entitlement</DialogTitle>
            <DialogDescription>
              The definition and values are saved to the unpublished draft.
            </DialogDescription>
          </DialogHeader>
          <DefinitionForm
            run={run}
            pending={pending}
            productId={data.product.id}
            onDone={() => setDefOpen(false)}
          />
        </DialogContent>
      </Dialog>
      <Sheet
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Publish entitlements</SheetTitle>
            <SheetDescription>
              Changes apply from each holder’s next billing cycle. Emails are
              queued when you publish.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 px-4 pb-6">
            {preview?.changes.map((c, i) => (
              <p key={i} className="text-sm">
                {data.tiers.find((t) => t.id === c.tierId)?.name} ·{" "}
                {cycleLabel(c.interval)} · {c.label}:{" "}
                <strong>
                  {display(c.before)} → {display(c.after)}
                </strong>
              </p>
            ))}
            {preview && !preview.changes.length && (
              <p>
                No effective values changed. Publishing saves definition or
                ordering changes without sending notices.
              </p>
            )}
            {preview?.notices.map((n, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <h3 className="font-medium">
                  {n.tierName} ·{" "}
                  {n.interval ? cycleLabel(n.interval) : "All cycles"}
                </h3>
                <p className="text-sm">
                  {n.holders} holders · {n.recipients} emails
                </p>
                <p className="text-sm font-medium">{n.sample.subject}</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {n.sample.text}
                </p>
              </div>
            ))}
            <Field label="Reason">
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
              />
            </Field>
            <Button
              disabled={pending || !reason.trim() || !preview}
              onClick={() => {
                if (preview)
                  run(
                    () =>
                      publishChangesAction(
                        data.product.id,
                        reason,
                        preview.revision,
                      ),
                    () => {
                      setPreview(null);
                      toast.success("Entitlements published; notices queued.");
                    },
                  );
              }}
            >
              {pending ? "Publishing…" : "Publish & queue notices"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

type TierInput = Parameters<typeof createTierAction>[1];
function TierForm({
  tier,
  run,
  pending,
  onSave,
  onDone,
}: {
  tier?: Data["tiers"][number];
  run: Run;
  pending: boolean;
  onSave: (input: TierInput) => Promise<ActionResult<unknown>>;
  onDone?: () => void;
}) {
  const [name, setName] = useState(tier?.name ?? "");
  const [rank, setRank] = useState(tier?.rank ?? 0);
  const [description, setDescription] = useState(tier?.description ?? "");
  const [active, setActive] = useState(tier?.isActive ?? true);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => onSave({ name, rank, description, isActive: active }),
          onDone,
        );
      }}
    >
      <Field label="Name">
        <Input
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Display order (lower first)">
        <Input
          required
          type="number"
          min={0}
          max={10000}
          value={rank}
          onChange={(e) => setRank(Number(e.target.value))}
        />
      </Field>
      <Field label="Description">
        <Textarea
          maxLength={1000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field label="Active">
        <Switch checked={active} onCheckedChange={setActive} />
      </Field>
      <p className="text-xs text-muted-foreground">
        Deactivation also disables cycle plans and is blocked while this tier
        has current holders.
      </p>
      <Button disabled={pending}>Save tier</Button>
    </form>
  );
}
function TierEdit({
  tier,
  run,
  pending,
}: {
  tier: Data["tiers"][number];
  run: Run;
  pending: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost">
          {tier.name} <Badge variant="secondary">#{tier.rank}</Badge>
          {!tier.isActive && <Badge variant="outline">Inactive</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <TierForm
          tier={tier}
          pending={pending}
          run={run}
          onSave={(input) => updateTierAction(tier.id, input)}
        />
      </PopoverContent>
    </Popover>
  );
}
function PriceCell({
  tier,
  interval,
  plan,
  run,
  pending,
}: {
  tier: Data["tiers"][number];
  interval: Interval;
  plan?: Data["plans"][number];
  run: Run;
  pending: boolean;
}) {
  const [price, setPrice] = useState(
    plan ? (plan.priceMinor / 100).toFixed(2) : "",
  );
  const [proration, setProration] = useState<"DAILY" | "NONE">(
    plan?.prorationRule ?? "DAILY",
  );
  const [cancellation, setCancellation] = useState<
    "NONE" | "PRORATED_CREDIT" | "FULL_CREDIT"
  >(plan?.cancellationRule ?? "PRORATED_CREDIT");
  const [active, setActive] = useState(plan?.isActive ?? tier.isActive);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={`Edit ${tier.name} ${interval} price`}
        >
          {plan ? `$${(plan.priceMinor / 100).toFixed(2)}` : "Set price"}
          {plan && !plan.isActive && <Badge variant="secondary">Off</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              savePlanAction(tier.id, interval, {
                priceMinor: Math.round(Number(price) * 100),
                prorationRule: proration,
                cancellationRule: cancellation,
                isActive: active,
              }),
            );
          }}
        >
          <Field label={`Price (${DEFAULT_CURRENCY})`}>
            <Input
              required
              type="number"
              min="0"
              max="21474836.47"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
          <Field label="Proration">
            <Choice
              label="Proration"
              value={proration}
              onChange={(v) => setProration(v as typeof proration)}
              options={["DAILY", "NONE"]}
            />
          </Field>
          <Field label="Cancellation">
            <Choice
              label="Cancellation"
              value={cancellation}
              onChange={(v) => setCancellation(v as typeof cancellation)}
              options={["NONE", "PRORATED_CREDIT", "FULL_CREDIT"]}
            />
          </Field>
          <Field label="Active">
            <Switch
              checked={active}
              disabled={!tier.isActive}
              onCheckedChange={setActive}
            />
          </Field>
          <Button disabled={pending}>Save price & rules</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
function CopyPrices({
  tierId,
  run,
  pending,
}: {
  tierId: string;
  run: Run;
  pending: boolean;
}) {
  const [source, setSource] = useState<Interval>("MONTHLY");
  const [discount, setDiscount] = useState(0);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost">Copy across cycles</Button>
      </PopoverTrigger>
      <PopoverContent className="space-y-3">
        <p className="text-sm">
          Replaces the other three prices and rules. Uses 52 weeks, 12 months or
          4 quarters per year.
        </p>
        <Choice
          label="Source cycle"
          value={source}
          onChange={(v) => setSource(v as Interval)}
          options={INTERVALS}
        />
        <Field label="Discount on copied prices (%)">
          <Input
            type="number"
            min={0}
            max={100}
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
          />
        </Field>
        <Button
          disabled={pending}
          onClick={() => run(() => copyPricesAction(tierId, source, discount))}
        >
          Replace other cycles
        </Button>
      </PopoverContent>
    </Popover>
  );
}

type Definition = EntitlementDraft["definitions"][number];
function DefinitionForm({
  definition,
  productId,
  run,
  pending,
  onDone,
}: {
  definition?: Definition;
  productId: string;
  run: Run;
  pending: boolean;
  onDone?: () => void;
}) {
  const [key, setKey] = useState(definition?.key ?? "");
  const [label, setLabel] = useState(definition?.label ?? "");
  const [unit, setUnit] = useState(definition?.unit ?? "");
  const [per, setPer] = useState<Definition["per"]>(definition?.per ?? "DAY");
  const [valueType, setType] = useState<Definition["valueType"]>(
    definition?.valueType ?? "INT",
  );
  const [sortOrder, setOrder] = useState(definition?.sortOrder ?? 0);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            saveDefinitionAction(productId, definition?.id ?? null, {
              key,
              label,
              unit: unit || null,
              per,
              valueType,
              sortOrder,
            }),
          onDone,
        );
      }}
    >
      <Field label="Key">
        <Input
          required
          disabled={!!definition}
          pattern="[a-z][a-z0-9_]*"
          maxLength={100}
          placeholder="photos_per_day"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
      </Field>
      <Field label="Label">
        <Input
          required
          maxLength={150}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </Field>
      <Field label="Unit">
        <Input
          disabled={!!definition}
          maxLength={80}
          placeholder="photos"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
      </Field>
      {definition ? (
        <p className="text-sm">
          {valueType} · per {per.toLowerCase()} (key, unit, type and period are
          fixed)
        </p>
      ) : (
        <>
          <Choice
            label="Period"
            value={per}
            onChange={(v) => setPer(v as typeof per)}
            options={["DAY", "WEEK", "MONTH", "CYCLE"]}
          />
          <Choice
            label="Value type"
            value={valueType}
            onChange={(v) => setType(v as typeof valueType)}
            options={["INT", "BOOL", "TEXT"]}
          />
        </>
      )}
      <Field label="Display order">
        <Input
          required
          type="number"
          min={0}
          max={10000}
          value={sortOrder}
          onChange={(e) => setOrder(Number(e.target.value))}
        />
      </Field>
      <Button disabled={pending}>Save definition to draft</Button>
      {definition && (
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            run(() => archiveDefinitionAction(productId, definition.id), onDone)
          }
        >
          Archive in draft
        </Button>
      )}
    </form>
  );
}
function DefinitionEdit(props: {
  definition: Definition;
  productId: string;
  run: Run;
  pending: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-auto flex-col items-start">
          <span>{props.definition.label}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {props.definition.unit} / {props.definition.per.toLowerCase()}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <DefinitionForm {...props} />
      </PopoverContent>
    </Popover>
  );
}
function ValueCell({
  definition,
  tierId,
  interval,
  value,
  source,
  run,
  pending,
}: {
  definition: Definition;
  tierId: string;
  interval: Interval | null;
  value: unknown;
  source: string;
  run: Run;
  pending: boolean;
}) {
  const [input, setInput] = useState(value == null ? "" : String(value));
  const [boolean, setBoolean] = useState(value === true);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="min-w-20"
          aria-label={`${definition.label}, ${interval ?? "tier default"}, ${display(value)}, ${source}`}
        >
          {source === "OVERRIDE" && (
            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
          )}
          {display(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="space-y-3">
        <p className="text-sm font-medium">
          {definition.label} ·{" "}
          {interval ? cycleLabel(interval) : "Tier default"}
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const result =
              definition.valueType === "BOOL"
                ? boolean
                : definition.valueType === "INT"
                  ? Number(input)
                  : input;
            run(() =>
              saveEntitlementValueAction(
                definition.id,
                tierId,
                interval,
                result,
              ),
            );
          }}
        >
          {definition.valueType === "BOOL" ? (
            <Field label="Enabled">
              <Switch checked={boolean} onCheckedChange={setBoolean} />
            </Field>
          ) : (
            <Input
              aria-label="Entitlement value"
              required={definition.valueType === "INT"}
              type={definition.valueType === "INT" ? "number" : "text"}
              min={0}
              step={1}
              max={Number.MAX_SAFE_INTEGER}
              maxLength={2000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          )}
          <Button disabled={pending}>Save to draft</Button>
        </form>
        {interval && source === "OVERRIDE" && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(() => resetOverrideAction(definition.id, tierId, interval))
            }
          >
            Reset to tier default
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          {interval
            ? "Saving creates a cycle override."
            : "Fills every cycle without an override."}
        </p>
      </PopoverContent>
    </Popover>
  );
}
function NoticeHistory({
  productId,
  tiers,
  initial,
}: {
  productId: string;
  tiers: Data["tiers"];
  initial: History;
}) {
  const [loaded, setLoaded] = useState<{
    initial: History;
    result: History;
  } | null>(null);
  const history = loaded?.initial === initial ? loaded.result : initial;
  const [tierId, setTier] = useState("ALL");
  const [interval, setInterval] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pending, startTransition] = useTransition();
  const load = (page: number) =>
    startTransition(async () => {
      try {
        const result = await noticeHistoryAction(productId, {
          tierId: tierId === "ALL" ? undefined : tierId,
          interval,
          from,
          to,
          page,
        });
        if (result.ok) setLoaded({ initial, result: result.data });
        else toast.error(result.error.message);
      } catch {
        toast.error("Could not load notice history.");
      }
    });
  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          load(1);
        }}
      >
        <Field label="Tier">
          <Select value={tierId} onValueChange={setTier}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All tiers</SelectItem>
              {tiers.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Cycle">
          <Choice
            label="Cycle filter"
            value={interval}
            onChange={setInterval}
            options={["ALL", ...INTERVALS]}
          />
        </Field>
        <Field label="From">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="Through">
          <Input
            type="date"
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Button disabled={pending}>Filter</Button>
      </form>
      {history.rows.map((n) => (
        <div key={n.id} className="space-y-2 rounded-lg border p-4">
          <p className="font-medium">
            {n.tier.name} · {n.interval ? cycleLabel(n.interval) : "All cycles"}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {n.publishedAt.replace("T", " ").slice(0, 16)} UTC
            </span>
          </p>
          <p className="text-sm">
            {n.recipientCount} recipients · {n.emailStatuses.queued} queued ·{" "}
            {n.emailStatuses.sent} sent · {n.emailStatuses.failed} failed
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {Array.isArray(n.changes) &&
              n.changes.map((change, index) => {
                if (
                  !change ||
                  typeof change !== "object" ||
                  Array.isArray(change)
                )
                  return null;
                return (
                  <li key={index}>
                    {String(change.label ?? change.key ?? "Entitlement")}:{" "}
                    {display(change.before)} → {display(change.after)}
                    {change.unit ? ` ${change.unit}` : ""}
                    {change.per
                      ? ` per ${String(change.per).toLowerCase()}`
                      : ""}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
      {!history.rows.length && (
        <p className="p-6 text-sm text-muted-foreground">
          No notices match these filters.
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          disabled={pending || history.page <= 1}
          onClick={() => load(history.page - 1)}
        >
          Previous
        </Button>
        <span className="text-sm">
          Page {history.page} · {history.total} notices
        </span>
        <Button
          variant="outline"
          disabled={pending || history.page * history.pageSize >= history.total}
          onClick={() => load(history.page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
