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
    select: { id: true },
  });
  for (const user of users) await notifyUser(tx, user.id, n);
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
