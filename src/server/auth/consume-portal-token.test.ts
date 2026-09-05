import { describe, expect, it } from "vitest";
import { consumePortalToken, peekPortalToken } from "./consume-portal-token";

const TOKEN = "a".repeat(64);
const NOW = new Date("2026-09-05T12:00:00Z");
const futureUnix = BigInt(NOW.getTime() + 15 * 60 * 1000);
const pastUnix = BigInt(NOW.getTime() - 60 * 1000);

function db(record: unknown) {
  return {
    verificationToken: {
      findUnique: async () => record,
      deleteMany: async () => ({ count: record ? 1 : 0 }),
    },
  } as never;
}

const valid = {
  identifier: "customer@example.test",
  purpose: "PORTAL_LOGIN",
  expiresAtUnix: futureUnix,
};

describe("portal magic-link classification", () => {
  it("reports a live link as valid without consuming it", async () => {
    expect(await peekPortalToken(TOKEN, db(valid), NOW)).toBe("VALID");
  });

  it("distinguishes an expired link from one that was already used", async () => {
    expect(await peekPortalToken(TOKEN, db({ ...valid, expiresAtUnix: pastUnix }), NOW)).toBe("EXPIRED");
    expect(await peekPortalToken(TOKEN, db(null), NOW)).toBe("UNKNOWN");
  });

  it("rejects a malformed token before touching the database", async () => {
    expect(await peekPortalToken("not-a-token", db(valid), NOW)).toBe("MALFORMED");
  });

  // Regression: a link whose expiry is still in the future must sign in, not
  // report expiry. The verify step previously ran during a Server Component
  // render, where the session cookie write throws after the token is consumed.
  it("consumes a link that has not yet expired", async () => {
    expect(await consumePortalToken(TOKEN, db(valid), NOW)).toBe(valid.identifier);
  });

  it("does not consume an expired link", async () => {
    expect(await consumePortalToken(TOKEN, db({ ...valid, expiresAtUnix: pastUnix }), NOW)).toBeNull();
  });
});
