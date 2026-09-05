import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { FiltersBar } from "@/components/filters/filters-bar";
import { SearchInput } from "@/components/filters/search-input";
import { SelectFilter } from "@/components/filters/select-filter";
import { StatusBadge } from "@/components/layout/status-badge";
import { listEmails } from "@/server/queries/admin";
import { requireInternal } from "@/server/auth/guards";
import { Envelope } from "@/components/icons";
import { SendQueuedButton } from "./_components/send-queued-button";
import { EmailPreview } from "./_components/email-preview";

export const metadata = { title: "Email outbox · Admin" };

type Row = Awaited<ReturnType<typeof listEmails>>["rows"][number];

export default async function EmailsPage({ searchParams }: PageProps<"/admin/emails">) {
  const user = await requireInternal();
  const sp = await searchParams;
  const { rows, total, page, pageSize, pageCount } = await listEmails(sp);

  const columns: Column<Row>[] = [
    {
      key: "createdAt",
      header: "Queued",
      cell: (r) => (
        <span className="text-muted-foreground tabular text-xs">{r.createdAt.toLocaleString()}</span>
      ),
    },
    {
      key: "to",
      header: "To",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.toName ?? r.toEmail}</p>
          {r.toName ? <p className="text-muted-foreground text-xs">{r.toEmail}</p> : null}
        </div>
      ),
    },
    { key: "subject", header: "Subject", cell: (r) => r.subject },
    {
      key: "related",
      header: "Related",
      cell: (r) => (
        <span className="text-muted-foreground text-xs">
          {r.relatedType ? `${r.relatedType}` : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <StatusBadge value={r.status} />
          {r.error ? <span className="text-destructive text-xs">{r.error.slice(0, 40)}</span> : null}
        </div>
      ),
    },
    {
      key: "preview",
      header: "",
      align: "right",
      cell: (r) => (
        <EmailPreview
          email={{ subject: r.subject, to: r.toEmail, text: r.textBody, html: r.htmlBody }}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Email outbox"
        description="Everything the system queues — approvals, portal links, plan change notices."
        actions={user.role === "ADMIN" ? <SendQueuedButton /> : null}
      />

      <FiltersBar>
        <SearchInput placeholder="Search subject or recipient…" />
        <SelectFilter
          param="status"
          label="Status"
          width="w-[150px]"
          options={[
            { value: "QUEUED", label: "Queued" },
            { value: "SENT", label: "Sent" },
            { value: "FAILED", label: "Failed" },
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
        getRowKey={(r) => r.id}
        empty={{
          title: "The outbox is empty",
          description: "Approvals, invitations and notices land here as they are queued.",
          icon: <Envelope className="size-8" weight="duotone" />,
        }}
      />
    </>
  );
}
