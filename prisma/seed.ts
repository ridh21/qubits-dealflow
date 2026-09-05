import { PrismaClient } from "@prisma/client";
import { seedBase } from "./seed/base";
import { seedCatalogue } from "./seed/catalogue";
import { seedPlans } from "./seed/plans";
import { seedPolicy } from "./seed/policy";
import { seedDemo } from "./seed/demo";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding DealFlow360…");
  await seedBase(prisma);
  await seedCatalogue(prisma);
  await seedPolicy(prisma);
  await seedPlans(prisma);
  await seedDemo(prisma);
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
