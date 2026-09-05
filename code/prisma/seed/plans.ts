import { PrismaClient, type RecurringInterval } from "@prisma/client";
import { pathToFileURL } from "node:url";

/** Additive and repeatable: rerunning a demo seed never replaces admin edits. */
export async function seedPlans(prisma: PrismaClient) {
  const category = await prisma.category.upsert({
    where: { name: "Subscriptions" },
    update: {},
    create: { name: "Subscriptions" },
  });
  const products = [
    {
      sku: "SUB-CARE",
      name: "Care Plan",
      tiers: [{ name: "Standard", prices: { MONTHLY: 4600, YEARLY: 46000 } }],
    },
    {
      sku: "SUB-PHOTO",
      name: "Photo App",
      tiers: [
        {
          name: "Pro",
          prices: {
            WEEKLY: 500,
            MONTHLY: 1500,
            QUARTERLY: 4000,
            YEARLY: 15000,
          },
        },
        {
          name: "Plus",
          prices: {
            WEEKLY: 900,
            MONTHLY: 2500,
            QUARTERLY: 7000,
            YEARLY: 25000,
          },
        },
        {
          name: "Pro Max",
          prices: {
            WEEKLY: 1500,
            MONTHLY: 4500,
            QUARTERLY: 12500,
            YEARLY: 45000,
          },
        },
      ],
    },
  ];
  for (const spec of products) {
    await prisma.$transaction(
      async (tx) => {
        const product = await tx.product.upsert({
          where: { sku: spec.sku },
          update: {},
          create: {
            sku: spec.sku,
            name: spec.name,
            type: "SUBSCRIPTION",
            categoryId: category.id,
            basePriceMinor: spec.tiers[0].prices.MONTHLY,
            costPriceMinor: 0,
          },
        });
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`plans:${product.id}`}))`;
        for (const [rank, entry] of spec.tiers.entries()) {
          const tier = await tx.planTier.upsert({
            where: {
              productId_name: { productId: product.id, name: entry.name },
            },
            update: {},
            create: { productId: product.id, name: entry.name, rank },
          });
          for (const [cycle, priceMinor] of Object.entries(entry.prices)) {
            const interval = cycle as RecurringInterval;
            await tx.subscriptionPlan.upsert({
              where: { tierId_interval: { tierId: tier.id, interval } },
              update: {},
              create: {
                productId: product.id,
                tierId: tier.id,
                name: `${entry.name} ${cycle.toLowerCase()}`,
                interval,
                priceMinor,
                isActive: tier.isActive,
              },
            });
          }
        }
        // Entitlements are deliberately configured and published through the admin UI.
      },
      { timeout: 60_000 },
    );
  }
}

// Can be run independently until the parent wires seedPlans into prisma/seed.ts.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const prisma = new PrismaClient();
  seedPlans(prisma)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
