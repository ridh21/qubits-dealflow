import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/actions/approvals", () => ({ submitQuoteAction: vi.fn() }));
vi.mock("@/server/actions/quotations", () => ({
  addQuoteLineAction: vi.fn(),
  saveQuoteAction: vi.fn(),
  removeQuoteLineAction: vi.fn(),
  repriceQuoteAction: vi.fn(),
  reviseQuoteAction: vi.fn(),
  cancelQuoteAction: vi.fn(),
}));
vi.mock("../_actions/change-customer", () => ({
  changeQuotationCustomerAction: vi.fn(),
}));
vi.mock("@/components/layout/workspace-actions", () => ({
  WorkspaceActions: ({ children }: { children: ReactNode }) =>
    createElement("aside", null, children),
}));
import { QuoteBuilder } from "./quote-builder";
function render(role: string, status = "DRAFT", id = "owner") {
  const props = {
    data: {
      actor: { id, role, name: "Rep" },
      quote: {
        id: "quote",
        version: 3,
        ownerId: "owner",
        owner: { name: "Rep" },
        status,
        customerId: "customer",
        customer: { name: "Alpha", tier: "GOLD" },
        lines: [],
        versions: [],
        orderDiscountBp: 0,
        customerNote: null,
        validUntil: null,
        requestedDeliveryDate: null,
        currency: "USD",
        oneTimeNetMinor: 0,
        oneTimeMarginMinor: 0,
        recurringByCycle: {},
      },
    },
    products: [],
    customers: [{ id: "customer", name: "Alpha", tier: "GOLD" }],
  } as unknown as Parameters<typeof QuoteBuilder>[0];
  return renderToStaticMarkup(createElement(QuoteBuilder, props));
}
describe("quotation builder rendering", () => {
  it("places primary actions in the sidebar and exposes the customer combobox to its owner", () => {
    const html = render("SALES_REP");
    const sidebar = html.slice(
      html.indexOf("<aside>"),
      html.indexOf("</aside>"),
    );
    for (const action of [
      "Apply customer change",
      "Save changes",
      "Version history",
      "Reload data",
      "Close workspace",
    ])
      expect(sidebar).toContain(action);
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-label="Customer"');
    expect(html).toContain("Alpha · GOLD");
    expect(html).not.toContain("Go to back-end");
  });
  it("does not offer customer edits or revision actions to finance", () => {
    const html = render("FINANCE", "SENT");
    expect(html).not.toContain("Apply customer change");
    expect(html).not.toContain('aria-label="Customer"');
    expect(html).not.toContain("Create revision</button>");
    expect(html).not.toContain("Go to back-end");
  });
  it("shows the admin back-end link but respects owner-only pending withdrawal", () => {
    const html = render("ADMIN", "PENDING_APPROVAL", "admin");
    expect(html).toContain("Go to back-end");
    expect(html).not.toContain("Create revision</button>");
    expect(html).not.toContain("Apply customer change");
  });
});
