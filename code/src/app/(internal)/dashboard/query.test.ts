import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/server/auth/guards";
import type { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  quotes: vi.fn(),
  risk: vi.fn(),
  requests: vi.fn(),
  invoices: vi.fn(),
  revenue: vi.fn(),
  users: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/server/auth/guards", () => ({ requireInternal: mocks.auth }));
vi.mock("@/server/db", () => ({
  prisma: {
    quotation: { groupBy: mocks.quotes, count: mocks.risk },
    approvalRequest: { findMany: mocks.requests },
    invoice: { findMany: mocks.invoices, groupBy: mocks.revenue },
    user: { count: mocks.users },
    $queryRaw: mocks.audit,
  },
}));
// Use the real quotationScope implementation: do not stub authorization.
import { getDashboard } from "@/server/queries/dashboard";

const actor = (
  role: string,
  teamId: string | null = "team-a",
): SessionUser => ({
  id: "viewer",
  name: "Viewer",
  role,
  teamId,
  customerId: null,
});
const request = (role: string, ownerId = "other", overrides = {}) => ({
  quotationVersion: 2,
  currentStepIndex: 1,
  quotation: { ownerId, version: 2 },
  steps: [{ index: 1, role }],
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
  mocks.auth.mockResolvedValue(actor("SALES_REP"));
  mocks.quotes.mockResolvedValue([]);
  mocks.risk.mockResolvedValue(0);
  mocks.requests.mockResolvedValue([]);
  mocks.invoices.mockResolvedValue([]);
  mocks.revenue.mockResolvedValue([]);
  mocks.users.mockResolvedValue(0);
  mocks.audit.mockResolvedValue([]);
});

describe("home dashboard query", () => {
  it.each(["SALES_REP", "SALES_MANAGER", "FINANCE", "ADMIN"])(
    "scopes every business query for %s",
    async (role) => {
      mocks.auth.mockResolvedValue(actor(role));
      await getDashboard();
      const scope =
        role === "SALES_REP"
          ? { ownerId: "viewer" }
          : role === "SALES_MANAGER"
            ? { OR: [{ ownerId: "viewer" }, { owner: { teamId: "team-a" } }] }
            : {};
      expect(mocks.quotes.mock.calls[0][0].where.AND[0]).toEqual(scope);
      expect(mocks.risk.mock.calls[0][0].where.AND[0]).toEqual(scope);
      expect(mocks.requests.mock.calls[0][0].where.quotation.AND[0]).toEqual(
        scope,
      );
      expect(mocks.invoices.mock.calls[0][0].where).toEqual({
        ...(["FINANCE", "ADMIN"].includes(role)
          ? {}
          : { order: { quotation: scope } }),
        status: "ISSUED",
      });
      expect(mocks.users).toHaveBeenCalledTimes(role === "ADMIN" ? 1 : 0);
      expect(mocks.revenue).toHaveBeenCalledTimes(
        ["ADMIN", "FINANCE"].includes(role) ? 1 : 0,
      );
    },
  );

  it("restricts a manager without a team to their own records", async () => {
    mocks.auth.mockResolvedValue(actor("SALES_MANAGER", null));
    await getDashboard();
    expect(mocks.quotes.mock.calls[0][0].where.AND[0]).toEqual({
      OR: [{ ownerId: "viewer" }],
    });
    const sql = mocks.audit.mock.calls[0][0] as Prisma.Sql;
    expect(sql.text).toContain('WHERE q."ownerId" =');
    expect(sql.values).not.toContain(null);
    expect(sql.values).not.toContain("team-a");
  });

  it.each([
    ["SALES_MANAGER", 1],
    ["FINANCE", 1],
    ["ADMIN", 2],
    ["SALES_REP", 3],
  ])(
    "counts only current eligible approvals for %s",
    async (role, expected) => {
      mocks.auth.mockResolvedValue(actor(role));
      mocks.requests.mockResolvedValue([
        request("SALES_MANAGER"),
        request("FINANCE"),
        request("SALES_MANAGER", "viewer"),
        request("SALES_MANAGER", "other", { quotationVersion: 1 }),
        request("SALES_MANAGER", "other", { currentStepIndex: 0 }),
        request("FINANCE", "other", { steps: [] }),
      ]);
      expect((await getDashboard()).pendingApprovals).toBe(expected);
      expect(mocks.requests.mock.calls[0][0].where.status).toBe("PENDING");
      expect(mocks.requests.mock.calls[0][0].select.steps.where).toEqual({
        status: "PENDING",
      });
    },
  );

  it("keeps unpaid and overdue balances per currency, after payments and credits", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T12:00:00Z"));
    const invoice = {
      currency: "USD",
      totalMinor: 10000,
      paidMinor: 2000,
      creditAppliedMinor: 1000,
      dueAt: new Date("2026-09-01Z"),
    };
    mocks.invoices.mockResolvedValue([
      invoice,
      { ...invoice, currency: "EUR", totalMinor: 8000 },
      {
        ...invoice,
        totalMinor: 5000,
        paidMinor: 0,
        creditAppliedMinor: 0,
        dueAt: new Date("2026-09-05T12:00:00Z"),
      },
      { ...invoice, paidMinor: 9000 },
    ]);
    const data = await getDashboard();
    expect(data.invoiceBalances).toEqual([
      {
        currency: "EUR",
        unpaidMinor: 5000,
        overdueMinor: 5000,
        unpaidCount: 1,
        overdueCount: 1,
      },
      {
        currency: "USD",
        unpaidMinor: 12000,
        overdueMinor: 7000,
        unpaidCount: 2,
        overdueCount: 1,
      },
    ]);
    expect(data.unpaidCount).toBe(3);
    expect(data.overdueCount).toBe(2);
  });

  it("uses UTC month-to-date issued revenue, separated by currency, for finance", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:30:00Z"));
    mocks.auth.mockResolvedValue(actor("FINANCE"));
    mocks.revenue.mockResolvedValue([
      { currency: "EUR", _sum: { totalMinor: 100 } },
      { currency: "USD", _sum: { totalMinor: 200 } },
    ]);
    const data = await getDashboard();
    expect(data.revenue).toEqual([
      { currency: "EUR", totalMinor: 100 },
      { currency: "USD", totalMinor: 200 },
    ]);
    expect(mocks.revenue.mock.calls[0][0]).toMatchObject({
      by: ["currency"],
      where: {
        status: "ISSUED",
        issuedAt: {
          gte: new Date("2026-01-01Z"),
          lte: new Date("2026-01-01T00:30:00Z"),
        },
      },
    });
    expect(data.pipeline).toBeNull();
  });

  it("counts open quotes without mixing pipeline currencies or including terminal states", async () => {
    mocks.quotes.mockResolvedValue([
      {
        status: "DRAFT",
        currency: "USD",
        _count: { _all: 2 },
        _sum: { totalMinor: 100 },
      },
      {
        status: "DRAFT",
        currency: "EUR",
        _count: { _all: 1 },
        _sum: { totalMinor: 700 },
      },
    ]);
    const data = await getDashboard();
    expect(data.openQuotations).toBe(3);
    expect(data.pipeline).toEqual([
      { status: "DRAFT", currency: "USD", count: 2, totalMinor: 100 },
      { status: "DRAFT", currency: "EUR", count: 1, totalMinor: 700 },
    ]);
    expect(mocks.quotes.mock.calls[0][0].where.AND[1].status.in).toEqual([
      "DRAFT",
      "PENDING_APPROVAL",
      "REVISION_REQUESTED",
      "APPROVED",
      "SENT",
      "UNDER_NEGOTIATION",
    ]);
    expect(data.revenue).toBeNull();
    expect(data.pendingUsers).toBeNull();
    // Count quotations, not alerts, so multiple unresolved alerts cannot inflate deals.
    expect(mocks.risk.mock.calls[0][0].where.AND[1].OR).toEqual([
      { alerts: { some: { status: { not: "RESOLVED" } } } },
      { order: { alerts: { some: { status: { not: "RESOLVED" } } } } },
    ]);
  });

  it("authorizes audit entity type AND id before limiting, and exposes only sentences", async () => {
    mocks.audit.mockResolvedValue([
      {
        id: "event",
        actorType: "CUSTOMER",
        isCurrentActor: false,
        entityType: "Quotation",
        action: "QUOTATION.ACCEPTED_BY_CUSTOMER",
        version: 2,
        createdAt: new Date("2026-09-05Z"),
      },
    ]);
    const data = await getDashboard();
    const sql = mocks.audit.mock.calls[0][0] as Prisma.Sql;
    expect(sql.text).toContain(
      'e.type = a."entityType" AND e.id = a."entityId"',
    );
    expect(sql.text.indexOf("WHERE")).toBeLessThan(
      sql.text.indexOf("LIMIT 12"),
    );
    expect(sql.text).not.toContain('a."before"');
    expect(sql.text).not.toContain('a."after"');
    expect(sql.text).not.toContain('a."reason"');
    expect(data.activity).toEqual([
      {
        id: "event",
        createdAt: new Date("2026-09-05Z"),
        sentence: "A customer accepted a quotation (v2).",
      },
    ]);
  });

  it("parameterizes malicious-looking owner/team ids in activity scope", async () => {
    const id = "x' OR TRUE --";
    mocks.auth.mockResolvedValue({ ...actor("SALES_MANAGER", id), id });
    await getDashboard();
    const sql = mocks.audit.mock.calls[0][0] as Prisma.Sql;
    expect(sql.text).not.toContain(id);
    expect(sql.values).toContain(id);
  });

  it("returns empty states without inventing a currency", async () => {
    const data = await getDashboard();
    expect(data.openQuotations).toBe(0);
    expect(data.pendingApprovals).toBe(0);
    expect(data.invoiceBalances).toEqual([]);
    expect(data.pipeline).toEqual([]);
    expect(data.activity).toEqual([]);
  });

  it("does not query data when authentication fails", async () => {
    mocks.auth.mockRejectedValue(new Error("Forbidden"));
    await expect(getDashboard()).rejects.toThrow("Forbidden");
    for (const mock of [
      mocks.quotes,
      mocks.requests,
      mocks.risk,
      mocks.invoices,
      mocks.revenue,
      mocks.users,
      mocks.audit,
    ])
      expect(mock).not.toHaveBeenCalled();
  });
});
