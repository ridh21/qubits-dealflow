import Link from "next/link";
import type { SubscriptionDetail } from "@/server/queries/subscriptions";
import { Section } from "@/components/layout/page-header";
import { Money } from "@/components/layout/money";
import { StatusBadge } from "@/components/layout/status-badge";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { dateLabel, label } from "../../_components/format";
import { ClockCounterClockwise } from "@/components/icons";
export function Schedule({
  subscription: s,
}: {
  subscription: SubscriptionDetail["subscription"];
}) {
  return (
    <Section
      title="Billing schedule"
      description="Amounts exclude tax. Paused and cancelled periods are skipped."
    >
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              {["Period (UTC)", "Amount", "Status", "Invoice"].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {s.schedule.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  {dateLabel(item.periodStart)} → {dateLabel(item.periodEnd)}
                </TableCell>
                <TableCell>
                  <Money minor={item.amountMinor} currency={s.order.currency} />
                </TableCell>
                <TableCell>
                  <StatusBadge value={item.status} />
                </TableCell>
                <TableCell>
                  {item.invoiceId ? (
                    <Link
                      className="underline"
                      href={`/invoices/${item.invoiceId}`}
                    >
                      View invoice
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!s.schedule.length && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  No billing periods scheduled yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}
export function OrderBilling({
  subscription: s,
}: {
  subscription: SubscriptionDetail["subscription"];
}) {
  return (
    <Section
      title="Originating order"
      description="Goods are billed on dispatch, services on completion, subscriptions at period start."
    >
      <Link
        className="text-sm font-medium underline"
        href={`/fulfillment/${s.orderId}`}
      >
        {s.order.number} · View fulfillment
      </Link>
      {(["PHYSICAL", "SERVICE", "SUBSCRIPTION"] as const).map((kind) => {
        const rows = s.order.lines.filter((line) => line.kind === kind);
        if (!rows.length) return null;
        return (
          <div key={kind} className="rounded-xl border bg-card">
            <h3 className="border-b px-4 py-3 text-sm font-medium">
              {kind === "PHYSICAL"
                ? "One-time lines"
                : kind === "SERVICE"
                  ? "Service lines"
                  : "Recurring lines"}
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  {["Product", "Quantity", "Progress / plan", "Invoices"].map(
                    (h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.productName}</TableCell>
                    <TableCell>{line.subscription?.qty ?? line.qty}</TableCell>
                    <TableCell>
                      {kind === "PHYSICAL" ? (
                        `${line.qtyShipped} shipped · ${line.qtyInvoiced} invoiced`
                      ) : kind === "SERVICE" ? (
                        line.completion ? (
                          `Completed ${dateLabel(line.completion.completedAt)}`
                        ) : (
                          "Awaiting completion"
                        )
                      ) : line.subscription ? (
                        <Link
                          className="underline"
                          href={`/subscriptions/${line.subscription.id}`}
                        >
                          {line.subscription.plan.name} ·{" "}
                          {label(line.subscription.plan.interval)}
                          <span className="block text-xs text-muted-foreground">
                            Next bill{" "}
                            {dateLabel(line.subscription.nextBillingDate)}
                          </span>
                        </Link>
                      ) : (
                        "Awaiting activation"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {s.order.invoices
                          .filter((invoice) =>
                            invoice.lines.some(
                              (item) =>
                                item.orderLineId === line.id ||
                                (!!line.subscription &&
                                  item.subscriptionId === line.subscription.id),
                            ),
                          )
                          .map((invoice) => (
                            <Link
                              key={invoice.id}
                              className="underline text-sm"
                              href={`/invoices/${invoice.id}`}
                            >
                              {invoice.number}
                            </Link>
                          ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </Section>
  );
}
export function AdjustmentHistory({
  subscription: s,
}: {
  subscription: SubscriptionDetail["subscription"];
}) {
  const invoices = s.order.invoices.filter(
    (invoice) =>
      invoice.type === "PRORATION" &&
      invoice.lines.some((line) => line.subscriptionId === s.id),
  );
  return (
    <Section title="Proration & credits">
      <div className="rounded-xl border bg-card divide-y">
        {invoices.map((invoice) => (
          <div
            key={invoice.id}
            className="flex justify-between gap-4 p-4 text-sm"
          >
            <div>
              <Link href={`/invoices/${invoice.id}`} className="underline">
                {invoice.number}
              </Link>
              <p className="text-muted-foreground">
                Proration charge · {dateLabel(invoice.issuedAt)}
              </p>
            </div>
            <Money minor={invoice.totalMinor} currency={invoice.currency} />
          </div>
        ))}
        {s.creditNotes.map((credit) => (
          <div
            key={credit.id}
            className="flex justify-between gap-4 p-4 text-sm"
          >
            <div>
              <p className="font-medium">{credit.number}</p>
              <p className="text-muted-foreground">
                {credit.reason} · {dateLabel(credit.createdAt)}
              </p>
              {credit.refundDueMinor > 0 && (
                <p>
                  Refund due:{" "}
                  <Money
                    minor={credit.refundDueMinor}
                    currency={s.order.currency}
                  />
                </p>
              )}
              {credit.sourceInvoiceId && (
                <Link
                  className="underline"
                  href={`/invoices/${credit.sourceInvoiceId}`}
                >
                  Source invoice
                </Link>
              )}
            </div>
            <span>
              Credit{" "}
              <Money minor={credit.amountMinor} currency={s.order.currency} />
            </span>
          </div>
        ))}
        {!invoices.length && !s.creditNotes.length && (
          <p className="p-5 text-sm text-muted-foreground">
            No adjustments or credits yet.
          </p>
        )}
      </div>
    </Section>
  );
}
export function TransitionTimeline({
  subscription: s,
}: {
  subscription: SubscriptionDetail["subscription"];
}) {
  return (
    <Section
      title="Transition timeline"
      description="Most recently recorded first. Effective dates may be in the future."
    >
      <ol className="space-y-5 rounded-xl border bg-card p-5">
        {s.transitions.map((item) => {
          const detail =
            item.detail &&
            typeof item.detail === "object" &&
            !Array.isArray(item.detail)
              ? item.detail
              : {};
          return (
            <li className="flex gap-3" key={item.id}>
              <ClockCounterClockwise className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium capitalize">
                  {label(item.type)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Effective {dateLabel(item.effectiveAt)} ·{" "}
                  {label(item.actorType)} · Recorded {dateLabel(item.createdAt)}
                </p>
                {typeof detail.reason === "string" && (
                  <p className="mt-1 text-sm">{detail.reason}</p>
                )}
                {detail.pending === true && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scheduled for the next billing boundary
                  </p>
                )}
              </div>
            </li>
          );
        })}
        {!s.transitions.length && (
          <li className="text-sm text-muted-foreground">
            No transitions recorded yet.
          </li>
        )}
      </ol>
    </Section>
  );
}
