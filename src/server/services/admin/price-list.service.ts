import { z } from "zod";
import { prisma, withTx } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { NotFound } from "@/domain/errors";
import { PriceListInput, PriceListItemInput } from "@/lib/zod-schemas/admin";
import type { SessionUser } from "@/server/auth/guards";

type Input = z.infer<typeof PriceListInput>;

function normalise(input: Input) {
  return {
    name: input.name.trim(),
    currency: input.currency,
    tier: input.tier ? (input.tier as "BRONZE" | "SILVER" | "GOLD") : null,
    rule: input.rule,
    percentOffBp: input.percentOffBp,
  };
}

export async function createPriceList(actor: SessionUser, input: Input) {
  return withTx(async (tx) => {
    const list = await tx.priceList.create({ data: normalise(input) });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "PriceList",
      entityId: list.id,
      action: "PRICE_LIST.CREATED",
      version: list.version,
      after: normalise(input),
    });
    return list;
  });
}

/**
 * Any change bumps `version`. Quotation lines snapshot the price they were
 * added at (CFG-02), so a bump never moves an existing quote - the builder just
 * offers a "Reprice" action when the version has moved on.
 */
export async function updatePriceList(actor: SessionUser, id: string, input: Input) {
  const before = await prisma.priceList.findUnique({ where: { id } });
  if (!before) throw new NotFound("That price list no longer exists.");

  return withTx(async (tx) => {
    const list = await tx.priceList.update({
      where: { id },
      data: { ...normalise(input), version: { increment: 1 } },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "PriceList",
      entityId: id,
      action: "PRICE_LIST.UPDATED",
      version: list.version,
      before: { rule: before.rule, percentOffBp: before.percentOffBp, version: before.version },
      after: { ...normalise(input), version: list.version },
    });
    return list;
  });
}

export async function upsertPriceListItem(
  actor: SessionUser,
  input: z.infer<typeof PriceListItemInput>,
) {
  return withTx(async (tx) => {
    const item = await tx.priceListItem.upsert({
      where: {
        priceListId_productId: { priceListId: input.priceListId, productId: input.productId },
      },
      update: { priceMinor: input.priceMinor },
      create: input,
    });
    const list = await tx.priceList.update({
      where: { id: input.priceListId },
      data: { version: { increment: 1 } },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "PriceList",
      entityId: input.priceListId,
      action: "PRICE_LIST.ITEM_SET",
      version: list.version,
      after: { productId: input.productId, priceMinor: input.priceMinor },
    });
    return item;
  });
}

export async function removePriceListItem(actor: SessionUser, itemId: string) {
  const item = await prisma.priceListItem.findUnique({ where: { id: itemId } });
  if (!item) throw new NotFound("That price already went away.");

  return withTx(async (tx) => {
    await tx.priceListItem.delete({ where: { id: itemId } });
    const list = await tx.priceList.update({
      where: { id: item.priceListId },
      data: { version: { increment: 1 } },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "PriceList",
      entityId: item.priceListId,
      action: "PRICE_LIST.ITEM_REMOVED",
      version: list.version,
      before: { productId: item.productId, priceMinor: item.priceMinor },
    });
  });
}

export async function assignPriceListToCustomer(
  actor: SessionUser,
  customerId: string,
  priceListId: string | null,
) {
  return withTx(async (tx) => {
    const customer = await tx.customer.update({
      where: { id: customerId },
      data: { priceListId },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Customer",
      entityId: customerId,
      action: "CUSTOMER.PRICE_LIST_ASSIGNED",
      after: { priceListId },
    });
    return customer;
  });
}
