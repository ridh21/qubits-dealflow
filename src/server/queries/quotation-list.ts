import type { Prisma } from "@prisma/client";
import type { QuotationListParams } from "@/domain/quotation/list-params";

/** Access scope is a separate AND operand: URL filters can only narrow it. */
export function quotationListWhere(
  scope: Prisma.QuotationWhereInput,
  p: QuotationListParams,
): Prisma.QuotationWhereInput {
  const proposals: Prisma.NegotiationMessageWhereInput = {
    author: "CUSTOMER",
    status: "OPEN",
  };
  return {
    AND: [
      scope,
      {
        // Invalid narrowing filters must never silently turn into an unfiltered list.
        ...(p.issues.length ? { id: { in: [] } } : {}),
        ...(p.q
          ? {
              OR: [
                { number: { contains: p.q, mode: "insensitive" } },
                { customer: { name: { contains: p.q, mode: "insensitive" } } },
              ],
            }
          : {}),
        ...(p.status.length ? { status: { in: p.status } } : {}),
        ...(p.ownerId ? { ownerId: p.ownerId } : {}),
        ...(p.teamId ? { owner: { teamId: p.teamId } } : {}),
        ...(p.customerId ? { customerId: p.customerId } : {}),
        ...(p.riskBand ? { riskBand: p.riskBand } : {}),
        ...(p.minAmount !== undefined || p.maxAmount !== undefined
          ? { totalMinor: { gte: p.minAmount, lte: p.maxAmount } }
          : {}),
        ...(p.createdFrom || p.createdTo
          ? {
              createdAt: {
                // Date filters are interpreted on the IST wall clock (the
                // platform's display timezone); IST is fixed at +05:30.
                ...(p.createdFrom
                  ? { gte: new Date(`${p.createdFrom}T00:00:00+05:30`) }
                  : {}),
                ...(p.createdTo
                  ? {
                      lt: new Date(
                        new Date(`${p.createdTo}T00:00:00+05:30`).getTime() +
                          86400000,
                      ),
                    }
                  : {}),
              },
            }
          : {}),
        ...(p.hasOpenProposals === "true"
          ? { messages: { some: proposals } }
          : p.hasOpenProposals === "false"
            ? { messages: { none: proposals } }
            : {}),
      },
    ],
  };
}
export function quotationListOrder(
  p: QuotationListParams,
): Prisma.QuotationOrderByWithRelationInput[] {
  const primary =
    p.sort === "customer"
      ? { customer: { name: p.dir } }
      : p.sort === "owner"
        ? { owner: { name: p.dir } }
        : { [p.sort]: p.dir };
  // Unique tie-breaker prevents page drift when timestamps/totals are equal.
  return [primary, { id: "asc" }];
}
