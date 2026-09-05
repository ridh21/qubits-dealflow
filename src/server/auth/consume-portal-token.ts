import { prisma, type Tx } from "@/server/db";
/** Delete count elects exactly one winner even when two requests read the same token. */
export async function consumePortalToken(
  token: string,
  db: Tx = prisma,
  now = new Date(),
) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const record = await db.verificationToken.findUnique({ where: { token } });
  if (!record || record.purpose !== "PORTAL_LOGIN" || record.expires <= now)
    return null;
  const consumed = await db.verificationToken.deleteMany({
    where: { token, purpose: "PORTAL_LOGIN", expires: { gt: now } },
  });
  return consumed.count === 1 ? record.identifier : null;
}
