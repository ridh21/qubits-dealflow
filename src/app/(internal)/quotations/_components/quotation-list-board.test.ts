import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuotationListBoard } from "./quotation-list-board";
import { quotationStatuses } from "@/domain/quotation/list-params";

const rows = quotationStatuses.map((status, index) => ({
  id: String(index),
  number: `QUO-${index}`,
  version: 2,
  status,
  currency: "USD",
  totalMinor: 11500,
  oneTimeNetMinor: 10000,
  riskBand: "LOW" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  owner: { name: "Owner" },
  customer: { name: "Customer" },
}));
describe("quotation pipeline rendering", () => {
  it("renders each result once, including closed quotes, with non-draggable links", () => {
    const html = renderToStaticMarkup(
      createElement(QuotationListBoard, { rows }),
    );
    for (const row of rows) {
      expect(html.split(`href="/quotations/${row.id}"`)).toHaveLength(2);
    }
    expect(html).toContain('aria-label="Sent / Negotiation"');
    expect(html).toContain('aria-label="Closed"');
    expect(html.match(/draggable="false"/g)).toHaveLength(rows.length);
    expect(html).toContain("initial total");
    expect(html).toContain("one-time net");
    expect(html).toContain("this page’s results");
  });
  it("keeps the six stages with an explicit empty state", () => {
    const html = renderToStaticMarkup(
      createElement(QuotationListBoard, { rows: [] }),
    );
    expect(html.match(/<section/g)).toHaveLength(6);
    expect(html).toContain("No quotations match");
    expect(html).not.toContain('aria-label="Closed"');
  });
});
