import { prisma, type Tx } from "@/server/db";
import { sendEmail } from "./adapter";

export interface QueueEmailInput {
  to: string;
  toName?: string | null;
  subject: string;
  text: string;
  html?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
}

/** Queued inside the caller's transaction so mail never escapes a rollback. */
export async function queueEmail(tx: Tx, input: QueueEmailInput) {
  return tx.emailMessage.create({
    data: {
      toEmail: input.to,
      toName: input.toName ?? null,
      subject: input.subject,
      textBody: input.text,
      htmlBody: input.html ?? null,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
    },
  });
}

/** Drains the outbox. Called by /api/jobs/emails and the admin outbox page. */
export async function sendQueuedEmails(limit = 20) {
  const queued = await prisma.emailMessage.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  for (const m of queued) {
    try {
      await sendEmail({
        to: m.toEmail,
        toName: m.toName,
        subject: m.subject,
        text: m.textBody,
        html: m.htmlBody,
      });
      await prisma.emailMessage.update({
        where: { id: m.id },
        data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 }, error: null },
      });
      sent++;
    } catch (e) {
      failed++;
      await prisma.emailMessage.update({
        where: { id: m.id },
        data: {
          status: m.attempts + 1 >= 3 ? "FAILED" : "QUEUED",
          attempts: { increment: 1 },
          error: e instanceof Error ? e.message : String(e),
        },
      });
    }
  }
  return { picked: queued.length, sent, failed };
}
