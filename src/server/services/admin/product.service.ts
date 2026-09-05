import { z } from "zod";
import { prisma, withTx } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { NotFound, ValidationError } from "@/domain/errors";
import { CategoryInput, ProductInput, SetVariantsInput } from "@/lib/zod-schemas/admin";
import type { SessionUser } from "@/server/auth/guards";

type Input = z.infer<typeof ProductInput>;

export async function createCategory(actor: SessionUser, input: z.infer<typeof CategoryInput>) {
  const existing = await prisma.category.findUnique({ where: { name: input.name } });
  if (existing) throw new ValidationError("That category already exists.");

  return withTx(async (tx) => {
    const category = await tx.category.create({ data: input });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Category",
      entityId: category.id,
      action: "CATEGORY.CREATED",
      after: { name: category.name },
    });
    return category;
  });
}

function validateMargin(input: Input) {
  if (input.costPriceMinor > input.basePriceMinor) {
    throw new ValidationError("Cost price is above the list price - the product would sell at a loss.");
  }
}

export async function createProduct(actor: SessionUser, input: Input) {
  validateMargin(input);
  const existing = await prisma.product.findUnique({ where: { sku: input.sku } });
  if (existing) throw new ValidationError("That SKU is already in use.");

  return withTx(async (tx) => {
    const product = await tx.product.create({
      data: { ...input, description: input.description?.trim() || null },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Product",
      entityId: product.id,
      action: "PRODUCT.CREATED",
      after: { sku: product.sku, name: product.name, type: product.type },
    });
    return product;
  });
}

export async function updateProduct(actor: SessionUser, id: string, input: Input) {
  validateMargin(input);
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) throw new NotFound("That product no longer exists.");
  if (before.sku !== input.sku) {
    const clash = await prisma.product.findUnique({ where: { sku: input.sku } });
    if (clash) throw new ValidationError("That SKU is already in use.");
  }

  return withTx(async (tx) => {
    const product = await tx.product.update({
      where: { id },
      data: { ...input, description: input.description?.trim() || null },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Product",
      entityId: id,
      action: "PRODUCT.UPDATED",
      before: {
        basePriceMinor: before.basePriceMinor,
        costPriceMinor: before.costPriceMinor,
        taxBp: before.taxBp,
      },
      after: {
        basePriceMinor: product.basePriceMinor,
        costPriceMinor: product.costPriceMinor,
        taxBp: product.taxBp,
      },
    });
    return product;
  });
}

/**
 * Archiving keeps the product on historical quotes and orders (lines snapshot
 * `productName`), it only stops it being added to anything new.
 */
export async function setProductStatus(
  actor: SessionUser,
  id: string,
  status: "ACTIVE" | "ARCHIVED",
) {
  return withTx(async (tx) => {
    const product = await tx.product.update({ where: { id }, data: { status } });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Product",
      entityId: id,
      action: status === "ARCHIVED" ? "PRODUCT.ARCHIVED" : "PRODUCT.RESTORED",
      after: { status },
    });
    return product;
  });
}

/** Replaces the whole attribute set; simplest correct behaviour for the editor. */
export async function setVariants(actor: SessionUser, input: z.infer<typeof SetVariantsInput>) {
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) throw new NotFound("That product no longer exists.");

  return withTx(async (tx) => {
    await tx.variantAttribute.updateMany({
      where: { productId: input.productId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    for (const attr of input.attributes) {
      await tx.variantAttribute.create({
        data: {
          productId: input.productId,
          name: attr.name,
          sortOrder: attr.sortOrder,
          values: { create: attr.values },
        },
      });
    }
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Product",
      entityId: input.productId,
      action: "PRODUCT.VARIANTS_SET",
      after: { attributes: input.attributes.map((a) => ({ name: a.name, values: a.values.length })) },
    });
    return tx.variantAttribute.findMany({
      where: { productId: input.productId },
      include: { values: true },
      orderBy: { sortOrder: "asc" },
    });
  });
}

/** Number of distinct variant combinations, i.e. the product of value counts. */
export function variantCombinationCount(attributes: { values: unknown[] }[]) {
  if (attributes.length === 0) return 0;
  return attributes.reduce((acc, a) => acc * Math.max(1, a.values.length), 1);
}
