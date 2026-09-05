import type { Tx } from "./db";

export type SequenceKey = "Q" | "ORD" | "INV" | "CN" | "SHP";

const PAD = 5;

/**
 * Atomic number allocation. The UPDATE ... RETURNING locks the row, so two
 * concurrent callers can never receive the same number.
 */
export async function nextNumber(tx: Tx, key: SequenceKey): Promise<string> {
  const sequence = await tx.numberSequence.upsert({
    where: { key },
    create: { key, next: 1001 },
    update: { next: { increment: 1 } },
    select: { next: true },
  });
  const n = sequence.next;
  return `${key}-${String(n).padStart(PAD, "0")}`;
}
