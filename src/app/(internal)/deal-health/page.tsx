import { listHealthAlerts } from "@/server/queries/deal-health";
import { HealthWorkspace } from "./_components/health-workspace";
export default async function DealHealthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const filters = await searchParams;
  return (
    <HealthWorkspace data={await listHealthAlerts(filters)} filters={filters} />
  );
}
