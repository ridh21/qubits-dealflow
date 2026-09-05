import { Prisma } from "@prisma/client";
import type { Tx } from "@/server/db";
import { NotFound } from "@/domain/errors";
import { priceQuotation } from "@/domain/pricing/price-quotation";
import { getActivePolicy } from "./policy.service";
export async function repriceQuotation(tx: Tx, id: string) {
  const q = await tx.quotation.findUnique({
    where: { id },
    include: { lines: true, customer: true },
  });
  if (!q) throw new NotFound("Quotation no longer exists.");
  const policy = await getActivePolicy(tx, "DISCOUNT_RISK");
  const result = priceQuotation({
    lines: q.lines,
    orderDiscountBp: q.orderDiscountBp,
    tierCeilingBp: policy.payload.tierCeilingsBp[q.customer.tier],
    categoryCeilingsBp: policy.payload.categoryCeilingsBp,
  });
  for (const line of result.lines) {
    const {
      baseMinor,
      lineDiscountMinor,
      orderDiscountAllocMinor,
      netMinor,
      taxMinor,
      effectiveDiscountBp,
      limitBp,
      excessBp,
      marginMinor,
    } = line;
    await tx.quotationLine.update({
      where: { id: line.id },
      data: {
        baseMinor,
        lineDiscountMinor,
        orderDiscountAllocMinor,
        netMinor,
        taxMinor,
        effectiveDiscountBp,
        limitBp,
        excessBp,
        marginMinor,
      },
    });
  }
  await tx.quotation.update({
    where: { id },
    data: {
      subtotalMinor: result.subtotalMinor,
      discountMinor: result.discountMinor,
      taxMinor: result.taxMinor,
      totalMinor: result.totalMinor,
      oneTimeNetMinor: result.oneTime.netMinor,
      oneTimeMarginMinor: result.oneTime.marginMinor,
      recurringByCycle: result.recurringByCycle as Prisma.InputJsonValue,
      policyVersionId: policy.id,
      lastActivityAt: new Date(),
    },
  });
  return result;
}
