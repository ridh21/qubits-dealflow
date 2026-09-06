import { describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/server/auth/guards";

// approvals.ts reaches auth and the database at module scope; the scope rule
// itself is pure, so both are stubbed out to keep this a unit test.
vi.mock("@/server/auth/guards", () => ({ requireInternal: vi.fn() }));
vi.mock("@/server/db", () => ({
  prisma: {
    approvalRequest: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    policyVersion: { findUniqueOrThrow: vi.fn() },
    auditLog: { findMany: vi.fn() },
    quoteAcceptance: { findUnique: vi.fn() },
    user: { count: vi.fn() },
  },
}));

import { approvalScope } from "./approvals";

const user = (role: string, over: Partial<SessionUser> = {}): SessionUser => ({
  id: "u1",
  role,
  teamId: "team-direct",
  customerId: null,
  ...over,
});

/**
 * Regression: the queue used to be scoped by who *owns* the quotation. A
 * manager on another team was then never shown a request routed to their own
 * role, so the quotation sat PENDING with nobody able to act and no signal
 * that anything was wrong.
 */
describe("who can see an approval request", () => {
  it("lets a manager see anything routed to their role, whatever team owns it", () => {
    const scope = approvalScope(user("SALES_MANAGER"));
    expect(scope.OR).toContainEqual({
      steps: { some: { role: "SALES_MANAGER" } },
    });
  });

  it("still lets a manager see their own team's requests", () => {
    const scope = approvalScope(user("SALES_MANAGER"));
    expect(scope.OR?.[0]).toHaveProperty("quotation");
  });

  it("does not widen the scope for a manager with no team", () => {
    const scope = approvalScope(user("SALES_MANAGER", { teamId: null }));
    // Still routed-to-me, plus own quotations — but no team clause to leak through.
    expect(JSON.stringify(scope)).not.toContain("teamId");
  });

  it("gives admin and finance the whole queue", () => {
    expect(approvalScope(user("ADMIN"))).toEqual({});
    expect(approvalScope(user("FINANCE"))).toEqual({});
  });

  it("keeps a sales rep to quotations they own", () => {
    const scope = approvalScope(user("SALES_REP"));
    expect(scope).toEqual({ quotation: { ownerId: "u1" } });
    // A rep is never a reviewer, so no step clause may appear.
    expect(JSON.stringify(scope)).not.toContain("steps");
  });
});
