import { z } from "zod";

export const BpZ = z
  .number().int("Enter a whole percentage.")
  .min(0, "Percentage cannot be negative.")
  .max(10000, "Percentage cannot exceed 100%.");
const positive = z
  .number().int("Enter a whole percentage.")
  .min(1, "Percentage must be at least 0.01%.")
  .max(10000, "Percentage cannot exceed 100%.");
export const ApprovalRoleZ = z.enum(["SALES_MANAGER", "FINANCE"]);
export const PolicyKindZ = z.enum([
  "DISCOUNT_RISK",
  "FULFILLMENT",
  "BILLING",
  "DEAL_HEALTH",
  "PORTAL",
  "RECOMMENDATION",
]);
export type PolicyKind = z.infer<typeof PolicyKindZ>;
export const RoutingRuleZ = z.strictObject({
  level: positive,
  label: z.string().trim().min(1).max(200),
  anyLineExcess: z.boolean().default(false),
  worstExcessGteBp: BpZ.nullable(),
  blendedExcessGteBp: BpZ.nullable(),
  overallExcessGteBp: BpZ.nullable(),
});
export const DiscountRiskPolicyZ = z.strictObject({
  tierCeilingsBp: z.record(z.enum(["BRONZE", "SILVER", "GOLD"]), BpZ),
  categoryCeilingsBp: z.record(z.string().min(1), BpZ),
  overallCeilingBp: BpZ.nullable(),
  reviewerChain: z.array(ApprovalRoleZ).min(1).max(2),
  routingRules: z.array(RoutingRuleZ).min(1).max(2),
  slaHoursByRole: z.record(ApprovalRoleZ, positive),
  evaluateRecurringInCycleBuckets: z.boolean().default(true),
  rejectZeroPriceLines: z.boolean().default(true),
  blockOwnQuoteApproval: z.boolean().default(true),
});
export const FulfillmentPolicyZ = z.strictObject({
  shipmentCountPenaltyMinor: z
    .number()
    .int()
    .min(0)
    .max(2147483647)
    .default(1500),
  maxWarehousesPerOrder: positive.default(3),
  tieBreak: z.enum(["PRIORITY", "CODE"]).default("PRIORITY"),
  allowPreviewBeforeConfirmation: z.boolean().default(true),
});
export const BillingPolicyZ = z.strictObject({
  invoiceDueDays: z.number().int().min(0).max(365).default(14),
  defaultProration: z.enum(["DAILY", "NONE"]).default("DAILY"),
  defaultCancellation: z
    .enum(["NONE", "PRORATED_CREDIT", "FULL_CREDIT"])
    .default("PRORATED_CREDIT"),
  allowImmediateCancellation: z.boolean().default(true),
  autoApplyCredits: z.boolean().default(true),
  scheduleHorizonPeriods: positive.max(120).default(12),
});
export const DealHealthPolicyZ = z.strictObject({
  stalledDays: positive.default(7),
  anomalyMinDeltaBp: BpZ.default(1000),
  anomalyMinSamples: positive.default(5),
  anomalyLookbackDays: positive.default(90),
  slippageWindowDays: positive.default(3),
  approvalSlaAlerts: z.boolean().default(true),
});
export const PortalPolicyZ = z.strictObject({
  quoteValidityDays: positive.default(30),
  autoApplyCustomerProposals: z.boolean().default(false),
  allowCustomerPauseResume: z.boolean().default(true),
  magicLinkMinutes: positive.max(1440).default(15),
});
export const RecommendationRuleZ = z.strictObject({
  productId: z.string().min(1),
  suggestedProductId: z.string().min(1),
  weight: positive,
  source: z.enum(["MANUAL", "COPURCHASE"]).default("MANUAL"),
});
export const RecommendationPolicyZ = z
  .strictObject({
    maxSuggestions: positive.max(50).default(5),
    promotedBoost: z.number().min(0).max(100).default(2),
    promotions: z.record(z.string().min(1), BpZ).default({}),
    enforceMinMargin: z.boolean().default(true),
    rules: z.array(RecommendationRuleZ).max(10000).default([]),
  })
  .superRefine((p, ctx) => {
    const seen = new Set<string>();
    p.rules.forEach((r, i) => {
      const key = `${r.productId}:${r.suggestedProductId}`;
      if (r.productId === r.suggestedProductId || seen.has(key))
        ctx.addIssue({
          code: "custom",
          path: ["rules", i],
          message: "Choose distinct products and keep each pair unique.",
        });
      seen.add(key);
    });
  });
export const POLICY_SCHEMAS = {
  DISCOUNT_RISK: DiscountRiskPolicyZ,
  FULFILLMENT: FulfillmentPolicyZ,
  BILLING: BillingPolicyZ,
  DEAL_HEALTH: DealHealthPolicyZ,
  PORTAL: PortalPolicyZ,
  RECOMMENDATION: RecommendationPolicyZ,
} as const;
export type PolicyPayload<K extends PolicyKind> = z.infer<
  (typeof POLICY_SCHEMAS)[K]
>;
export const DEFAULT_DISCOUNT_RISK: PolicyPayload<"DISCOUNT_RISK"> = {
  tierCeilingsBp: { BRONZE: 500, SILVER: 1000, GOLD: 1500 },
  categoryCeilingsBp: {},
  overallCeilingBp: null,
  reviewerChain: ["SALES_MANAGER", "FINANCE"],
  routingRules: [
    {
      level: 1,
      label: "Any line or overall ceiling breach",
      anyLineExcess: true,
      worstExcessGteBp: null,
      blendedExcessGteBp: null,
      overallExcessGteBp: 1,
    },
    {
      level: 2,
      label: "High risk",
      anyLineExcess: false,
      worstExcessGteBp: 800,
      blendedExcessGteBp: 500,
      overallExcessGteBp: 500,
    },
  ],
  slaHoursByRole: { SALES_MANAGER: 24, FINANCE: 48 },
  evaluateRecurringInCycleBuckets: true,
  rejectZeroPriceLines: true,
  blockOwnQuoteApproval: true,
};
export const POLICY_DEFAULTS = {
  DISCOUNT_RISK: DEFAULT_DISCOUNT_RISK,
  FULFILLMENT: FulfillmentPolicyZ.parse({}),
  BILLING: BillingPolicyZ.parse({}),
  DEAL_HEALTH: DealHealthPolicyZ.parse({}),
  PORTAL: PortalPolicyZ.parse({}),
  RECOMMENDATION: RecommendationPolicyZ.parse({}),
};
export const POLICY_META: Record<
  PolicyKind,
  { title: string; slug: string; description: string }
> = {
  DISCOUNT_RISK: {
    title: "Discount & risk",
    slug: "discount-risk",
    description: "Ceilings, routing thresholds and sequential reviewers.",
  },
  FULFILLMENT: {
    title: "Fulfillment",
    slug: "fulfillment",
    description: "Shipment costs, warehouse limits and allocation preferences.",
  },
  BILLING: {
    title: "Billing",
    slug: "billing",
    description: "Due dates, credits, cancellation and proration defaults.",
  },
  DEAL_HEALTH: {
    title: "Deal health",
    slug: "deal-health",
    description: "Stalled deals, anomalies, delivery and approval alerts.",
  },
  PORTAL: {
    title: "Customer portal",
    slug: "portal",
    description:
      "Quote validity, proposals and customer subscription controls.",
  },
  RECOMMENDATION: {
    title: "Recommendations",
    slug: "recommendations",
    description: "Product relationships, promotions and margin protection.",
  },
};
export function canPublishPolicy(role: string, kind: PolicyKind) {
  return (
    role === "ADMIN" || (role === "SALES_MANAGER" && kind === "DISCOUNT_RISK")
  );
}
