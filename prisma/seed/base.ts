import { PrismaClient, type Role, type CustomerTier } from "@prisma/client";
import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD = "Password123!";

interface SeedUser {
  email: string;
  name: string;
  role: Role;
}

const INTERNAL_USERS: SeedUser[] = [
  { email: "arjun.admin@yopmail.com", name: "Arjun Malhotra", role: "ADMIN" },
  { email: "vikram.manager@yopmail.com", name: "Vikram Desai", role: "SALES_MANAGER" },
  { email: "kavya.manager@yopmail.com", name: "Kavya Iyer", role: "SALES_MANAGER" },
  { email: "priya.finance@yopmail.com", name: "Priya Raghavan", role: "FINANCE" },
  { email: "rahul.rep@yopmail.com", name: "Rahul Verma", role: "SALES_REP" },
  { email: "sneha.rep@yopmail.com", name: "Sneha Kulkarni", role: "SALES_REP" },
  { email: "imran.rep@yopmail.com", name: "Imran Sheikh", role: "SALES_REP" },
];

const CUSTOMERS: { name: string; tier: CustomerTier; email: string | null }[] = [
  { name: "Sharma Industries", tier: "GOLD", email: "aarav.sharma@yopmail.com" },
  { name: "Mehta Logistics", tier: "SILVER", email: "ananya.mehta@yopmail.com" },
  { name: "Gupta Retail", tier: "BRONZE", email: "rohan.gupta@yopmail.com" },
  { name: "Reddy Systems", tier: "GOLD", email: "deepa.reddy@yopmail.com" },
  { name: "Iyer Pharma", tier: "SILVER", email: "karthik.iyer@yopmail.com" },
  { name: "Chettiar Freight", tier: "GOLD", email: "lakshmi.chettiar@yopmail.com" },
  { name: "Patil Agro", tier: "BRONZE", email: "vijay.patil@yopmail.com" },
  // Edge: no billing email and no portal user on file.
  { name: "Nair Foods", tier: "BRONZE", email: null },
  // Edge: deactivated account — hidden from active lists.
  { name: "Bose Textiles", tier: "BRONZE", email: "riya.bose@yopmail.com" },
];

const PORTAL_USERS = [
  { customer: "Sharma Industries", email: "aarav.sharma@yopmail.com", name: "Aarav Sharma" },
  { customer: "Mehta Logistics", email: "ananya.mehta@yopmail.com", name: "Ananya Mehta" },
  { customer: "Gupta Retail", email: "rohan.gupta@yopmail.com", name: "Rohan Gupta" },
  { customer: "Reddy Systems", email: "deepa.reddy@yopmail.com", name: "Deepa Reddy" },
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

  // Edge: a deactivated rep with no team, never logged in.
  await prisma.user.upsert({
    where: { email: "imran.rep@yopmail.com" },
    update: { isActive: false, teamId: null },
    create: {
      email: "imran.rep@yopmail.com",
      name: "Imran Sheikh",
      role: "SALES_REP",
      passwordHash,
      isActive: false,
    },
  });

  // One pending signup so the admin Users screen always has something to approve.
  await prisma.user.upsert({
    where: { email: "neha.newjoiner@yopmail.com" },
    update: {},
    create: {
      email: "neha.newjoiner@yopmail.com",
      name: "Neha Joshi",
      passwordHash,
      role: "PENDING",
      isActive: false,
    },
  });

  for (const c of CUSTOMERS) {
    const existing = await prisma.customer.findFirst({ where: { name: c.name } });
    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: { tier: c.tier, email: c.email, currency: "INR", isActive: c.name !== "Bose Textiles" },
      });
    } else {
      await prisma.customer.create({
        data: {
          name: c.name,
          tier: c.tier,
          email: c.email,
          currency: "INR",
          isActive: c.name !== "Bose Textiles",
          billingAddress:
            c.name === "Patil Agro"
              ? "Plot 42, MIDC Industrial Area\nBhosari, Pune 411026\nMaharashtra, India"
              : null,
        },
      });
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
