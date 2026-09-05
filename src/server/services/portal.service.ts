import { randomBytes } from "node:crypto";
import { withTx } from "@/server/db";
import type { SessionUser } from "@/server/auth/guards";
import { Conflict, ValidationError } from "@/domain/errors";
import { lockedQuote, assertQuoteAccess } from "./quotation.service";
import { getActivePolicy } from "./policy.service";
import { queueEmail } from "@/server/email/outbox";
import { writeAudit } from "@/server/audit";

export async function sendToCustomer(
  actor: SessionUser,
  id: string,
  expectedVersion: number,
) {
  return withTx(async (tx) => {
    const quote = await lockedQuote(tx, id, expectedVersion);
    assertQuoteAccess(quote, actor);
    if (quote.status === "SENT" && quote.approvedVersion === quote.version)
      return { id, version: quote.version };
    if (quote.status !== "APPROVED" || quote.approvedVersion !== quote.version)
      throw new Conflict("Only the approved current version can be sent.");
    const recipients = await tx.user.findMany({
      where: { customerId: quote.customerId, role: "CUSTOMER", isActive: true },
      select: { email: true, name: true },
    });
    if (!recipients.length)
      throw new ValidationError(
        "Add an active portal contact to this customer before sending.",
      );
    const policy = await getActivePolicy(tx, "PORTAL");
    const now = new Date();
    if (quote.validUntil && quote.validUntil <= now)
      throw new ValidationError("Revise the expired quotation before sending.");
    const token = quote.portalToken ?? randomBytes(32).toString("hex");
    await tx.quotation.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: now,
        lastActivityAt: now,
        portalToken: token,
        validUntil:
          quote.validUntil ??
          new Date(now.getTime() + policy.payload.quoteValidityDays * 86400000),
      },
    });
    const href = new URL(
      `/portal/q/${token}`,
      process.env.AUTH_URL ?? "http://localhost:3000",
    ).toString();
    for (const contact of recipients)
      await queueEmail(tx, {
        to: contact.email,
        toName: contact.name,
        subject: `Review quotation ${quote.number}`,
        text: `Your quotation ${quote.number}, version ${quote.version}, is ready to review. Open your secure customer portal: ${href}`,
        relatedType: "Quotation",
        relatedId: id,
      });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Quotation",
      entityId: id,
      action: "QUOTATION.SENT",
      version: quote.version,
    });
    return { id, version: quote.version };
  });
}
