import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { reportFixture } from "./fixtures/report";
import { reportWorkbook } from "@/server/exports/workbook";
import { reportPdf } from "@/server/pdf/report-doc";
import { invoicePdf } from "@/server/pdf/invoice-doc";
import { writeFile, mkdir } from "node:fs/promises";
describe("report exports", () => {
  it("exports all displayed rows with numeric money cells and filter metadata", async () => {
    const bytes = await reportWorkbook(reportFixture);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes.buffer as ArrayBuffer);
    expect(book.worksheets.map((s) => s.name)).toEqual([
      "Summary",
      "Quotations",
      "Approvals",
      "Discounts by Rep",
      "Upsell",
      "Categories",
      "Invoices",
    ]);
    expect(book.getWorksheet("Quotations")!.rowCount).toBe(44);
    expect(book.getWorksheet("Quotations")!.getCell("F2").value).toBe(1001.23);
    expect(book.getWorksheet("Summary")!.getCell("B2").value).toBe(
      "2026-09-01",
    );
  });
  it("renders multipage report and invoice PDFs", async () => {
    const report = await reportPdf(reportFixture);
    const invoice = await invoicePdf({
      number: "INV-1001",
      currency: "USD",
      customer: {
        name: "Acme Industries",
        billingAddress: "123 Market Street\nSan Francisco, CA",
      },
      issuedAt: new Date("2026-09-01"),
      dueAt: new Date("2026-09-30"),
      totalMinor: 1234567,
      paidMinor: 120000,
      creditAppliedMinor: 10000,
      status: "ISSUED",
      lines: [
        {
          id: "l",
          description: "Laptop Pro 14 with extended warranty and setup service",
          qty: 12,
          amountMinor: 1122334,
          taxMinor: 112233,
        },
      ],
    });
    for (const bytes of [report, invoice])
      expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    if (process.env.RENDER_EXPORT_FIXTURES) {
      await mkdir("/tmp/dealflow-exports", { recursive: true });
      await writeFile("/tmp/dealflow-exports/report.pdf", report);
      await writeFile("/tmp/dealflow-exports/invoice.pdf", invoice);
    }
  });
});
