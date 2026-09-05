import { PrismaClient, type ProductType } from "@prisma/client";

interface SeedProduct {
  sku: string;
  name: string;
  category: string;
  type: ProductType;
  basePriceMinor: number;
  costPriceMinor: number;
  taxBp: number;
  unit?: string;
  description?: string;
  isPromoted?: boolean;
  minMarginBp?: number;
}

const CATEGORIES = ["Hardware", "Services", "Subscriptions"];

const PRODUCTS: SeedProduct[] = [
  {
    sku: "LAP-PRO-14",
    name: "Laptop Pro 14",
    category: "Hardware",
    type: "PHYSICAL",
    basePriceMinor: 120_000,
    costPriceMinor: 90_000,
    taxBp: 1000,
    description: "14-inch workstation laptop, configurable memory and finish.",
    minMarginBp: 1200,
  },
  {
    sku: "DOCK-STD",
    name: "Docking Station",
    category: "Hardware",
    type: "PHYSICAL",
    basePriceMinor: 18_000,
    costPriceMinor: 12_000,
    taxBp: 1000,
    isPromoted: true,
  },
  {
    sku: "MOUSE-WL",
    name: "Wireless Mouse",
    category: "Hardware",
    type: "PHYSICAL",
    basePriceMinor: 4_000,
    costPriceMinor: 2_200,
    taxBp: 1000,
  },
  {
    sku: "SVC-ONSITE",
    name: "Onsite Setup Service",
    category: "Services",
    type: "SERVICE",
    basePriceMinor: 45_000,
    costPriceMinor: 30_000,
    taxBp: 0,
    unit: "Visit",
    description: "Billed once the engineer records completion.",
  },
  {
    sku: "SVC-WARRANTY",
    name: "Extended Warranty",
    category: "Services",
    type: "SERVICE",
    basePriceMinor: 18_000,
    costPriceMinor: 6_000,
    taxBp: 0,
    unit: "Year",
  },
  {
    sku: "SUB-CARE",
    name: "Care Plan",
    category: "Subscriptions",
    type: "SUBSCRIPTION",
    basePriceMinor: 2_500,
    costPriceMinor: 900,
    taxBp: 0,
    unit: "Seat",
  },
  {
    sku: "SUB-SLA",
    name: "Support SLA",
    category: "Subscriptions",
    type: "SUBSCRIPTION",
    basePriceMinor: 9_900,
    costPriceMinor: 3_500,
    taxBp: 0,
    unit: "Account",
  },
  {
    sku: "SUB-PHOTO",
    name: "Photo App",
    category: "Subscriptions",
    type: "SUBSCRIPTION",
    basePriceMinor: 1_200,
    costPriceMinor: 300,
    taxBp: 0,
    unit: "Seat",
    description: "Tiers and per-day entitlements are configured in Plans & entitlements.",
  },
];

const VARIANTS: Record<string, { name: string; values: { value: string; extraPriceMinor: number }[] }[]> = {
  "LAP-PRO-14": [
    { name: "Size", values: [{ value: "14 inch", extraPriceMinor: 0 }, { value: "16 inch", extraPriceMinor: 15_000 }] },
    { name: "Color", values: [{ value: "Graphite", extraPriceMinor: 0 }, { value: "Silver", extraPriceMinor: 0 }] },
    { name: "RAM", values: [{ value: "16 GB", extraPriceMinor: 0 }, { value: "32 GB", extraPriceMinor: 3_000 }] },
    { name: "Manufacturer", values: [{ value: "Northwind", extraPriceMinor: 0 }, { value: "Contoso", extraPriceMinor: 0 }] },
  ],
};

export async function seedCatalogue(prisma: PrismaClient) {
  const categoryIds = new Map<string, string>();
  for (const [i, name] of CATEGORIES.entries()) {
    const c = await prisma.category.upsert({
      where: { name },
      update: { sortOrder: i },
      create: { name, sortOrder: i },
    });
    categoryIds.set(name, c.id);
  }

  const productIds = new Map<string, string>();
  for (const p of PRODUCTS) {
    const created = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        basePriceMinor: p.basePriceMinor,
        costPriceMinor: p.costPriceMinor,
        taxBp: p.taxBp,
      },
      create: {
        sku: p.sku,
        name: p.name,
        description: p.description ?? null,
        categoryId: categoryIds.get(p.category)!,
        type: p.type,
        unit: p.unit ?? "Each",
        basePriceMinor: p.basePriceMinor,
        costPriceMinor: p.costPriceMinor,
        taxBp: p.taxBp,
        isPromoted: p.isPromoted ?? false,
        minMarginBp: p.minMarginBp ?? 0,
      },
    });
    productIds.set(p.sku, created.id);
  }

  for (const [sku, attributes] of Object.entries(VARIANTS)) {
    const productId = productIds.get(sku);
    if (!productId) continue;
    const existing = await prisma.variantAttribute.count({ where: { productId } });
    if (existing > 0) continue;
    for (const [i, attr] of attributes.entries()) {
      await prisma.variantAttribute.create({
        data: {
          productId,
          name: attr.name,
          sortOrder: i,
          values: { create: attr.values },
        },
      });
    }
  }

  // Price lists: Standard at list price, Gold at 10 % off base.
  const standard =
    (await prisma.priceList.findFirst({ where: { name: "Standard USD" } })) ??
    (await prisma.priceList.create({
      data: { name: "Standard USD", currency: "USD", rule: "NO_ADJUSTMENT" },
    }));
  const gold =
    (await prisma.priceList.findFirst({ where: { name: "Gold USD" } })) ??
    (await prisma.priceList.create({
      data: { name: "Gold USD", currency: "USD", tier: "GOLD", rule: "PERCENT_OFF_BASE", percentOffBp: 1000 },
    }));

  for (const c of await prisma.customer.findMany({ where: { priceListId: null } })) {
    await prisma.customer.update({
      where: { id: c.id },
      data: { priceListId: c.tier === "GOLD" ? gold.id : standard.id },
    });
  }

  // Warehouses per PRD scenario B.
  const main = await prisma.warehouse.upsert({
    where: { code: "MAIN" },
    update: {},
    create: {
      name: "Main Warehouse",
      code: "MAIN",
      shippingCostWeightMinor: 0,
      fixedShipmentCostMinor: 1_200,
      priority: 0,
    },
  });
  const east = await prisma.warehouse.upsert({
    where: { code: "EAST" },
    update: {},
    create: {
      name: "East Depot",
      code: "EAST",
      shippingCostWeightMinor: 200,
      fixedShipmentCostMinor: 1_700,
      priority: 1,
    },
  });

  const laptopId = productIds.get("LAP-PRO-14")!;
  const stock: { warehouseId: string; productId: string; onHand: number; reorderPoint: number }[] = [
    { warehouseId: main.id, productId: laptopId, onHand: 18, reorderPoint: 6 },
    { warehouseId: east.id, productId: laptopId, onHand: 4, reorderPoint: 4 },
    { warehouseId: main.id, productId: productIds.get("DOCK-STD")!, onHand: 40, reorderPoint: 10 },
    { warehouseId: east.id, productId: productIds.get("DOCK-STD")!, onHand: 12, reorderPoint: 6 },
    { warehouseId: main.id, productId: productIds.get("MOUSE-WL")!, onHand: 120, reorderPoint: 30 },
  ];
  for (const s of stock) {
    await prisma.stockLevel.upsert({
      where: { warehouseId_productId: { warehouseId: s.warehouseId, productId: s.productId } },
      update: {},
      create: s,
    });
  }

  const hasPlan = await prisma.replenishmentPlan.findFirst({
    where: { warehouseId: east.id, productId: laptopId, status: "PLANNED" },
  });
  if (!hasPlan) {
    await prisma.replenishmentPlan.create({
      data: {
        warehouseId: east.id,
        productId: laptopId,
        qty: 2,
        eta: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log(
    `  catalogue: ${PRODUCTS.length} products, 2 price lists, 2 warehouses, ${stock.length} stock rows`,
  );
}
