import type { Tx } from "./db";

export type SequenceKey = "Q" | "ORD" | "INV" | "CN" | "SHP";

const PAD = 5;

/**
 * Atomic number allocation. The UPDATE ... RETURNING locks the row, so two
 * concurrent callers can never receive the same number.
 */
export async function nextNumber(tx: Tx, key: SequenceKey): Promise<string> {
  const rows = await tx.$queryRawUnsafe<{ next: number }[]>(
    `INSERT INTO "NumberSequence" ("key", "next") VALUES ($1, 1001)
     ON CONFLICT ("key") DO UPDATE SET "next" = "NumberSequence"."next" + 1
     RETURNING "next"`,
    key,
  );
  const n = rows[0].next;
  return `${key}-${String(n).padStart(PAD, "0")}`;
}
