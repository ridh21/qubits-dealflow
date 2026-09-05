import { PrismaClient } from "@prisma/client";
import { seedBase } from "./seed/base";
import { seedCatalogue } from "./seed/catalogue";
import { seedPlans } from "./seed/plans";
import { seedPolicy } from "./seed/policy";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding DealFlow360…");
  await seedBase(prisma);
  await seedCatalogue(prisma);
  await seedPolicy(prisma);
  await seedPlans(prisma);
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
