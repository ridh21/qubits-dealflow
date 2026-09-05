import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  policy: vi.fn(),
  queue: vi.fn(),
  tx: { verificationToken: { deleteMany: vi.fn(), create: vi.fn() } },
}));
vi.mock("@/server/db", () => ({
  prisma: {
    user: { findFirst: mocks.user },
    $transaction: async (fn: (tx: typeof mocks.tx) => Promise<unknown>) =>
      fn(mocks.tx),
  },
}));
vi.mock("@/server/services/policy.service", () => ({
  getActivePolicy: mocks.policy,
}));
vi.mock("@/server/email/outbox", () => ({ queueEmail: mocks.queue }));
import { issuePortalLink } from "./portal-links";
describe("published portal credential lifetime", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T12:00:00Z"));
    mocks.user.mockResolvedValue({
      id: "customer-user",
      role: "CUSTOMER",
      name: "Customer",
      isActive: true,
    });
  });
  afterEach(() => vi.useRealTimers());
  it.each([1, 30])(
    "uses the same %i-minute policy for stored expiry and email",
    async (minutes) => {
      mocks.policy.mockResolvedValue({
        payload: { magicLinkMinutes: minutes },
      });
      await issuePortalLink(`ttl-${minutes}@example.test`);
      expect(mocks.policy).toHaveBeenCalledWith(mocks.tx, "PORTAL");
      expect(
        mocks.tx.verificationToken.create.mock.calls[0][0].data.expires,
      ).toEqual(new Date(Date.now() + minutes * 60000));
      expect(mocks.queue.mock.calls[0][1].text).toContain(
        `expires in ${minutes} minutes`,
      );
    },
  );
  it("does not silently issue a longer-lived token when configuration is missing", async () => {
    mocks.policy.mockRejectedValue(new Error("Publish a PORTAL policy"));
    await expect(
      issuePortalLink("missing-policy@example.test"),
    ).rejects.toThrow("Publish a PORTAL policy");
    expect(mocks.tx.verificationToken.create).not.toHaveBeenCalled();
    expect(mocks.queue).not.toHaveBeenCalled();
  });
  it("does not issue credentials for an inactive or unknown customer account", async () => {
    mocks.user.mockResolvedValue(null);
    expect(await issuePortalLink("unknown@example.test")).toEqual({
      issued: false,
      devLink: null,
    });
    expect(mocks.policy).not.toHaveBeenCalled();
    expect(mocks.user.mock.calls[0][0].where).toMatchObject({
      isActive: true,
      customer: { isActive: true },
    });
  });
});
