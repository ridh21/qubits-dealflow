import type { ReportData } from "@/server/queries/reports";
export interface ReportSection {
  title: string;
  columns: { key: string; label: string; money?: boolean }[];
  rows: Record<string, string | number | null>[];
}
/** One projection feeds screen tables, PDF and workbook sheets. */
export function reportSections(data: ReportData): ReportSection[] {
  return [
    {
      title: "Quotations",
      columns: [
        { key: "number", label: "Quotation" },
        { key: "customer", label: "Customer" },
        { key: "owner", label: "Owner" },
        { key: "status", label: "Status" },
        { key: "currency", label: "Currency" },
        { key: "totalMinor", label: "Initial total", money: true },
      ],
      rows: data.quotations.map((q) => ({
        number: q.number,
        customer: q.customer,
        owner: q.owner,
        status: q.status,
        currency: q.currency,
        totalMinor: q.totalMinor,
      })),
    },
    {
      title: "Approvals",
      columns: [
        { key: "quotation", label: "Quotation" },
        { key: "role", label: "Role" },
        { key: "status", label: "Status" },
        { key: "started", label: "Started" },
        { key: "decided", label: "Decided" },
      ],
      rows: data.approvals.map((a) => ({
        quotation: a.quotation,
        role: a.role,
        status: a.status,
        started: a.startedAt.toISOString().slice(0, 10),
        decided: a.decidedAt?.toISOString().slice(0, 10) ?? null,
      })),
    },
    {
      title: "Discounts by Rep",
      columns: [
        { key: "owner", label: "Rep" },
        { key: "currency", label: "Currency" },
        { key: "grossMinor", label: "Gross", money: true },
        { key: "discountMinor", label: "Discount", money: true },
        { key: "percent", label: "Weighted discount %" },
      ],
      rows: data.discounts.map((d) => ({
        owner: d.owner,
        currency: d.currency,
        grossMinor: d.grossMinor,
        discountMinor: d.discountMinor,
        percent: d.discountBp / 100,
      })),
    },
    {
      title: "Upsell",
      columns: [
        { key: "product", label: "Product" },
        { key: "qty", label: "Quantity" },
        { key: "currency", label: "Currency" },
        { key: "netMinor", label: "Net", money: true },
      ],
      rows: data.upsell.map((u) => ({
        product: u.productName,
        qty: u.qty,
        currency: u.currency,
        netMinor: u.netMinor,
      })),
    },
    {
      title: "Categories",
      columns: [
        { key: "category", label: "Category" },
        { key: "currency", label: "Currency" },
        { key: "netMinor", label: "Net", money: true },
      ],
      rows: data.categories.map((c) => ({ ...c })),
    },
    {
      title: "Invoices",
      columns: [
        { key: "number", label: "Invoice" },
        { key: "customer", label: "Customer" },
        { key: "type", label: "Type" },
        { key: "currency", label: "Currency" },
        { key: "totalMinor", label: "Total", money: true },
        { key: "balanceMinor", label: "Balance", money: true },
      ],
      rows: data.invoices.map((i) => ({
        number: i.number,
        customer: i.customer,
        type: i.type,
        currency: i.currency,
        totalMinor: i.totalMinor,
        balanceMinor: i.balanceMinor,
      })),
    },
  ];
}
