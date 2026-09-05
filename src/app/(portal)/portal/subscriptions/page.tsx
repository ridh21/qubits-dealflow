import { PageHeader } from "@/components/layout/page-header";
import { portalActor, listMySubscriptions } from "@/server/queries/portal";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { SelectFilter } from "@/components/filters/select-filter";
import { FiltersBar } from "@/components/filters/filters-bar";
import { StatusBadge } from "@/components/layout/status-badge";
import { Repeat } from "@/components/icons";

export const metadata = { title: "My subscriptions · DealFlow360" };

type Row = Awaited<ReturnType<typeof listMySubscriptions>>["rows"][number];

const date = (d: Date | null | undefined) =>
  d ? (
    <span className="tabular text-muted-foreground">
      {d.toISOString().slice(0, 10)}
    </span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );

export default async function SubscriptionsPage({
  searchParams,
}: PageProps<"/portal/subscriptions">) {
  const sp = await searchParams;
  const { rows, total, page, pageSize, pageCount } = await listMySubscriptions(
    await portalActor(),
    sp,
  );

  const columns: Column<Row>[] = [
    {
      key: "plan",
      header: "Subscription",
      cell: (s) => `${s.orderLine.productName} · ${s.plan.tier?.name ?? s.plan.name}`,
    },
    {
      key: "interval",
      header: "Cycle",
      cell: (s) => (
        <span className="text-muted-foreground capitalize">
          {s.plan.interval.toLowerCase()}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (s) => <StatusBadge value={s.status} />,
    },
    { key: "nextBillingDate", header: "Next bill", align: "right", cell: (s) => date(s.nextBillingDate) },
    { key: "pauseEffectiveAt", header: "Pause effective", align: "right", cell: (s) => date(s.pauseEffectiveAt) },
    { key: "resumeAt", header: "Resume", align: "right", cell: (s) => date(s.resumeAt) },
  ];

  return (
    <>
      <PageHeader
        title="My subscriptions"
        description="Billing cycles, scheduled pauses and what each plan entitles you to."
      />

      <FiltersBar>
        <SelectFilter
          param="status"
          label="Status"
          width="w-[190px]"
          options={[
            { value: "SCHEDULED", label: "Scheduled" },
            { value: "ACTIVE", label: "Active" },
            { value: "PAUSE_SCHEDULED", label: "Pause scheduled" },
            { value: "PAUSED", label: "Paused" },
            { value: "CANCELLED", label: "Cancelled" },
          ]}
        />
      </FiltersBar>

      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        pageCount={pageCount}
        caption="My subscriptions"
        getRowKey={(s) => s.id}
        getRowHref={(s) => `/portal/subscriptions/${s.id}`}
        empty={{
          title: "No subscriptions to show",
          description: "Recurring plans you buy will be listed here.",
          icon: <Repeat className="size-5" weight="duotone" />,
        }}
      />
    </>
  );
}
