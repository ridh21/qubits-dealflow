import { prisma } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { hashPassword } from "@/server/auth/password";
import { ValidationError } from "@/domain/errors";
import type { SignupInput } from "@/lib/zod-schemas/auth";

/**
 * Internal signup creates a PENDING, inactive account (PRD S3): an admin has to
 * assign the real role. The very first account, or the configured bootstrap
 * address, becomes an active ADMIN so the app is never left without one.
 */
export async function signupInternalUser(input: SignupInput) {
  const email = input.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ValidationError("An account with this email already exists.");

  const userCount = await prisma.user.count();
  const bootstrap =
    userCount === 0 ||
    email === (process.env.ADMIN_BOOTSTRAP_EMAIL ?? "").toLowerCase().trim();

  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: input.name.trim(),
        passwordHash,
        role: bootstrap ? "ADMIN" : "PENDING",
        isActive: bootstrap,
      },
    });
    await writeAudit(tx, {
      actorId: user.id,
      actorType: "USER",
      entityType: "User",
      entityId: user.id,
      action: "USER.SIGNUP",
      after: { email: user.email, role: user.role },
      reason: bootstrap ? "Bootstrap admin" : "Awaiting admin approval",
    });
    return { id: user.id, role: user.role, isActive: user.isActive };
  });
}
