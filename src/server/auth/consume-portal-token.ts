import { prisma, type Tx } from "@/server/db";

export const PORTAL_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

/** Why a magic link cannot be used, for accurate sign-in messaging. */
export type PortalTokenState = "VALID" | "MALFORMED" | "UNKNOWN" | "EXPIRED";

/**
 * Expiry is compared on `expiresAtUnix` (epoch milliseconds) rather than the
 * DateTime column: an integer comparison has no timezone or precision to get
 * wrong, in the database or in JS.
 */
function isExpired(expiresAtUnix: bigint, now: Date) {
  return expiresAtUnix <= BigInt(now.getTime());
}

/**
 * Classifies a token *without* consuming it, so the verify endpoint can tell
 * "expired" apart from "already used" instead of reporting everything as
 * expiry. The winner is still elected by `consumePortalToken`.
 */
export async function peekPortalToken(
  token: string,
  db: Tx = prisma,
  now = new Date(),
): Promise<PortalTokenState> {
  if (!PORTAL_TOKEN_PATTERN.test(token)) return "MALFORMED";
  const record = await db.verificationToken.findUnique({
    where: { token },
    select: { purpose: true, expiresAtUnix: true },
  });
  if (!record || record.purpose !== "PORTAL_LOGIN") return "UNKNOWN";
  return isExpired(record.expiresAtUnix, now) ? "EXPIRED" : "VALID";
}

/** Delete count elects exactly one winner even when two requests read the same token. */
export async function consumePortalToken(
  token: string,
  db: Tx = prisma,
  now = new Date(),
) {
  if (!PORTAL_TOKEN_PATTERN.test(token)) return null;
  const record = await db.verificationToken.findUnique({
    where: { token },
    select: { identifier: true, purpose: true, expiresAtUnix: true },
  });
  if (!record || record.purpose !== "PORTAL_LOGIN") return null;
  if (isExpired(record.expiresAtUnix, now)) return null;
  const consumed = await db.verificationToken.deleteMany({
    where: {
      token,
      purpose: "PORTAL_LOGIN",
      expiresAtUnix: { gt: BigInt(now.getTime()) },
    },
  });
  return consumed.count === 1 ? record.identifier : null;
}
