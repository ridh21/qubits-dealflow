import { z } from "zod";
const optionalId = z.string().trim().max(200).optional();
export const ReportFilters = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    teamId: optionalId,
    ownerId: optionalId,
    approvalStatus: z
      .enum(["NONE_REQUIRED", "PENDING", "APPROVED", "REJECTED", "ALL"])
      .default("ALL"),
    productId: optionalId,
    categoryId: optionalId,
    customerId: optionalId,
    tier: z.enum(["BRONZE", "SILVER", "GOLD"]).optional(),
    cycle: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]).optional(),
  })
  .superRefine((value, context) => {
    if (value.from > value.to)
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "End date must be on or after start date.",
      });
  });
export type ReportFilterValues = z.infer<typeof ReportFilters>;
export function parseReportFilters(raw: unknown) {
  if (!raw || typeof raw !== "object") return ReportFilters.parse(raw);
  return ReportFilters.parse(
    Object.fromEntries(
      Object.entries(raw).filter(
        ([, value]) => value !== "" && value !== undefined,
      ),
    ),
  );
}
export function reportPeriod(filters: ReportFilterValues) {
  const from = new Date(`${filters.from}T00:00:00Z`);
  const to = new Date(`${filters.to}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + 1);
  return { from, to };
}
