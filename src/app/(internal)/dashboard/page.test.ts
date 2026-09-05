import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const query = vi.hoisted(() => vi.fn());
vi.mock("@/server/queries/dashboard", () => ({
  getDashboard: query,
  OPEN_QUOTATION_STATUSES: [
    "DRAFT",
    "PENDING_APPROVAL",
    "REVISION_REQUESTED",
    "APPROVED",
    "SENT",
    "UNDER_NEGOTIATION",
  ],
}));
vi.mock("@/components/layout/workspace-actions", () => ({
  WorkspaceActions: ({ children }: { children: ReactNode }) =>
    createElement("aside", { "data-testid": "workspace-actions" }, children),
}));
import DashboardPage from "./page";

const empty = (role: string) => ({
  actor: { id: "viewer", role, name: "<script>unsafe</script>" },
  now: new Date("2026-09-05Z"),
  monthStart: new Date("2026-09-01Z"),
  openQuotations: 0,
  pendingApprovals: 0,
  pendingUsers: role === "ADMIN" ? 0 : null,
  atRisk: 0,
  unpaidCount: 0,
  overdueCount: 0,
  invoiceBalances: [],
  activity: [],
  pipeline: role === "SALES_REP" ? [] : null,
  revenue: ["ADMIN", "FINANCE"].includes(role) ? [] : null,
});
beforeEach(() => {
  query.mockReset();
});

describe("dashboard server rendering", () => {
  it.each(["SALES_REP", "SALES_MANAGER", "FINANCE", "ADMIN"])(
    "renders role sections and sidebar actions for %s",
    async (role) => {
      query.mockResolvedValue(empty(role));
      const html = renderToStaticMarkup(await DashboardPage());
      expect(html.includes("My pipeline")).toBe(role === "SALES_REP");
      expect(html.includes("Revenue this month")).toBe(
        ["ADMIN", "FINANCE"].includes(role),
      );
      expect(html.includes("New quotation</a>")).toBe(role !== "FINANCE");
      expect(html.includes("Review approvals")).toBe(role !== "SALES_REP");
      expect(html.includes("Review accounts")).toBe(role === "ADMIN");
      expect(html).toContain('data-testid="workspace-actions"');
      expect(html).toContain("No outstanding issued invoices in your scope.");
      expect(html).toContain("No activity in your scope yet.");
      expect(html).not.toContain("<script>unsafe</script>");
    },
  );
  it("renders each currency explicitly and escapes activity text", async () => {
    query.mockResolvedValue({
      ...empty("FINANCE"),
      invoiceBalances: [
        {
          currency: "USD",
          unpaidMinor: 12345,
          overdueMinor: 10000,
          unpaidCount: 2,
          overdueCount: 1,
        },
        {
          currency: "EUR",
          unpaidMinor: 6789,
          overdueMinor: 0,
          unpaidCount: 1,
          overdueCount: 0,
        },
      ],
      revenue: [
        { currency: "USD", totalMinor: 9999 },
        { currency: "EUR", totalMinor: 2222 },
      ],
      activity: [
        {
          id: "audit",
          sentence: "<script>unsafe</script>",
          createdAt: new Date("2026-09-05Z"),
        },
      ],
    });
    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).toContain("USD invoiced");
    expect(html).toContain("EUR invoiced");
    expect(html).toContain("$123.45");
    expect(html).toContain("€67.89");
    expect(html).not.toContain("<script>unsafe</script>");
    expect(html).toContain("&lt;script&gt;unsafe&lt;/script&gt;");
    expect(html).toContain('dateTime="2026-09-05T00:00:00.000Z"');
  });
});
