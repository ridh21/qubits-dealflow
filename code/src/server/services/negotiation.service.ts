import { emit } from "@/server/events";
import { z } from "zod";
import { withTx, type Tx } from "@/server/db";
import type { SessionUser } from "@/server/auth/guards";
import { Conflict, NotFound, ValidationError } from "@/domain/errors";
import {
  lockedQuote,
  assertQuoteAccess,
  reviseInTx,
} from "./quotation.service";
import { evaluateAndRoute } from "./approval.service";
import { getActivePolicy } from "./policy.service";
import { createOrderFromQuotation } from "./order.service";
import { notifyUser } from "./notification.service";
import { writeAudit } from "@/server/audit";

export const ProposalInput = z.object({
  lineId: z.string().min(1).optional(),
  body: z.string().trim().min(1).max(2000),
  counterDiscountBp: z.number().int().min(0).max(10000).optional(),
  proposedQty: z.number().int().positive().max(1000000).optional(),
  requestedDeliveryDate: z.coerce.date().optional(),
});
async function customerQuote(
  tx: Tx,
  actor: SessionUser,
  id: string,
  version: number,
) {
  const visible = await tx.quotation.findFirst({
    where: { id, customerId: actor.customerId ?? "", sentAt: { not: null } },
    select: { id: true },
  });
  if (actor.role !== "CUSTOMER" || !actor.customerId || !visible)
    throw new NotFound();
  return lockedQuote(tx, id, version);
}
function requireCurrentOffer(
  quote: { status: string; validUntil: Date | null },
  statuses: string[],
) {
  if (!statuses.includes(quote.status))
    throw new Conflict("This quotation is not available for this action.");
  if (quote.validUntil && quote.validUntil <= new Date())
    throw new ValidationError("This quotation has expired.");
}
async function respondInTx(
  tx: Tx,
  actor: SessionUser,
  messageId: string,
  decision: "APPLY" | "DECLINE",
  reply: string,
) {
  const message = await tx.negotiationMessage.findUniqueOrThrow({
    where: { id: messageId },
  });
  const quote = await lockedQuote(
    tx,
    message.quotationId,
    message.quotationVersion,
  );
  assertQuoteAccess(quote, actor);
  if (message.author !== "CUSTOMER" || message.status !== "OPEN")
    throw new Conflict("This proposal has already been handled.");
  requireCurrentOffer(quote, ["SENT", "UNDER_NEGOTIATION"]);
  let revisionVersion: number | undefined;
  if (decision === "APPLY") {
    await reviseInTx(tx, actor, quote, "Customer proposal applied");
    if (message.lineId) {
      const line = await tx.quotationLine.findFirst({
        where: { id: message.lineId, quotationId: quote.id },
      });
      if (!line)
        throw new ValidationError("The proposed line is no longer available.");
      await tx.quotationLine.update({
        where: { id: line.id },
        data: {
          qty: message.proposedQty ?? line.qty,
          discountBp: message.counterDiscountBp ?? line.discountBp,
        },
      });
    } else if (
      message.counterDiscountBp !== null ||
      message.proposedQty !== null
    )
      throw new ValidationError(
        "Quantity and discount proposals require a line.",
      );
    if (message.requestedDeliveryDate)
      await tx.quotation.update({
        where: { id: quote.id },
        data: { requestedDeliveryDate: message.requestedDeliveryDate },
      });
    const route = await evaluateAndRoute(
      tx,
      actor,
      quote.id,
      "PROPOSAL_APPLIED",
    );
    const current = await tx.quotation.findUniqueOrThrow({
      where: { id: quote.id },
    });
    revisionVersion = current.version;
    if (route.outcome === "AUTO_APPROVED")
      await tx.quotation.update({
        where: { id: quote.id },
        data: { status: "SENT", sentAt: new Date() },
      });
  }
  await tx.negotiationMessage.update({
    where: { id: messageId },
    data: {
      status: decision === "APPLY" ? "APPLIED" : "DECLINED",
      respondedAt: new Date(),
    },
  });
  await tx.negotiationMessage.create({
    data: {
      quotationId: quote.id,
      quotationVersion: revisionVersion ?? quote.version,
      author: "SYSTEM",
      authorUserId: actor.id,
      body:
        reply.trim() ||
        `Proposal ${decision === "APPLY" ? "applied" : "declined"}.`,
      status: decision === "APPLY" ? "APPLIED" : "DECLINED",
    },
  });
  await writeAudit(tx, {
    actorId: actor.id,
    actorType: "USER",
    entityType: "NegotiationMessage",
    entityId: messageId,
    action: `PROPOSAL.${decision}`,
    reason: reply,
    version: revisionVersion ?? quote.version,
  });
  if (message.authorUserId)
    await notifyUser(tx, message.authorUserId, {
      type: "PROPOSAL_RESPONSE",
      title: `${quote.number}: proposal ${decision.toLowerCase()}`,
      body: revisionVersion
        ? `Review version ${revisionVersion} before accepting.`
        : reply,
      href: `/portal/quotations/${quote.id}`,
    });
  return { revisionVersion };
}
export async function respondToProposal(
  actor: SessionUser,
  messageId: string,
  decision: "APPLY" | "DECLINE",
  reply: string,
) {
  if (!reply.trim()) throw new ValidationError("Add a reply for the customer.");
  return withTx((tx) => respondInTx(tx, actor, messageId, decision, reply));
}
export async function submitProposals(
  actor: SessionUser,
  id: string,
  version: number,
  raw: unknown,
) {
  const proposals = z.array(ProposalInput).min(1).max(30).parse(raw);
  return withTx(async (tx) => {
    const quote = await customerQuote(tx, actor, id, version);
    requireCurrentOffer(quote, ["SENT", "UNDER_NEGOTIATION"]);
    const policy = await getActivePolicy(tx, "PORTAL");
    const lines = await tx.quotationLine.findMany({
      where: { quotationId: id },
      select: { id: true },
    });
    for (const proposal of proposals) {
      if (proposal.lineId && !lines.some((l) => l.id === proposal.lineId))
        throw new ValidationError("Choose a line in this quotation.");
      if (
        !proposal.lineId &&
        (proposal.counterDiscountBp !== undefined ||
          proposal.proposedQty !== undefined)
      )
        throw new ValidationError(
          "Quantity and discount proposals require a line.",
        );
    }
    await tx.quotation.update({
      where: { id },
      data: { status: "UNDER_NEGOTIATION", lastActivityAt: new Date() },
    });
    const rows = [];
    for (const proposal of proposals)
      rows.push(
        await tx.negotiationMessage.create({
          data: {
            ...proposal,
            quotationId: id,
            quotationVersion: version,
            author: "CUSTOMER",
            authorUserId: actor.id,
          },
        }),
      );
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "CUSTOMER",
      entityType: "Quotation",
      entityId: id,
      action: "QUOTATION.PROPOSALS_SUBMITTED",
      version,
      after: { messageIds: rows.map((r) => r.id) },
    });
    await notifyUser(tx, quote.ownerId, {
      type: "CUSTOMER_PROPOSAL",
      title: `${quote.number}: customer request`,
      body: `${actor.name} submitted ${rows.length} request(s).`,
      href: `/quotations/${id}`,
    });
    if (policy.payload.autoApplyCustomerProposals) {
      const owner = await tx.user.findUniqueOrThrow({
        where: { id: quote.ownerId },
      });
      const current = await tx.quotation.findUniqueOrThrow({ where: { id } });
      await reviseInTx(
        tx,
        owner,
        current,
        "Customer proposals applied by portal policy",
      );
      for (const row of rows) {
        if (row.lineId)
          await tx.quotationLine.update({
            where: { id: row.lineId },
            data: {
              ...(row.proposedQty !== null ? { qty: row.proposedQty } : {}),
              ...(row.counterDiscountBp !== null
                ? { discountBp: row.counterDiscountBp }
                : {}),
            },
          });
        if (row.requestedDeliveryDate)
          await tx.quotation.update({
            where: { id },
            data: { requestedDeliveryDate: row.requestedDeliveryDate },
          });
        await tx.negotiationMessage.update({
          where: { id: row.id },
          data: { status: "APPLIED", respondedAt: new Date() },
        });
        await writeAudit(tx, {
          actorType: "SYSTEM",
          entityType: "NegotiationMessage",
          entityId: row.id,
          action: "PROPOSAL.APPLY",
          version,
          reason: "Portal auto-apply policy",
        });
      }
      const route = await evaluateAndRoute(
        tx,
        owner,
        id,
        "PROPOSALS_AUTO_APPLIED",
      );
      if (route.outcome === "AUTO_APPROVED")
        await tx.quotation.update({
          where: { id },
          data: { status: "SENT", sentAt: new Date() },
        });
      await notifyUser(tx, actor.id, {
        type: "PROPOSAL_RESPONSE",
        title: `${quote.number}: updated quotation`,
        body: "Your requests were applied. Review the new version before accepting.",
        href: `/portal/quotations/${id}`,
      });
    }
    return {
      status: (
        await tx.quotation.findUniqueOrThrow({
          where: { id },
          select: { status: true },
        })
      ).status,
      appliedAsRevision: policy.payload.autoApplyCustomerProposals,
    };
  }).then(async (result) => {
    await emit("quotation.activity", { quotationId: id });
    return result;
  });
}
export async function acceptQuotation(
  actor: SessionUser,
  id: string,
  version: number,
  ip?: string,
) {
  return withTx(async (tx) => {
    const quote = await customerQuote(tx, actor, id, version);
    const accepted = await tx.quoteAcceptance.findUnique({
      where: { quotationId_version: { quotationId: id, version } },
    });
    if (accepted) {
      const order = await tx.order.findUnique({
        where: { quotationId: id },
        select: { id: true },
      });
      return { outcome: "ALREADY_ACCEPTED" as const, orderId: order?.id };
    }
    requireCurrentOffer(quote, [
      "SENT",
      "UNDER_NEGOTIATION",
      "PENDING_APPROVAL",
    ]);
    if (
      await tx.negotiationMessage.count({
        where: {
          quotationId: id,
          quotationVersion: version,
          author: "CUSTOMER",
          status: "OPEN",
        },
      })
    )
      throw new ValidationError(
        "Wait for a response or withdraw open proposals before accepting.",
      );
    await tx.quoteAcceptance.create({
      data: { quotationId: id, version, customerUserId: actor.id },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "CUSTOMER",
      entityType: "Quotation",
      entityId: id,
      action: "QUOTATION.ACCEPTED_BY_CUSTOMER",
      version,
      after: { ip: ip ?? null },
    });
    if (quote.approvedVersion !== version)
      return { outcome: "PENDING_INTERNAL_APPROVAL" as const };
    const order = await createOrderFromQuotation(tx, id, version, actor);
    return { outcome: "ORDER_CREATED" as const, orderId: order.id };
  });
}
export async function withdrawProposal(actor: SessionUser, messageId: string) {
  return withTx(async (tx) => {
    const message = await tx.negotiationMessage.findUniqueOrThrow({
      where: { id: messageId },
    });
    await customerQuote(
      tx,
      actor,
      message.quotationId,
      message.quotationVersion,
    );
    if (message.authorUserId !== actor.id || message.status !== "OPEN")
      throw new Conflict("This proposal cannot be withdrawn.");
    await tx.negotiationMessage.update({
      where: { id: messageId },
      data: { status: "WITHDRAWN", respondedAt: new Date() },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "CUSTOMER",
      entityType: "NegotiationMessage",
      entityId: messageId,
      action: "PROPOSAL.WITHDRAWN",
    });
  });
}
