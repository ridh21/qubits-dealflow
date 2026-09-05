import ExcelJS from "exceljs";
import type { ReportData } from "@/server/queries/reports";
import { reportSections } from "@/server/reports/sections";
export async function reportWorkbook(data: ReportData) {
  const book = new ExcelJS.Workbook();
  book.creator = "DealFlow360";
  book.created = data.generatedAt;
  const summary = book.addWorksheet("Summary");
  summary.columns = [
    { header: "Metric", key: "metric", width: 36 },
    { header: "Value", key: "value", width: 30 },
  ];
  summary.addRows([
    { metric: "From (IST)", value: data.filters.from },
    { metric: "Through (IST)", value: data.filters.to },
    { metric: "Quotations", value: data.summary.total },
    { metric: "Confirmed quotations", value: data.summary.confirmed },
    { metric: "Conversion rate", value: data.summary.rate },
    {
      metric: "Average approval hours",
      value: data.summary.approvalHours.overall,
    },
    { metric: "Open alerts", value: data.summary.openAlerts },
  ]);
  for (const [key, value] of Object.entries(data.filters))
    if (!["from", "to"].includes(key) && value)
      summary.addRow({ metric: `Filter: ${key}`, value });
  for (const currency of data.currencies)
    summary.addRows([
      {
        metric: `Invoiced (${currency.currency})`,
        value: currency.revenueMinor / 100,
      },
      {
        metric: `Discount (${currency.currency})`,
        value: currency.discountMinor / 100,
      },
      {
        metric: `Normalized MRR (${currency.currency})`,
        value: currency.normalisedMrrMinor / 100,
      },
    ]);
  for (const section of reportSections(data)) {
    const sheet = book.addWorksheet(section.title);
    sheet.columns = section.columns.map((column) => ({
      header: column.label,
      key: column.key,
      width: column.money ? 20 : 26,
    }));
    for (const row of section.rows)
      sheet.addRow(
        Object.fromEntries(
          section.columns.map((column) => [
            column.key,
            column.money && typeof row[column.key] === "number"
              ? (row[column.key] as number) / 100
              : row[column.key],
          ]),
        ),
      );
    section.columns.forEach((column, index) => {
      if (column.money)
        sheet.getColumn(index + 1).numFmt = "#,##0.00;[Red]-#,##0.00";
    });
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, sheet.rowCount), column: section.columns.length },
    };
  }
  for (const sheet of book.worksheets) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFB45309" },
    };
    sheet.getRow(1).height = 24;
    sheet.eachRow((row) => {
      row.alignment = { vertical: "top", wrapText: true };
    });
  }
  return new Uint8Array(await book.xlsx.writeBuffer());
}
