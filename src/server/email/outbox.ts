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

const MAX_ATTEMPTS = 3;
/** 1 min, then 5, then give up. Keeps a broken address off the hot path. */
const BACKOFF_MS = [60_000, 300_000];

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

type Deliverable = {
  id: string;
  toEmail: string;
  toName: string | null;
  subject: string;
  textBody: string;
  htmlBody: string | null;
  attempts: number;
};

/** One send plus its bookkeeping. Never throws: the row records the outcome. */
async function deliver(m: Deliverable): Promise<boolean> {
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
      data: {
        status: "SENT",
        sentAt: new Date(),
        attempts: { increment: 1 },
        error: null,
        nextAttemptUnix: BigInt(0),
      },
    });
    return true;
  } catch (e) {
    const attempts = m.attempts + 1;
    const backoff = BACKOFF_MS[attempts - 1];
    await prisma.emailMessage.update({
      where: { id: m.id },
      data: {
        status: attempts >= MAX_ATTEMPTS ? "FAILED" : "QUEUED",
        attempts: { increment: 1 },
        error: e instanceof Error ? e.message : String(e),
        nextAttemptUnix:
          backoff === undefined ? BigInt(0) : BigInt(Date.now() + backoff),
      },
    });
    return false;
  }
}

/**
 * Sends one specific queued message.
 *
 * Sign-in and invite flows use this instead of draining the outbox: a stranger's
 * unreachable address must never delay - or consume the retry budget of - the
 * login someone is waiting on right now.
 */
export async function sendQueuedEmail(id: string): Promise<boolean> {
  const m = await prisma.emailMessage.findUnique({
    where: { id },
    select: {
      id: true,
      toEmail: true,
      toName: true,
      subject: true,
      textBody: true,
      htmlBody: true,
      attempts: true,
      status: true,
    },
  });
  if (!m || m.status !== "QUEUED") return false;
  return deliver(m);
}

/** Drains the outbox. Called by /api/jobs/emails and the admin outbox page. */
export async function sendQueuedEmails(limit = 20) {
  const queued = await prisma.emailMessage.findMany({
    // Rows in backoff are skipped rather than retried on every drain.
    where: { status: "QUEUED", nextAttemptUnix: { lte: BigInt(Date.now()) } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      toEmail: true,
      toName: true,
      subject: true,
      textBody: true,
      htmlBody: true,
      attempts: true,
    },
  });

  let sent = 0;
  let failed = 0;
  for (const m of queued) {
    if (await deliver(m)) sent++;
    else failed++;
  }
  return { picked: queued.length, sent, failed };
}
