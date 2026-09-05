import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Transaction client passed through every service. */
export type Tx = Prisma.TransactionClient;

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
    timeout: opts?.timeout ?? 15_000,
    maxWait: 10_000,
  });
}

/** Pessimistic row lock, used where two writers can race on one row. */
export async function lockRow(tx: Tx, table: string, id: string) {
  await tx.$queryRawUnsafe(
    `SELECT id FROM "${table}" WHERE id = $1 FOR UPDATE`,
    id,
  );
}
