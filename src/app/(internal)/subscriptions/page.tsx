import Link from "next/link";
import { listSubscriptions } from "@/server/queries/subscriptions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/layout/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { BillingAction } from "./_components/billing-action";
import { dateLabel, label } from "./_components/format";
export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const filters = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      typeof value === "string" ? value : undefined,
    ]),
  );
  const data = await listSubscriptions(filters);
  const href = (page: number) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && key !== "page") params.set(key, value);
    });
    params.set("page", String(page));
    return `/subscriptions?${params}`;
  };
  const selects = [
    {
      name: "status",
      title: "Status",
      options: [
        "SCHEDULED",
        "ACTIVE",
        "PAUSE_SCHEDULED",
        "PAUSED",
        "CANCELLED",
      ].map((id) => ({ id, name: label(id) })),
    },
    {
      name: "cycle",
      title: "Cycle",
      options: ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"].map((id) => ({
        id,
        name: label(id),
      })),
    },
    { name: "customer", title: "Customer", options: data.customers },
    {
      name: "plan",
      title: "Plan",
      options: data.plans.map((plan) => ({
        ...plan,
        name: `${plan.name} · ${label(plan.interval)}`,
      })),
    },
    { name: "tier", title: "Tier", options: data.tiers },
  ];
  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Manage recurring billing, plan changes and scheduled pauses."
      />
      <BillingAction />
      <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3 xl:grid-cols-5">
        <label className="space-y-1 text-sm sm:col-span-2">
          Search
          <Input
            name="q"
            placeholder="Customer or product"
            defaultValue={filters.q}
          />
        </label>
        {selects.map((select) => (
          <label key={select.name} className="space-y-1 text-sm">
            {select.title}
            <select
              name={select.name}
              defaultValue={filters[select.name] ?? ""}
              className="h-9 w-full rounded-md border bg-background px-2 capitalize"
            >
              <option value="">All {select.title.toLowerCase()}s</option>
              {select.options.map((option) => (
                <option value={option.id} key={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="space-y-1 text-sm">
          Next bill from
          <Input type="date" name="from" defaultValue={filters.from} />
        </label>
        <label className="space-y-1 text-sm">
          Next bill through
          <Input type="date" name="until" defaultValue={filters.until} />
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit" variant="secondary">
            Apply filters
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/subscriptions">Reset</Link>
          </Button>
        </div>
      </form>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "Customer",
                "Product / tier",
                "Cycle",
                "Next bill",
                "Pause effective",
                "Resume",
                "Status",
              ].map((title) => (
                <TableHead key={title}>{title}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    className="font-medium underline-offset-4 hover:underline"
                    href={`/subscriptions/${row.id}`}
                  >
                    {row.customer.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/subscriptions/${row.id}`}
                    className="hover:underline"
                  >
                    {row.orderLine.productName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {row.plan.tier?.name ?? row.plan.name}
                  </p>
                </TableCell>
                <TableCell className="capitalize">
                  {label(row.plan.interval)}
                </TableCell>
                <TableCell>{dateLabel(row.nextBillingDate)}</TableCell>
                <TableCell>{dateLabel(row.pauseEffectiveAt)}</TableCell>
                <TableCell>{dateLabel(row.resumeAt)}</TableCell>
                <TableCell>
                  <StatusBadge value={row.status} />
                </TableCell>
              </TableRow>
            ))}
            {!data.rows.length && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-40 text-center text-muted-foreground"
                >
                  No subscriptions match these filters. Subscriptions are
                  created from confirmed recurring orders.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          {data.total} subscriptions · Page {data.page} of {data.pages}
        </p>
        <div className="flex gap-3">
          {data.page > 1 && (
            <Link href={href(data.page - 1)} className="underline">
              Previous
            </Link>
          )}
          {data.page < data.pages && (
            <Link href={href(data.page + 1)} className="underline">
              Next
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
