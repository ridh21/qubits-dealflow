import { PrismaClient, type Role, type CustomerTier } from "@prisma/client";
import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD = "Password123!";

interface SeedUser {
  email: string;
  name: string;
  role: Role;
}

const INTERNAL_USERS: SeedUser[] = [
  { email: "admin@dealflow360.test", name: "Ada Admin", role: "ADMIN" },
  { email: "manager@dealflow360.test", name: "Marcus Manager", role: "SALES_MANAGER" },
  { email: "finance@dealflow360.test", name: "Fiona Finance", role: "FINANCE" },
  { email: "rep@dealflow360.test", name: "Riley Rep", role: "SALES_REP" },
  { email: "rep2@dealflow360.test", name: "Robin Rep", role: "SALES_REP" },
];

const CUSTOMERS: { name: string; tier: CustomerTier; email: string }[] = [
  { name: "Acme Industries", tier: "GOLD", email: "buyer@acme.test" },
  { name: "Beta Logistics", tier: "SILVER", email: "buyer@beta.test" },
  { name: "Delta Retail", tier: "BRONZE", email: "buyer@delta.test" },
  { name: "Nova Systems", tier: "GOLD", email: "buyer@nova.test" },
  { name: "Zenith Labs", tier: "SILVER", email: "buyer@zenith.test" },
  { name: "Orion Freight", tier: "GOLD", email: "buyer@orion.test" },
];

const PORTAL_USERS = [
  { customer: "Acme Industries", email: "buyer@acme.test", name: "Ava Buyer" },
  { customer: "Beta Logistics", email: "buyer@beta.test", name: "Ben Buyer" },
];

export async function seedBase(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const team = await prisma.team.upsert({
    where: { name: "Direct Sales" },
    update: {},
    create: { name: "Direct Sales" },
  });

  for (const u of INTERNAL_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, isActive: true, teamId: team.id },
      create: { ...u, passwordHash, isActive: true, teamId: team.id },
    });
  }

  // One pending signup so the admin Users screen always has something to approve.
  await prisma.user.upsert({
    where: { email: "newjoiner@dealflow360.test" },
    update: {},
    create: {
      email: "newjoiner@dealflow360.test",
      name: "Nina Newjoiner",
      passwordHash,
      role: "PENDING",
      isActive: false,
    },
  });

  for (const c of CUSTOMERS) {
    const existing = await prisma.customer.findFirst({ where: { name: c.name } });
    if (existing) {
      await prisma.customer.update({ where: { id: existing.id }, data: { tier: c.tier, email: c.email } });
    } else {
      await prisma.customer.create({ data: { name: c.name, tier: c.tier, email: c.email } });
    }
  }

  for (const p of PORTAL_USERS) {
    const customer = await prisma.customer.findFirst({ where: { name: p.customer } });
    if (!customer) continue;
    await prisma.user.upsert({
      where: { email: p.email },
      update: { customerId: customer.id, role: "CUSTOMER", isActive: true },
      create: {
        email: p.email,
        name: p.name,
        role: "CUSTOMER",
        isActive: true,
        customerId: customer.id,
      },
    });
  }

  for (const key of ["Q", "ORD", "INV", "CN", "SHP"]) {
    await prisma.numberSequence.upsert({
      where: { key },
      update: {},
      create: { key, next: 1000 },
    });
  }

  console.log(
    `  base: ${INTERNAL_USERS.length} internal users, ${CUSTOMERS.length} customers, ${PORTAL_USERS.length} portal users (password: ${DEFAULT_PASSWORD})`,
  );
}
