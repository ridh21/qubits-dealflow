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
  status?: "ACTIVE" | "ARCHIVED";
}

const CATEGORIES = ["Hardware", "Services", "Subscriptions"];

// All amounts are INR minor units (paise). GST is modelled at 18 % (1800 bp).
const PRODUCTS: SeedProduct[] = [
  {
    sku: "LAP-PRO-14",
    name: "Laptop Pro 14",
    category: "Hardware",
    type: "PHYSICAL",
    basePriceMinor: 5_299_000,
    costPriceMinor: 4_199_000,
    taxBp: 1800,
    description: "14-inch workstation laptop, configurable memory and finish.",
    minMarginBp: 1200,
  },
  {
    sku: "DOCK-STD",
    name: "Docking Station",
    category: "Hardware",
    type: "PHYSICAL",
    basePriceMinor: 449_900,
    costPriceMinor: 319_900,
    taxBp: 1800,
    isPromoted: true,
  },
  {
    sku: "MOUSE-WL",
    name: "Wireless Mouse",
    category: "Hardware",
    type: "PHYSICAL",
    basePriceMinor: 99_900,
    costPriceMinor: 61_000,
    taxBp: 1800,
  },
  {
    sku: "KB-MECH",
    name: "Mechanical Keyboard",
    category: "Hardware",
    type: "PHYSICAL",
    basePriceMinor: 349_900,
    costPriceMinor: 249_900,
    taxBp: 1800,
    isPromoted: true,
  },
  // Edge: cheapest catalogue line, also the out-of-stock backorder victim.
  {
    sku: "CBL-USBC",
    name: "USB-C Cable 1m",
    category: "Hardware",
    type: "PHYSICAL",
    basePriceMinor: 29_900,
    costPriceMinor: 12_000,
    taxBp: 1800,
  },
  // Edge: archived product — quoted historically, blocked for new lines.
  {
    sku: "HW-RET-2019",
    name: "Legacy Dock 2019",
    category: "Hardware",
    type: "PHYSICAL",
    basePriceMinor: 299_900,
    costPriceMinor: 210_000,
    taxBp: 1800,
    status: "ARCHIVED",
    description: "End-of-life model kept for history.",
  },
  {
    sku: "SVC-ONSITE",
    name: "Onsite Setup Service",
    category: "Services",
    type: "SERVICE",
    basePriceMinor: 349_900,
    costPriceMinor: 219_900,
    taxBp: 1800,
    unit: "Visit",
    description: "Billed once the engineer records completion.",
  },
  // Edge: negative-margin line for margin-guardrail testing.
  {
    sku: "SVC-TRAINING",
    name: "Team Training Workshop",
    category: "Services",
    type: "SERVICE",
    basePriceMinor: 89_900,
    costPriceMinor: 105_000,
    taxBp: 1800,
    unit: "Session",
    description: "Loss-leader onboarding workshop.",
  },
  // Edge: zero-tax service line.
  {
    sku: "SVC-WARRANTY",
    name: "Extended Warranty",
    category: "Services",
    type: "SERVICE",
    basePriceMinor: 299_900,
    costPriceMinor: 89_900,
    taxBp: 0,
    unit: "Year",
  },
  {
    sku: "SUB-CARE",
    name: "Care Plan",
    category: "Subscriptions",
    type: "SUBSCRIPTION",
    basePriceMinor: 49_900,
    costPriceMinor: 14_900,
    taxBp: 1800,
    unit: "Seat",
  },
  // Edge: subscription product with no tiers or plans configured.
  {
    sku: "SUB-SLA",
    name: "Support SLA",
    category: "Subscriptions",
    type: "SUBSCRIPTION",
    basePriceMinor: 199_900,
    costPriceMinor: 59_900,
    taxBp: 1800,
    unit: "Account",
  },
  {
    sku: "SUB-PHOTO",
    name: "Photo App",
    category: "Subscriptions",
    type: "SUBSCRIPTION",
    basePriceMinor: 14_900,
    costPriceMinor: 3_900,
    taxBp: 1800,
    unit: "Seat",
    description: "Tiers and per-day entitlements are configured in Plans & entitlements.",
  },
];

const VARIANTS: Record<string, { name: string; values: { value: string; extraPriceMinor: number }[] }[]> = {
  "LAP-PRO-14": [
    { name: "Size", values: [{ value: "14 inch", extraPriceMinor: 0 }, { value: "16 inch", extraPriceMinor: 1_500_000 }] },
    { name: "Color", values: [{ value: "Graphite", extraPriceMinor: 0 }, { value: "Silver", extraPriceMinor: 0 }] },
    { name: "RAM", values: [{ value: "16 GB", extraPriceMinor: 0 }, { value: "32 GB", extraPriceMinor: 299_000 }] },
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
        status: p.status ?? "ACTIVE",
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
        status: p.status ?? "ACTIVE",
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

  // Price lists (INR): list price, tiered percent-off, a fixed-item contract,
  // an explicit item override on a NO_ADJUSTMENT list, and an inactive list.
  const standard =
    (await prisma.priceList.findFirst({ where: { name: "Standard INR" } })) ??
    (await prisma.priceList.create({
      data: { name: "Standard INR", currency: "INR", rule: "NO_ADJUSTMENT" },
    }));
  const gold =
    (await prisma.priceList.findFirst({ where: { name: "Gold INR" } })) ??
    (await prisma.priceList.create({
      data: { name: "Gold INR", currency: "INR", tier: "GOLD", rule: "PERCENT_OFF_BASE", percentOffBp: 1000 },
    }));
  const silver =
    (await prisma.priceList.findFirst({ where: { name: "Silver INR" } })) ??
    (await prisma.priceList.create({
      data: { name: "Silver INR", currency: "INR", tier: "SILVER", rule: "PERCENT_OFF_BASE", percentOffBp: 500 },
    }));
  const contract =
    (await prisma.priceList.findFirst({ where: { name: "Contract INR" } })) ??
    (await prisma.priceList.create({
      data: { name: "Contract INR", currency: "INR", tier: "GOLD", rule: "FIXED_ITEMS" },
    }));
  // Edge: inactive list that must never be offered.
  const legacy =
    (await prisma.priceList.findFirst({ where: { name: "Legacy INR" } })) ??
    (await prisma.priceList.create({
      data: { name: "Legacy INR", currency: "INR", rule: "NO_ADJUSTMENT", isActive: false, version: 2 },
    }));

  // Edge: explicit item override honoured even under NO_ADJUSTMENT.
  const mouseOverride = await prisma.priceListItem.findFirst({
    where: { priceListId: standard.id, productId: productIds.get("MOUSE-WL")! },
  });
  if (!mouseOverride) {
    await prisma.priceListItem.create({
      data: { priceListId: standard.id, productId: productIds.get("MOUSE-WL")!, priceMinor: 89_900 },
    });
  }
  for (const [sku, priceMinor] of [
    ["LAP-PRO-14", 4_899_000],
    ["DOCK-STD", 399_900],
  ] as const) {
    const item = await prisma.priceListItem.findFirst({
      where: { priceListId: contract.id, productId: productIds.get(sku)! },
    });
    if (!item) {
      await prisma.priceListItem.create({
        data: { priceListId: contract.id, productId: productIds.get(sku)!, priceMinor },
      });
    }
  }

  for (const c of await prisma.customer.findMany({ where: { priceListId: null } })) {
    if (c.name === "Nair Foods") continue; // Edge: customer with no price list at all.
    const priceListId =
      c.name === "Chettiar Freight"
        ? contract.id
        : c.name === "Bose Textiles"
          ? legacy.id // Edge: customer pinned to a deactivated list.
          : c.tier === "GOLD"
            ? gold.id
            : c.tier === "SILVER"
              ? silver.id
              : standard.id;
    await prisma.customer.update({ where: { id: c.id }, data: { priceListId } });
  }

  // Warehouses (per PRD scenario B, rupee costs) plus an inactive depot edge.
  const main = await prisma.warehouse.upsert({
    where: { code: "MAIN" },
    update: {},
    create: {
      name: "Mumbai Main Warehouse",
      code: "MAIN",
      shippingCostWeightMinor: 0,
      fixedShipmentCostMinor: 120_000,
      priority: 0,
    },
  });
  const east = await prisma.warehouse.upsert({
    where: { code: "EAST" },
    update: {},
    create: {
      name: "Kolkata East Depot",
      code: "EAST",
      shippingCostWeightMinor: 20_000,
      fixedShipmentCostMinor: 170_000,
      priority: 1,
    },
  });
  await prisma.warehouse.upsert({
    where: { code: "WEST" },
    update: {},
    create: {
      name: "Goa Depot",
      code: "WEST",
      shippingCostWeightMinor: 35_000,
      fixedShipmentCostMinor: 250_000,
      priority: 9,
      isActive: false,
    },
  });

  const laptopId = productIds.get("LAP-PRO-14")!;
  const stock: { warehouseId: string; productId: string; onHand: number; reserved: number; reorderPoint: number }[] = [
    { warehouseId: main.id, productId: laptopId, onHand: 18, reserved: 2, reorderPoint: 6 },
    // Edge: sitting exactly at the reorder point.
    { warehouseId: east.id, productId: laptopId, onHand: 4, reserved: 0, reorderPoint: 4 },
    { warehouseId: main.id, productId: productIds.get("DOCK-STD")!, onHand: 40, reserved: 0, reorderPoint: 10 },
    { warehouseId: east.id, productId: productIds.get("DOCK-STD")!, onHand: 12, reserved: 3, reorderPoint: 6 },
    { warehouseId: main.id, productId: productIds.get("MOUSE-WL")!, onHand: 120, reserved: 0, reorderPoint: 30 },
    { warehouseId: main.id, productId: productIds.get("KB-MECH")!, onHand: 5, reserved: 2, reorderPoint: 3 },
    // Edge: fully out of stock with a reorder point far above zero.
    { warehouseId: main.id, productId: productIds.get("CBL-USBC")!, onHand: 0, reserved: 0, reorderPoint: 50 },
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
        qty: 10,
        eta: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log(
    `  catalogue: ${PRODUCTS.length} products, 5 price lists, 3 warehouses, ${stock.length} stock rows`,
  );
}
