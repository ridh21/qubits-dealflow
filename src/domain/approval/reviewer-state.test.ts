import { describe, expect, it } from "vitest";
import { reviewerState, reviewerStateLabel } from "./reviewer-state";

const base = {
  pendingRole: "SALES_MANAGER",
  requestVersion: 6,
  quotationVersion: 6,
};

describe("what a pending review means to the viewer", () => {
  it("flags a step routed to your role as yours to decide", () => {
    const s = reviewerState({
      ...base,
      actor: { id: "someone-else", role: "SALES_MANAGER" },
    });
    expect(s).toEqual({ kind: "NEEDS_YOU", role: "SALES_MANAGER" });
    expect(reviewerStateLabel(s)).toBe("Needs your decision");
  });

  // The intended flow: a manager writes a high-discount quote, the customer
  // pushes for more, and the manager clears the sales-manager phase themselves.
  it("lets the owning manager decide their own sales-manager step", () => {
    const s = reviewerState({
      ...base,
      actor: { id: "owner", role: "SALES_MANAGER" },
    });
    expect(s.kind).toBe("NEEDS_YOU");
  });

  // Phase two is the real gate: the manager does not hold finance.
  it("does not let the owning manager decide the finance step", () => {
    const s = reviewerState({
      ...base,
      pendingRole: "FINANCE",
      actor: { id: "owner", role: "SALES_MANAGER" },
    });
    expect(s.kind).toBe("AWAITING");
    expect(reviewerStateLabel(s)).toBe("Awaiting finance");
  });

  it("lets finance or an admin take the finance step", () => {
    for (const role of ["FINANCE", "ADMIN"])
      expect(
        reviewerState({
          ...base,
          pendingRole: "FINANCE",
          actor: { id: "x", role },
        }).kind,
      ).toBe("NEEDS_YOU");
  });

  it("reports a finished or superseded review as such", () => {
    expect(
      reviewerState({
        ...base,
        pendingRole: null,
        actor: { id: "x", role: "ADMIN" },
      }).kind,
    ).toBe("COMPLETE");
    expect(
      reviewerState({
        ...base,
        quotationVersion: 7,
        actor: { id: "x", role: "ADMIN" },
      }).kind,
    ).toBe("SUPERSEDED");
  });
});
