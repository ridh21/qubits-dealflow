import { getReport } from "@/server/queries/reports";
import { attachment, exportError } from "@/server/exports/response";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ format: string }> },
) {
  const { format } = await params;
  if (!["pdf", "xlsx"].includes(format))
    return new Response("Not found", { status: 404 });
  try {
    const data = await getReport(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const body =
      format === "pdf"
        ? await (await import("@/server/pdf/report-doc")).reportPdf(data)
        : await (
            await import("@/server/exports/workbook")
          ).reportWorkbook(data);
    return attachment(
      body,
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      `dealflow-${data.filters.from}-${data.filters.to}.${format}`,
    );
  } catch (error) {
    return exportError(error);
  }
}
