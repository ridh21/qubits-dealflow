import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { testDatabase } from "./helpers/database";
import { consumePortalToken } from "@/server/auth/consume-portal-token";
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "portal token consumption",
  () => {
    it("allows one concurrent redemption and rejects expired and wrong-purpose tokens", async () => {
      const db = testDatabase();
      const token = randomBytes(32).toString("hex"),
        expired = randomBytes(32).toString("hex"),
        wrong = randomBytes(32).toString("hex");
      const now = new Date();
      try {
        await db.verificationToken.createMany({
          data: [
            {
              identifier: "token-test@example.test",
              token,
              purpose: "PORTAL_LOGIN",
              expires: new Date(now.getTime() + 60000),
            },
            {
              identifier: "token-test@example.test",
              token: expired,
              purpose: "PORTAL_LOGIN",
              expires: now,
            },
            {
              identifier: "token-test@example.test",
              token: wrong,
              purpose: "OTHER",
              expires: new Date(now.getTime() + 60000),
            },
          ],
        });
        const results = await Promise.all([
          consumePortalToken(token, db, now),
          consumePortalToken(token, db, now),
        ]);
        expect(results.filter(Boolean)).toEqual(["token-test@example.test"]);
        expect(await consumePortalToken(token, db, now)).toBeNull();
        expect(await consumePortalToken(expired, db, now)).toBeNull();
        expect(await consumePortalToken(wrong, db, now)).toBeNull();
      } finally {
        await db.verificationToken.deleteMany({
          where: { token: { in: [token, expired, wrong] } },
        });
        await db.$disconnect();
      }
    }, 60000);
  },
);
