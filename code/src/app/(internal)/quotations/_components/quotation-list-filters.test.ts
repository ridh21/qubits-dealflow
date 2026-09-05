import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { parseQuotationListParams } from "@/domain/quotation/list-params";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { QuotationListFilters } from "./quotation-list-filters";

describe("quotation filter form", () => {
  it("renders URL selections, exact amounts, date bounds and repeatable statuses", () => {
    const raw = {
      status: ["SENT", "CONFIRMED"],
      ownerId: "self",
      teamId: "team",
      customerId: "customer",
      riskBand: "HIGH",
      minAmount: "1.15",
      maxAmount: "100",
      createdFrom: "2026-09-01",
      createdTo: "2026-09-05",
      hasOpenProposals: "false",
      view: "board",
      sort: "totalMinor",
      dir: "asc",
      pageSize: "50",
    };
    const html = renderToStaticMarkup(
      createElement(QuotationListFilters, {
        raw,
        params: parseQuotationListParams(raw),
        options: {
          owners: [{ id: "self", name: "Self" }],
          teams: [{ id: "team", name: "My team" }],
          customers: [{ id: "customer", name: "Customer" }],
        },
      }),
    );
    for (const key of Object.keys(raw)) expect(html).toContain(`name="${key}"`);
    expect(html).toContain('name="minAmount"');
    expect(html).toContain('value="1.15"');
    expect(html).toContain('name="createdTo" value="2026-09-05"');
    expect(html).toContain('name="hasOpenProposals" value="false"');
    expect(html).toContain('name="view" value="board"');
    expect(html.match(/aria-checked="true"/g)).toHaveLength(2);
    expect(html).toContain('value="SENT"');
    expect(html).toContain('value="CONFIRMED"');
    expect(html).toContain('type="submit"');
  });
});
