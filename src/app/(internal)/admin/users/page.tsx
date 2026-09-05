import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { FiltersBar } from "@/components/filters/filters-bar";
import { SearchInput } from "@/components/filters/search-input";
import { SelectFilter } from "@/components/filters/select-filter";
import { StatusBadge } from "@/components/layout/status-badge";
import { listUsers } from "@/server/queries/admin";
import { requireInternal } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { Users } from "@/components/icons";
import { UserRowActions } from "./_components/user-row-actions";
import { CreateTeamDialog } from "./_components/create-team-dialog";

export const metadata = { title: "Users · Admin" };

type Row = Awaited<ReturnType<typeof listUsers>>["rows"][number];

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const user = await requireInternal();
  const sp = await searchParams;
  const { rows, total, page, pageSize, pageCount } = await listUsers(sp);
  const teams = await prisma.team.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const canManage = user.role === "ADMIN";

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      cell: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-muted-foreground text-xs">{r.email}</p>
        </div>
      ),
    },
    { key: "role", header: "Role", sortable: true, cell: (r) => <StatusBadge value={r.role} /> },
    {
      key: "team",
      header: "Team",
      cell: (r) => <span className="text-muted-foreground">{r.team?.name ?? r.customer?.name ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge value={r.isActive ? "ACTIVE" : "INACTIVE"} />,
    },
    {
      key: "lastLoginAt",
      header: "Last sign-in",
      sortable: true,
      cell: (r) => (
        <span className="text-muted-foreground tabular text-xs">
          {r.lastLoginAt ? r.lastLoginAt.toLocaleDateString() : "Never"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (r) =>
        canManage ? (
          <UserRowActions
            user={{ id: r.id, name: r.name, role: r.role, isActive: r.isActive, teamId: r.teamId }}
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
          />
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Users & roles"
        description="Signups arrive as pending. Assigning a role activates the account and emails the user."
        actions={canManage ? <CreateTeamDialog /> : null}
      />

      <FiltersBar>
        <SearchInput placeholder="Search name or email…" />
        <SelectFilter
          param="role"
          label="Role"
          options={[
            { value: "PENDING", label: "Pending" },
            { value: "ADMIN", label: "Admin" },
            { value: "SALES_MANAGER", label: "Sales manager" },
            { value: "SALES_REP", label: "Sales rep" },
            { value: "FINANCE", label: "Finance" },
            { value: "CUSTOMER", label: "Customer" },
          ]}
        />
        <SelectFilter
          param="teamId"
          label="Team"
          options={teams.map((t) => ({ value: t.id, label: t.name }))}
        />
        <SelectFilter
          param="status"
          label="Status"
          width="w-[150px]"
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
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
          title: "No users match these filters",
          description: "Clear the filters, or invite a teammate to sign up.",
          icon: <Users className="size-8" weight="duotone" />,
        }}
      />
    </>
  );
}
