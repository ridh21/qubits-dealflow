"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { listHealthAlerts } from "@/server/queries/deal-health";
import {
  healthAlertAction,
  scanHealthAction,
} from "@/server/actions/deal-health";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { DatePicker } from "@/components/forms/date-picker";
import { Repeat, Check, Envelope, WarningCircle } from "@/components/icons";
const kinds = [
  "STALLED",
  "DISCOUNT_ANOMALY",
  "DELIVERY_SLIPPAGE",
  "APPROVAL_SLA",
];
const label = (value: string) => value.toLowerCase().replaceAll("_", " ");
export function HealthWorkspace({
  data,
  filters,
}: {
  data: Awaited<ReturnType<typeof listHealthAlerts>>;
  filters: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<{
    id: string;
    action: "NUDGE" | "ESCALATE" | "RESOLVE";
  } | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [insufficient, setInsufficient] = useState<
    { quotationId: string; number: string; samples: number }[]
  >([]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!pending && !selected && document.visibilityState === "visible")
        router.refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [router, pending, selected]);
  function href(key: string, value: string) {
    const query = new URLSearchParams(
      Object.entries(filters).filter(
        (pair): pair is [string, string] => !!pair[1],
      ),
    );
    if (value) query.set(key, value);
    else query.delete(key);
    if (key !== "page") query.delete("page");
    return `/deal-health?${query}`;
  }
  const selects = [
    {
      key: "type",
      title: "Issue",
      values: kinds.map((v) => ({ id: v, name: label(v) })),
    },
    {
      key: "severity",
      title: "Severity",
      values: ["MEDIUM", "HIGH"].map((v) => ({ id: v, name: label(v) })),
    },
    {
      key: "status",
      title: "Status",
      values: ["OPEN", "NUDGED", "ESCALATED", "RESOLVED"].map((v) => ({
        id: v,
        name: label(v),
      })),
    },
    { key: "owner", title: "Owner", values: data.users },
    { key: "team", title: "Team", values: data.teams },
  ];
  return (
    <>
      <WorkspaceActions>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await scanHealthAction();
              if (!result.ok) setMessage(result.error.message);
              else {
                setMessage(
                  `${result.data.detected} active conditions; ${result.data.resolved} cleared.`,
                );
                setInsufficient(result.data.insufficientHistory);
                router.refresh();
              }
            })
          }
        >
          <Repeat />
          Run health scan
        </Button>
      </WorkspaceActions>
      <PageHeader
        title="Deal health"
        description="Operational risks that need attention. Refreshes every 15 seconds."
      />
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kinds.map((type) => (
          <Link
            key={type}
            href={href("type", type)}
            className="rounded-xl border p-5"
          >
            <p className="text-sm capitalize text-muted-foreground">
              {label(type)}
            </p>
            <p className="mt-2 text-3xl font-semibold">
              {data.groups.find((g) => g.type === type)?._count ?? 0}
            </p>
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {selects.map((filter) => (
          <Select
            key={filter.key}
            value={filters[filter.key] || "all"}
            onValueChange={(value) =>
              router.push(href(filter.key, value === "all" ? "" : value))
            }
          >
            <SelectTrigger className="w-44" aria-label={filter.title}>
              <SelectValue placeholder={filter.title} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All {filter.title.toLowerCase()}
              </SelectItem>
              {filter.values.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {["from", "until"].map((key) => (
          <DatePicker
            key={key}
            label={key === "from" ? "Flagged from" : "Flagged until"}
            value={filters[key] ? new Date(filters[key]) : undefined}
            onChange={(date) =>
              router.push(href(key, date?.toISOString().slice(0, 10) ?? ""))
            }
          />
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {[
              "Deal",
              "Issue",
              "Severity",
              "Flagged",
              "Last action",
              "Actions",
            ].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((alert) => (
            <TableRow key={alert.id}>
              <TableCell>
                <Link
                  className="text-primary"
                  href={
                    alert.quotationId
                      ? `/quotations/${alert.quotationId}`
                      : `/fulfillment/${alert.orderId}`
                  }
                >
                  {alert.quotation?.number ?? alert.order?.number}
                </Link>
              </TableCell>
              <TableCell>
                <p className="capitalize">{label(alert.type)}</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  {typeof alert.detail === "object" &&
                  alert.detail &&
                  !Array.isArray(alert.detail)
                    ? String(alert.detail.label ?? "")
                    : ""}
                </p>
              </TableCell>
              <TableCell>{label(alert.severity)}</TableCell>
              <TableCell>{alert.flaggedAt.toLocaleDateString()}</TableCell>
              <TableCell>{alert.lastAction ?? "New"}</TableCell>
              <TableCell>
                {alert.status !== "RESOLVED" && (
                  <div className="flex gap-1">
                    {[
                      {
                        action: "NUDGE" as const,
                        title: "Nudge rep",
                        Icon: Envelope,
                      },
                      {
                        action: "ESCALATE" as const,
                        title: "Escalate",
                        Icon: WarningCircle,
                      },
                      {
                        action: "RESOLVE" as const,
                        title: "Resolve",
                        Icon: Check,
                      },
                    ].map(({ action, title, Icon }) => (
                      <Button
                        key={action}
                        size="icon"
                        variant="ghost"
                        aria-label={title}
                        onClick={() => {
                          setNote("");
                          setSelected({ id: alert.id, action });
                        }}
                      >
                        <Icon />
                      </Button>
                    ))}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
          {!data.rows.length && (
            <TableRow>
              <TableCell colSpan={6}>No alerts match these filters.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <nav aria-label="Alert pages" className="flex gap-4 text-sm">
        {data.page > 1 && (
          <Link href={href("page", String(data.page - 1))}>Previous</Link>
        )}
        <span>
          Page {data.page} of {data.pages}
        </span>
        {data.page < data.pages && (
          <Link href={href("page", String(data.page + 1))}>Next</Link>
        )}
      </nav>
      {insufficient.length > 0 && (
        <section className="rounded-xl border p-5">
          <h2 className="font-semibold">Insufficient discount history</h2>
          <p className="text-sm text-muted-foreground">
            These deals have too few prior submitted quotations to evaluate an
            anomaly.
          </p>
          {insufficient.map((q) => (
            <p key={q.quotationId} className="text-sm">
              {q.number}: {q.samples} samples
            </p>
          ))}
        </section>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !pending) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected ? label(selected.action) : "Alert action"}
            </DialogTitle>
            <DialogDescription>
              Add context for the audit record and recipient.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Reason"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            disabled={pending || !note.trim()}
            onClick={() => {
              if (!selected) return;
              start(async () => {
                const result = await healthAlertAction({ ...selected, note });
                if (!result.ok) setMessage(result.error.message);
                else {
                  setSelected(null);
                  router.refresh();
                }
              });
            }}
          >
            <Check />
            {pending ? "Saving…" : "Confirm action"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
