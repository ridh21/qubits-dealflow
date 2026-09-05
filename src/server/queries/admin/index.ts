import { prisma } from "@/server/db";
import { orderByOf, paginate, parseListParams, type SearchParamsRecord } from "@/server/list";
import {
  CustomerFilters,
  EmailFilters,
  MovementFilters,
  ProductFilters,
  StockFilters,
  UserFilters,
} from "@/lib/zod-schemas/admin";
import type { Prisma } from "@prisma/client";

export async function listUsers(sp: SearchParamsRecord) {
  const p = parseListParams(sp, UserFilters);
  const where: Prisma.UserWhereInput = {
    ...(p.filters.role ? { role: p.filters.role } : {}),
    ...(p.filters.teamId ? { teamId: p.filters.teamId } : {}),
    ...(p.filters.status ? { isActive: p.filters.status === "active" } : {}),
    ...(p.q
      ? { OR: [{ name: { contains: p.q, mode: "insensitive" } }, { email: { contains: p.q, mode: "insensitive" } }] }
      : {}),
  };
  const orderBy = orderByOf(p.sort, p.dir, ["name", "email", "role", "createdAt", "lastLoginAt"], {
    createdAt: "desc",
  });

  const result = await paginate(
    () => prisma.user.count({ where }),
    (skip, take) =>
      prisma.user.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { team: true, customer: { select: { name: true } } },
      }),
    p,
  );
  return { ...result, params: p };
}

export async function listCustomers(sp: SearchParamsRecord) {
  const p = parseListParams(sp, CustomerFilters);
  const where: Prisma.CustomerWhereInput = {
    ...(p.filters.tier ? { tier: p.filters.tier } : {}),
    ...(p.filters.priceListId ? { priceListId: p.filters.priceListId } : {}),
    ...(p.filters.status ? { isActive: p.filters.status === "active" } : {}),
    ...(p.q ? { name: { contains: p.q, mode: "insensitive" } } : {}),
  };
  const orderBy = orderByOf(p.sort, p.dir, ["name", "tier", "createdAt"], { createdAt: "desc" });

  const result = await paginate(
    () => prisma.customer.count({ where }),
    (skip, take) =>
      prisma.customer.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          priceList: { select: { name: true } },
          _count: { select: { users: true, quotations: true, orders: true } },
        },
      }),
    p,
  );
  return { ...result, params: p };
}

export async function listProducts(sp: SearchParamsRecord) {
  const p = parseListParams(sp, ProductFilters);
  const where: Prisma.ProductWhereInput = {
    ...(p.filters.categoryId ? { categoryId: p.filters.categoryId } : {}),
    ...(p.filters.type ? { type: p.filters.type } : {}),
    ...(p.filters.status ? { status: p.filters.status } : {}),
    ...(p.q
      ? { OR: [{ name: { contains: p.q, mode: "insensitive" } }, { sku: { contains: p.q, mode: "insensitive" } }] }
      : {}),
  };
  const orderBy = orderByOf(p.sort, p.dir, ["name", "sku", "basePriceMinor", "createdAt"], {
    createdAt: "desc",
  });

  const result = await paginate(
    () => prisma.product.count({ where }),
    (skip, take) =>
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { category: { select: { name: true } } },
      }),
    p,
  );
  return { ...result, params: p };
}

export async function listStock(warehouseId: string, sp: SearchParamsRecord) {
  const p = parseListParams(sp, StockFilters);
  const where: Prisma.StockLevelWhereInput = {
    warehouseId,
    ...(p.filters.productId ? { productId: p.filters.productId } : {}),
    ...(p.q ? { product: { name: { contains: p.q, mode: "insensitive" } } } : {}),
  };

  const result = await paginate(
    () => prisma.stockLevel.count({ where }),
    (skip, take) =>
      prisma.stockLevel.findMany({
        where,
        orderBy: { product: { name: "asc" } },
        skip,
        take,
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      }),
    p,
  );

  const etas = await prisma.replenishmentPlan.findMany({
    where: { warehouseId, status: "PLANNED" },
    orderBy: { eta: "asc" },
  });
  const nextEta = new Map<string, Date>();
  for (const e of etas) if (!nextEta.has(e.productId)) nextEta.set(e.productId, e.eta);

  const rows = result.rows
    .map((r) => ({
      ...r,
      available: r.onHand - r.reserved,
      nextEta: nextEta.get(r.productId) ?? null,
    }))
    .filter((r) => (p.filters.below === "reorder" ? r.available <= r.reorderPoint : true));

  return { ...result, rows, params: p };
}

export async function listMovements(warehouseId: string, sp: SearchParamsRecord) {
  const p = parseListParams(sp, MovementFilters);
  const where: Prisma.StockMovementWhereInput = {
    warehouseId,
    ...(p.filters.type ? { type: p.filters.type } : {}),
    ...(p.filters.productId ? { productId: p.filters.productId } : {}),
  };

  const result = await paginate(
    () => prisma.stockMovement.count({ where }),
    (skip, take) => prisma.stockMovement.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    p,
  );

  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(result.rows.map((r) => r.productId))] } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(products.map((p2) => [p2.id, p2.name]));

  return {
    ...result,
    rows: result.rows.map((r) => ({ ...r, productName: nameOf.get(r.productId) ?? r.productId })),
    params: p,
  };
}

export async function listEmails(sp: SearchParamsRecord) {
  const p = parseListParams(sp, EmailFilters);
  const where: Prisma.EmailMessageWhereInput = {
    ...(p.filters.status ? { status: p.filters.status } : {}),
    ...(p.filters.relatedType ? { relatedType: p.filters.relatedType } : {}),
    ...(p.q
      ? { OR: [{ subject: { contains: p.q, mode: "insensitive" } }, { toEmail: { contains: p.q, mode: "insensitive" } }] }
      : {}),
  };

  const result = await paginate(
    () => prisma.emailMessage.count({ where }),
    (skip, take) => prisma.emailMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    p,
  );
  return { ...result, params: p };
}

export async function adminOverviewCounts() {
  const [pendingUsers, users, customers, products, priceLists, warehouses, queuedEmails, lowStock] =
    await Promise.all([
      prisma.user.count({ where: { role: "PENDING" } }),
      prisma.user.count(),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.product.count({ where: { status: "ACTIVE" } }),
      prisma.priceList.count({ where: { isActive: true } }),
      prisma.warehouse.count({ where: { isActive: true } }),
      prisma.emailMessage.count({ where: { status: "QUEUED" } }),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM "StockLevel"
        WHERE ("onHand" - "reserved") <= "reorderPoint"`,
    ]);

  return {
    pendingUsers,
    users,
    customers,
    products,
    priceLists,
    warehouses,
    queuedEmails,
    lowStock: Number(lowStock[0]?.count ?? 0),
  };
}
