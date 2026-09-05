import { PrismaClient, Prisma } from "@prisma/client";
import type { ITXClientDenyList } from "@prisma/client/runtime/library";
import { softDeleteExtension } from "./soft-delete";

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  }).$extends(softDeleteExtension);
}

type ExtendedClient = ReturnType<typeof createClient>;

/** The soft-delete-extended client. Tests construct their own of this shape. */
export type DbClient = ExtendedClient;

const globalForPrisma = globalThis as unknown as { prisma?: ExtendedClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Transaction client passed through every service. Derived from the extended
 * client so `tx` reads are filtered by the soft-delete extension too.
 */
export type Tx = Omit<ExtendedClient, ITXClientDenyList>;

/**
 * Run `fn` inside a single transaction. Services never open nested
 * transactions - they take a `Tx` and are composed by the caller.
 */
export function withTx<T>(
  fn: (tx: Tx) => Promise<T>,
  opts?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeout?: number },
): Promise<T> {
  return prisma.$transaction(fn, {
    isolationLevel:
      opts?.isolationLevel ?? Prisma.TransactionIsolationLevel.ReadCommitted,
    timeout: opts?.timeout ?? (process.env.TEST_DATABASE_URL ? 60_000 : 15_000),
    maxWait: 10_000,
  });
}

/** Pessimistic row lock, used where two writers can race on one row. */
const LOCKABLE_TABLES = new Set(["Quotation", "ApprovalRequest", "StockLevel", "Order", "FulfillmentPlan", "Shipment", "Subscription", "Invoice", "CreditNote", "Backorder", "Warehouse"]);
export async function lockRow(tx: Tx, table: string, id: string) {
  if (!LOCKABLE_TABLES.has(table)) throw new Error("Unsupported row-lock table.");
  // Prisma qualifies model queries with the datasource schema. Raw SQL must do
  // the same; search_path is not necessarily the schema in DATABASE_URL.
  const schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "public";
  const identifier = (value: string) => '"' + value.replaceAll('"', '""') + '"';
  await tx.$queryRawUnsafe(
    `SELECT id FROM ${identifier(schema)}.${identifier(table)} WHERE id = $1 FOR UPDATE`,
    id,
  );
}
