import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternal } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { listPolicyHistory } from "@/server/services/policy.service";
import {
  PolicyKindZ,
  POLICY_META,
  canPublishPolicy,
} from "@/domain/policy/schemas";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HistoryView } from "../../_components/history-view";
export const metadata = { title: "Policy history · Admin" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const actor = await requireInternal(),
    { kind: raw } = await params,
    sp = await searchParams,
    parsed = PolicyKindZ.safeParse(raw);
  if (!parsed.success) notFound();
  const kind = parsed.data;
  const [history, versions] = await Promise.all([
    listPolicyHistory(kind, { page: Number(sp.page), q: sp.q }),
    prisma.policyVersion.findMany({
      where: { kind },
      orderBy: { version: "desc" },
      select: { id: true, version: true, payload: true, isActive: true },
    }),
  ]);
  const active = versions.find((v) => v.isActive),
    href = (page: number) =>
      `?${new URLSearchParams({ page: String(page), q: sp.q ?? "" })}`;
  return (
    <>
      <PageHeader
        title={`${POLICY_META[kind].title} history`}
        description="Compare versions, inspect publication reasons and restore through a new audited publication."
      />
      <Link
        className="text-sm underline"
        href={`/admin/policy/${POLICY_META[kind].slug}`}
      >
        Back to policy
      </Link>
      <form className="flex gap-3">
        <Input
          name="q"
          aria-label="Filter publication reason"
          placeholder="Filter by publication reason"
          defaultValue={sp.q}
        />
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>
      <HistoryView
        key={`${active?.id}-${sp.page}-${sp.q}`}
        rows={history.rows.map((r) => ({
          ...r,
          publishedAt: r.publishedAt.toISOString(),
        }))}
        compareVersions={versions}
        editable={canPublishPolicy(actor.role, kind)}
        activeId={active?.id ?? null}
        activePayload={active?.payload}
      />
      <nav
        aria-label="History pagination"
        className="flex items-center justify-between text-sm"
      >
        {history.page > 1 ? (
          <Link className="underline" href={href(history.page - 1)}>
            Previous
          </Link>
        ) : (
          <span />
        )}
        <span>
          Page {history.page} · {history.total} versions
        </span>
        {history.page * history.pageSize < history.total ? (
          <Link className="underline" href={href(history.page + 1)}>
            Next
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
