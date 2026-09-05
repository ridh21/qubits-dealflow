import { z } from "zod";
import { prisma, withTx } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { queueEmail } from "@/server/email/outbox";
import { renderEmail } from "@/server/email/render";
import { emit } from "@/server/events";
import { Conflict, NotFound, ValidationError } from "@/domain/errors";
import { ApproveUserInput, TeamInput } from "@/lib/zod-schemas/admin";
import type { SessionUser } from "@/server/auth/guards";

type ApproveInput = z.infer<typeof ApproveUserInput>;

/** PENDING -> real role. The user can only sign in once this has happened. */
export async function approveUser(actor: SessionUser, input: ApproveInput) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new NotFound("That account no longer exists.");

  const updated = await withTx(async (tx) => {
    const next = await tx.user.update({
      where: { id: user.id },
      data: {
        role: input.role,
        teamId: input.teamId || null,
        isActive: true,
      },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "User",
      entityId: user.id,
      action: "USER.ROLE_ASSIGNED",
      before: { role: user.role, isActive: user.isActive },
      after: { role: next.role, isActive: next.isActive },
    });
    await tx.notification.create({
      data: {
        userId: user.id,
        type: "ACCOUNT_APPROVED",
        title: "Your account is ready",
        body: `You now have ${input.role.replace(/_/g, " ").toLowerCase()} access.`,
        href: "/dashboard",
      },
    });
    const body = renderEmail({
      title: "Your DealFlow360 account is ready",
      intro: `Hi ${user.name}, an admin has approved your account.`,
      bodyLines: [`Role: ${input.role.replace(/_/g, " ").toLowerCase()}`],
      cta: { label: "Sign in", href: `${process.env.AUTH_URL ?? "http://localhost:3000"}/login` },
    });
    await queueEmail(tx, {
      to: user.email,
      toName: user.name,
      subject: "Your DealFlow360 account is ready",
      text: body.text,
      html: body.html,
      relatedType: "User",
      relatedId: user.id,
    });
    return next;
  });

  await emit("user.approved", { userId: updated.id, role: updated.role });
  return updated;
}

export async function updateUserRole(actor: SessionUser, input: ApproveInput) {
  return approveUser(actor, input);
}

/** The workspace must always keep one active admin. */
export async function deactivateUser(actor: SessionUser, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFound("That account no longer exists.");
  if (user.id === actor.id) throw new ValidationError("You cannot deactivate your own account.");

  if (user.role === "ADMIN" && user.isActive) {
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    if (activeAdmins <= 1) throw new Conflict("This is the last active admin.");
  }

  return withTx(async (tx) => {
    const next = await tx.user.update({ where: { id: userId }, data: { isActive: false } });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "User",
      entityId: userId,
      action: "USER.DEACTIVATED",
      before: { isActive: true },
      after: { isActive: false },
    });
    return next;
  });
}

export async function reactivateUser(actor: SessionUser, userId: string) {
  return withTx(async (tx) => {
    const next = await tx.user.update({ where: { id: userId }, data: { isActive: true } });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "User",
      entityId: userId,
      action: "USER.REACTIVATED",
      after: { isActive: true },
    });
    return next;
  });
}

export async function createTeam(actor: SessionUser, input: z.infer<typeof TeamInput>) {
  const existing = await prisma.team.findUnique({ where: { name: input.name } });
  if (existing) throw new ValidationError("A team with that name already exists.");

  return withTx(async (tx) => {
    const team = await tx.team.create({ data: { name: input.name } });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Team",
      entityId: team.id,
      action: "TEAM.CREATED",
      after: { name: team.name },
    });
    return team;
  });
}
