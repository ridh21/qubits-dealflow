import { getReport, reportFilterOptions } from "@/server/queries/reports";
import { ReportWorkspace } from "./_components/report-workspace";
import { DomainError } from "@/domain/errors";
import { ZodError } from "zod";
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
      if (cause instanceof DomainError) error = cause.message;
      else if (cause instanceof ZodError)
        error = cause.issues[0]?.message ?? "Check the report filters.";
      else throw cause;
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
