import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/server/auth/guards";
import { parseQuotationListParams as parse } from "@/domain/quotation/list-params";
import { quotationListOrder, quotationListWhere } from "./quotation-list";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  count: vi.fn(),
  rows: vi.fn(),
  owners: vi.fn(),
  teams: vi.fn(),
  customers: vi.fn(),
}));
vi.mock("@/server/auth/guards", () => ({ requireInternal: mocks.auth }));
vi.mock("@/server/db", () => ({
  prisma: {
    quotation: { count: mocks.count, findMany: mocks.rows },
    user: { findMany: mocks.owners },
    team: { findMany: mocks.teams },
    customer: { findMany: mocks.customers },
  },
}));
import { listQuotations, quotationScope } from "./quotations";
const actor = (
  role: string,
  teamId: string | null = "team-a",
): SessionUser => ({ id: "self", role, teamId, customerId: null });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(actor("SALES_REP"));
  mocks.count.mockResolvedValue(31);
  for (const mock of [mocks.rows, mocks.owners, mocks.teams, mocks.customers])
    mock.mockResolvedValue([]);
});
describe("quotation list query and authorization", () => {
  it.each(["SALES_REP", "SALES_MANAGER", "ADMIN", "FINANCE"])(
    "keeps %s scope in count, rows and filter options",
    async (role) => {
      const user = actor(role);
      mocks.auth.mockResolvedValue(user);
      const result = await listQuotations({
        ownerId: "outsider",
        teamId: "team-b",
        q: "match",
        page: "99",
        pageSize: "10",
      });
      const scope = quotationScope(user);
      const where = mocks.count.mock.calls[0][0].where;
      expect(where.AND[0]).toEqual(scope);
      expect(where.AND[1]).toMatchObject({
        ownerId: "outsider",
        owner: { teamId: "team-b" },
        OR: expect.any(Array),
      });
      expect(mocks.rows).toHaveBeenCalledWith(
        expect.objectContaining({
          where,
          skip: 30,
          take: 10,
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        }),
      );
      expect(result).toMatchObject({ page: 4, pageCount: 4, total: 31 });
      expect(mocks.owners.mock.calls[0][0].where).toEqual({
        ownedQuotations: { some: scope },
      });
      expect(mocks.teams.mock.calls[0][0].where).toEqual({
        users: { some: { ownedQuotations: { some: scope } } },
      });
      expect(mocks.customers.mock.calls[0][0].where).toEqual({
        quotations: { some: scope },
      });
    },
  );
  it("restricts reps to self and managers to self/team, including no-team managers", () => {
    expect(quotationScope(actor("SALES_REP"))).toEqual({ ownerId: "self" });
    expect(quotationScope(actor("SALES_MANAGER"))).toEqual({
      OR: [{ ownerId: "self" }, { owner: { teamId: "team-a" } }],
    });
    expect(quotationScope(actor("SALES_MANAGER", null))).toEqual({
      OR: [{ ownerId: "self" }],
    });
  });
  it("does not read data before authentication succeeds", async () => {
    mocks.auth.mockRejectedValue(new Error("Forbidden"));
    await expect(listQuotations({})).rejects.toThrow("Forbidden");
    for (const mock of [
      mocks.count,
      mocks.rows,
      mocks.owners,
      mocks.teams,
      mocks.customers,
    ])
      expect(mock).not.toHaveBeenCalled();
  });
  it("maps all narrowing filters and includes the complete final UTC day", () => {
    const where = quotationListWhere(
      { ownerId: "self" },
      parse({
        status: ["SENT", "CONFIRMED"],
        customerId: "c",
        riskBand: "HIGH",
        minAmount: "0",
        maxAmount: "100.15",
        createdFrom: "2026-09-01",
        createdTo: "2026-09-05",
        hasOpenProposals: "true",
      }),
    );
    expect(where).toEqual({
      AND: [
        { ownerId: "self" },
        {
          status: { in: ["SENT", "CONFIRMED"] },
          customerId: "c",
          riskBand: "HIGH",
          totalMinor: { gte: 0, lte: 10015 },
          createdAt: {
            gte: new Date("2026-09-01T00:00:00Z"),
            lt: new Date("2026-09-06T00:00:00Z"),
          },
          messages: { some: { author: "CUSTOMER", status: "OPEN" } },
        },
      ],
    });
  });
  it("distinguishes no open proposals from no messages", () => {
    expect(
      quotationListWhere({}, parse({ hasOpenProposals: "false" })),
    ).toEqual({
      AND: [{}, { messages: { none: { author: "CUSTOMER", status: "OPEN" } } }],
    });
  });
  it("fails closed on malformed narrowing filters", () => {
    expect(
      quotationListWhere({ ownerId: "self" }, parse({ minAmount: "oops" })),
    ).toEqual({ AND: [{ ownerId: "self" }, { id: { in: [] } }] });
  });
  it("supports relation ordering and a unique tie-breaker", () => {
    expect(quotationListOrder(parse({ sort: "customer", dir: "asc" }))).toEqual(
      [{ customer: { name: "asc" } }, { id: "asc" }],
    );
    expect(quotationListOrder(parse({ sort: "totalMinor" }))).toEqual([
      { totalMinor: "desc" },
      { id: "asc" },
    ]);
  });
});
