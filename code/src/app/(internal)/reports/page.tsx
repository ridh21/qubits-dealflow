import { getReport, reportFilterOptions } from "@/server/queries/reports";
import { ReportWorkspace } from "./_components/report-workspace";
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const filters = await searchParams;
  const options = await reportFilterOptions();
  let report = null;
  let error = "";
  if (filters.generated === "1") {
    try {
      report = await getReport(filters);
    } catch (cause) {
      error =
        cause instanceof Error ? cause.message : "Unable to generate report.";
    }
  }
  return (
    <ReportWorkspace
      options={options}
      report={report}
      error={error}
      initial={filters}
    />
  );
}
