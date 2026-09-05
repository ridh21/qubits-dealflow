import { requireInternal } from "@/server/auth/guards";
import { buildAnalytics } from "@/server/queries/analytics";
import { prisma } from "@/server/db";
import { AnalyticsWorkspace } from "./_components/analytics-workspace";
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requireInternal();
  const params = await searchParams;
  const now = new Date();
  const raw = {
    from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10),
    to: now.toISOString().slice(0, 10),
    ...params,
  };
  const [data, teams] = await Promise.all([
    buildAnalytics(actor, raw),
    prisma.team.findMany({
      where: ["SALES_REP", "SALES_MANAGER"].includes(actor.role)
        ? { id: actor.teamId ?? "" }
        : {},
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <AnalyticsWorkspace
      key={`${data.view}-${JSON.stringify(data.filters)}`}
      data={data}
      teams={teams}
    />
  );
}
