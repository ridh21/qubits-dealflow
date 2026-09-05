import type { Role } from "@prisma/client";
import { withTx, type Tx } from "@/server/db";
import { writeAudit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/guards";
import { NotFound } from "@/domain/errors";
export interface Notice {
  type: string;
  title: string;
  body: string;
  href?: string;
}
export async function notifyUser(tx: Tx, userId: string, n: Notice) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { email: true, isActive: true },
  });
  if (!user?.isActive) return;
  const row = await tx.notification.create({ data: { userId, ...n } });
  await tx.emailMessage.create({
    data: {
      toEmail: user.email,
      subject: n.title,
      textBody: n.body,
      relatedType: "Notification",
      relatedId: row.id,
    },
  });
  return row;
}
/**
 * Fan-out in three queries rather than three per recipient.
 *
 * The previous loop called notifyUser per user, which re-read each user that
 * this very query had already filtered on `isActive`, then issued a notification
 * insert and an email insert one row at a time.
 */
export async function notifyRole(
  tx: Tx,
  role: Role,
  n: Notice,
  excludeId?: string,
) {
  const users = await tx.user.findMany({
    where: {
      role,
      isActive: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, email: true },
  });
  if (!users.length) return;

  // createManyAndReturn gives back the ids the email rows need to reference.
  const rows = await tx.notification.createManyAndReturn({
    data: users.map((user) => ({ userId: user.id, ...n })),
    select: { id: true, userId: true },
  });
  const emailFor = new Map(users.map((u) => [u.id, u.email]));
  await tx.emailMessage.createMany({
    data: rows.map((row) => ({
      toEmail: emailFor.get(row.userId)!,
      subject: n.title,
      textBody: n.body,
      relatedType: "Notification",
      relatedId: row.id,
    })),
  });
}
export async function markRead(actor: SessionUser, id: string) {
  return withTx(async (tx) => {
    const n = await tx.notification.findFirst({
      where: { id, userId: actor.id },
    });
    if (!n) throw new NotFound();
    if (n.readAt) return;
    await tx.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Notification",
      entityId: id,
      action: "NOTIFICATION.READ",
    });
  });
}
