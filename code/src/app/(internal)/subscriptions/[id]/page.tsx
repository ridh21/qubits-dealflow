import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubscription } from "@/server/queries/subscriptions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/layout/status-badge";
import { Money } from "@/components/layout/money";
import { periodAmount } from "@/domain/proration/prorate";
import { ArrowLeft } from "@/components/icons";
import { SubscriptionControls } from "./_components/subscription-controls";
import { EntitlementsCard } from "./_components/entitlements-card";
import {
  Schedule,
  OrderBilling,
  AdjustmentHistory,
  TransitionTimeline,
} from "./_components/billing-sections";
import { dateLabel, label } from "../_components/format";
import { BillingAction } from "../_components/billing-action";
export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSubscription(id);
  if (!data) notFound();
  const { subscription: s, plans, resumeBoundaries, nextEntitlements } = data;
  return (
    <>
      <Link
        href="/subscriptions"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Subscriptions
      </Link>
      <PageHeader
        title={s.orderLine.productName}
        description={`${s.customer.name} · ${s.plan.tier?.name ?? s.plan.name} · ${label(s.plan.interval)}`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge value={s.status} />
        <span className="text-sm text-muted-foreground">
          {s.plan.name} · Quantity {s.qty}
        </span>
      </div>
      <SubscriptionControls
        id={s.id}
        status={s.status}
        qty={s.qty}
        planId={s.planId}
        currency={s.order.currency}
        activationDate={s.activationDate.toISOString()}
        periodEnd={s.currentPeriodEnd?.toISOString() ?? null}
        pauseAt={s.pauseEffectiveAt?.toISOString() ?? null}
        resumeAt={s.resumeAt?.toISOString() ?? null}
        cancelAt={s.cancelEffectiveAt?.toISOString() ?? null}
        anchor={s.billingAnchor.toISOString()}
        interval={s.plan.interval}
        boundaries={resumeBoundaries.map((date) => date.toISOString())}
        plans={plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          interval: plan.interval,
          priceMinor: plan.priceMinor,
        }))}
      />
      <BillingAction />
      {s.cancelEffectiveAt && (
        <p className="rounded-lg border bg-muted p-4 text-sm">
          {s.status === "CANCELLED" ? "Cancelled" : "Cancellation scheduled"} ·{" "}
          {dateLabel(s.cancelEffectiveAt)}. Any scheduled resume has been
          cleared.
        </p>
      )}
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Recurring amount · before tax",
            value: (
              <Money
                minor={periodAmount(s.qty, s.unitPriceMinor, s.discountBp)}
                currency={s.order.currency}
              />
            ),
          },
          { title: "Next bill", value: dateLabel(s.nextBillingDate) },
          { title: "Pause effective", value: dateLabel(s.pauseEffectiveAt) },
          { title: "Resume", value: dateLabel(s.resumeAt) },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border bg-card p-5">
            <dt className="text-xs text-muted-foreground">{item.title}</dt>
            <dd className="mt-2 text-xl font-semibold">{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        Activation {dateLabel(s.activationDate)} · Current period{" "}
        {dateLabel(s.currentPeriodStart)} → {dateLabel(s.currentPeriodEnd)} ·
        Dates shown in UTC
      </p>
      <Schedule subscription={s} />
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <EntitlementsCard
          current={s.entitlementsSnapshot}
          next={s.status === "CANCELLED" ? {} : nextEntitlements}
          boundary={s.resumeAt ?? s.currentPeriodEnd ?? s.activationDate}
          paused={s.status === "PAUSED"}
        />
        <TransitionTimeline subscription={s} />
      </div>
      <AdjustmentHistory subscription={s} />
      <OrderBilling subscription={s} />
    </>
  );
}
