import { listApprovals } from "@/server/queries/approvals";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { FiltersBar } from "@/components/filters/filters-bar";
import { SearchInput } from "@/components/filters/search-input";
import { SelectFilter } from "@/components/filters/select-filter";
import { StatusBadge } from "@/components/layout/status-badge";
import { ShieldCheck } from "@/components/icons";

export const metadata = { title: "Approvals · DealFlow360" };

type Row = Awaited<ReturnType<typeof listApprovals>>["rows"][number];

export default async function ApprovalsPage({
  searchParams,
}: PageProps<"/approvals">) {
  const sp = await searchParams;
  const { rows, total, page, pageSize, pageCount } = await listApprovals(sp);

  const columns: Column<Row>[] = [
    {
      key: "quotation",
      header: "Quotation",
      cell: (r) => `${r.quotation.number} · v${r.quotationVersion}`,
    },
    {
      key: "customer",
      header: "Customer",
      cell: (r) => r.quotation.customer.name,
    },
    {
      key: "riskBand",
      header: "Risk",
      sortable: true,
      cell: (r) => <StatusBadge value={r.riskBand} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (r) => <StatusBadge value={r.status} />,
    },
    {
      key: "reviewer",
      header: "Current reviewer",
      cell: (r) => {
        const current = r.steps.find((s) => s.status === "PENDING");
        return current ? (
          current.role.replaceAll("_", " ").toLowerCase()
        ) : (
          <span className="text-muted-foreground">Complete</span>
        );
      },
    },
    {
      key: "dueAt",
      header: "SLA due",
      align: "right",
      cell: (r) => {
        const current = r.steps.find((s) => s.status === "PENDING");
        const due = current?.dueAt;
        if (!due) return <span className="text-muted-foreground">—</span>;
        const late = due < new Date();
        return (
          <span
            className={
              late ? "tabular text-destructive font-medium" : "tabular text-muted-foreground"
            }
          >
            {due.toISOString().slice(0, 16).replace("T", " ")}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Sequential reviews, evaluated against a preserved policy version."
      />

      <FiltersBar>
        <SearchInput placeholder="Search quotation or customer…" />
        <SelectFilter
          param="status"
          label="Status"
          width="w-[170px]"
          options={[
            { value: "PENDING", label: "Pending" },
            { value: "APPROVED", label: "Approved" },
            { value: "REJECTED", label: "Rejected" },
            { value: "RETURNED", label: "Returned" },
            { value: "SUPERSEDED", label: "Superseded" },
          ]}
        />
        <SelectFilter
          param="riskBand"
          label="Risk"
          width="w-[150px]"
          options={[
            { value: "LOW", label: "Low" },
            { value: "MEDIUM", label: "Medium" },
            { value: "HIGH", label: "High" },
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
        caption="Approval requests"
        getRowKey={(r) => r.id}
        getRowHref={(r) => `/approvals/${r.id}`}
        empty={{
          title: "No reviews match these filters",
          description:
            "Submit a quotation to evaluate its approval route against the active policy.",
          icon: <ShieldCheck className="size-5" weight="duotone" />,
        }}
      />
    </>
  );
}
