import { z } from "zod";
import { prisma, withTx } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { NotFound, ValidationError } from "@/domain/errors";
import { CustomerInput, InvitePortalUserInput } from "@/lib/zod-schemas/admin";
import { issuePortalLink } from "@/server/auth/portal-links";
import { sendQueuedEmails } from "@/server/email/outbox";
import type { SessionUser } from "@/server/auth/guards";

type Input = z.infer<typeof CustomerInput>;

function normalise(input: Input) {
  return {
    name: input.name.trim(),
    tier: input.tier,
    email: input.email ? input.email.toLowerCase().trim() : null,
    billingAddress: input.billingAddress?.trim() || null,
    priceListId: input.priceListId || null,
  };
}

export async function createCustomer(actor: SessionUser, input: Input) {
  return withTx(async (tx) => {
    const customer = await tx.customer.create({ data: normalise(input) });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Customer",
      entityId: customer.id,
      action: "CUSTOMER.CREATED",
      after: normalise(input),
    });
    return customer;
  });
}

export async function updateCustomer(actor: SessionUser, id: string, input: Input) {
  const before = await prisma.customer.findUnique({ where: { id } });
  if (!before) throw new NotFound("That customer no longer exists.");

  return withTx(async (tx) => {
    const customer = await tx.customer.update({ where: { id }, data: normalise(input) });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Customer",
      entityId: id,
      action: "CUSTOMER.UPDATED",
      before: { name: before.name, tier: before.tier, priceListId: before.priceListId },
      after: normalise(input),
    });
    return customer;
  });
}

export async function setCustomerActive(actor: SessionUser, id: string, isActive: boolean) {
  return withTx(async (tx) => {
    const customer = await tx.customer.update({ where: { id }, data: { isActive } });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Customer",
      entityId: id,
      action: isActive ? "CUSTOMER.REACTIVATED" : "CUSTOMER.DEACTIVATED",
      after: { isActive },
    });
    return customer;
  });
}

/** Creates the CUSTOMER user and sends their first magic link. */
export async function invitePortalUser(
  actor: SessionUser,
  input: z.infer<typeof InvitePortalUserInput>,
) {
  const email = input.email.toLowerCase().trim();
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new NotFound("That customer no longer exists.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.customerId !== customer.id) {
    throw new ValidationError("That email already belongs to another account.");
  }

  const user = await withTx(async (tx) => {
    const created = await tx.user.upsert({
      where: { email },
      update: { name: input.name, role: "CUSTOMER", isActive: true, customerId: customer.id },
      create: {
        email,
        name: input.name,
        role: "CUSTOMER",
        isActive: true,
        customerId: customer.id,
      },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "User",
      entityId: created.id,
      action: "CUSTOMER.PORTAL_USER_INVITED",
      after: { email, customerId: customer.id },
    });
    return created;
  });

  const link = await issuePortalLink(email);
  await sendQueuedEmails(5);
  return { user, devLink: link.devLink };
}
