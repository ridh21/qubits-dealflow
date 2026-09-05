import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  internal: vi.fn(),
  portal: vi.fn(),
  find: vi.fn(),
}));
vi.mock("./index", () => ({
  internalAuth: mocks.internal,
  portalAuth: mocks.portal,
}));
vi.mock("@/server/db", () => ({ prisma: { user: { findFirst: mocks.find } } }));
import { getUser, requireAdmin, requirePortalCustomer } from "./guards";
describe("current session authorization", () => {
  beforeEach(() => vi.resetAllMocks());
  it("uses current role and team rather than stale JWT grants", async () => {
    mocks.internal.mockResolvedValue({
      user: { id: "user", role: "ADMIN", teamId: "old" },
    });
    mocks.find.mockResolvedValue({
      id: "user",
      role: "SALES_REP",
      teamId: "new",
      customerId: null,
    });
    expect(await getUser()).toMatchObject({ role: "SALES_REP", teamId: "new" });
    await expect(requireAdmin()).rejects.toThrow();
    expect(mocks.find.mock.calls[0][0].where).toMatchObject({
      id: "user",
      isActive: true,
    });
  });
  it("rejects disabled or deleted identities even with a valid cookie", async () => {
    mocks.internal.mockResolvedValue({
      user: { id: "removed", role: "ADMIN" },
    });
    mocks.find.mockResolvedValue(null);
    expect(await getUser()).toBeNull();
  });
  it("requires an active customer account for portal mutations", async () => {
    mocks.portal.mockResolvedValue({
      user: { id: "portal", role: "CUSTOMER", customerId: "old" },
    });
    mocks.find.mockResolvedValue(null);
    await expect(requirePortalCustomer()).rejects.toThrow();
    expect(mocks.find.mock.calls[0][0].where).toEqual({
      id: "portal",
      role: "CUSTOMER",
      isActive: true,
      customer: { isActive: true },
    });
  });
  it("does not query users without an authenticated identity", async () => {
    mocks.internal.mockResolvedValue(null);
    expect(await getUser()).toBeNull();
    expect(mocks.find).not.toHaveBeenCalled();
  });
});
