import { PrismaClient, type RecurringInterval } from "@prisma/client";
import { pathToFileURL } from "node:url";

// Plan prices are INR minor units (paise) and must stay aligned with the
// catalogue base prices: SUB-CARE base = Standard MONTHLY, SUB-PHOTO base = Pro MONTHLY.
const products = [
  {
    sku: "SUB-CARE",
    name: "Care Plan",
      tiers: [{ name: "Standard", prices: { MONTHLY: 49_900, QUARTERLY: 149_900, YEARLY: 499_000 } }],
  },
  {
    sku: "SUB-PHOTO",
    name: "Photo App",
    tiers: [
      {
        name: "Pro",
        prices: {
          WEEKLY: 4_900,
          MONTHLY: 14_900,
          QUARTERLY: 39_900,
          YEARLY: 149_900,
        },
      },
      {
        name: "Plus",
        prices: {
          WEEKLY: 8_900,
          MONTHLY: 24_900,
          QUARTERLY: 69_900,
          YEARLY: 249_900,
        },
      },
      {
        name: "Pro Max",
        prices: {
          WEEKLY: 14_900,
          MONTHLY: 44_900,
          QUARTERLY: 124_900,
          YEARLY: 449_900,
        },
      },
    ],
  },
];

/** Additive and repeatable: rerunning a demo seed never replaces admin edits. */
export async function seedPlans(prisma: PrismaClient) {
  const category = await prisma.category.upsert({
    where: { name: "Subscriptions" },
    update: {},
    create: { name: "Subscriptions" },
  });
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
            costPriceMinor: 3_900,
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
