import { z } from "zod";
import { csvArray } from "./list";

export const RoleEnum = z.enum(["PENDING", "ADMIN", "SALES_REP", "SALES_MANAGER", "FINANCE", "CUSTOMER"]);
export const TierEnum = z.enum(["BRONZE", "SILVER", "GOLD"]);
export const ProductTypeEnum = z.enum(["PHYSICAL", "SERVICE", "SUBSCRIPTION"]);
export const ProductStatusEnum = z.enum(["ACTIVE", "ARCHIVED"]);
export const PriceRuleEnum = z.enum(["NO_ADJUSTMENT", "PERCENT_OFF_BASE", "FIXED_ITEMS"]);

// ── Filters (list pages) ──
export const UserFilters = z.object({
  role: RoleEnum.optional(),
  teamId: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const CustomerFilters = z.object({
  tier: TierEnum.optional(),
  priceListId: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const ProductFilters = z.object({
  categoryId: z.string().optional(),
  type: ProductTypeEnum.optional(),
  status: ProductStatusEnum.optional(),
});

export const StockFilters = z.object({
  below: z.enum(["reorder"]).optional(),
  productId: z.string().optional(),
});

export const MovementFilters = z.object({
  type: z.enum(["RECEIPT", "RESERVE", "RELEASE", "SHIP", "ADJUST"]).optional(),
  productId: z.string().optional(),
});

export const EmailFilters = z.object({
  status: z.enum(["QUEUED", "SENT", "FAILED"]).optional(),
  relatedType: z.string().optional(),
});

export const MultiStatus = csvArray(z.string());

// ── Inputs (mutations) ──
export const ApproveUserInput = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMIN", "SALES_REP", "SALES_MANAGER", "FINANCE"]),
  teamId: z.string().optional().nullable(),
});

export const UpdateUserRoleInput = ApproveUserInput;

export const TeamInput = z.object({ name: z.string().min(2, "Name the team.") });

export const CustomerInput = z.object({
  name: z.string().min(2, "Enter the company name."),
  tier: TierEnum.default("BRONZE"),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  billingAddress: z.string().optional(),
  priceListId: z.string().optional().or(z.literal("")),
});

export const InvitePortalUserInput = z.object({
  customerId: z.string().min(1),
  email: z.string().email("Enter a valid email."),
  name: z.string().min(2, "Enter their name."),
});

export const CategoryInput = z.object({
  name: z.string().min(2, "Name the category."),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const ProductInput = z.object({
  sku: z.string().min(2, "Enter a SKU.").regex(/^[A-Za-z0-9-_]+$/, "Letters, numbers, - and _ only."),
  name: z.string().min(2, "Name the product."),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Pick a category."),
  type: ProductTypeEnum.default("PHYSICAL"),
  unit: z.string().min(1).default("Each"),
  basePriceMinor: z.coerce.number().int().min(0),
  costPriceMinor: z.coerce.number().int().min(0),
  taxBp: z.coerce.number().int().min(0).max(10000).default(0),
  isPromoted: z.coerce.boolean().default(false),
  minMarginBp: z.coerce.number().int().min(0).max(10000).default(0),
});

export const VariantAttributeInput = z.object({
  name: z.string().min(1),
  sortOrder: z.coerce.number().int().min(0).default(0),
  values: z
    .array(
      z.object({
        value: z.string().min(1),
        extraPriceMinor: z.coerce.number().int().default(0),
      }),
    )
    .min(1, "Add at least one value."),
});

export const SetVariantsInput = z.object({
  productId: z.string().min(1),
  attributes: z.array(VariantAttributeInput),
});

export const PriceListInput = z.object({
  name: z.string().min(2, "Name the price list."),
  currency: z.string().length(3).default("USD"),
  tier: TierEnum.optional().or(z.literal("")),
  rule: PriceRuleEnum.default("NO_ADJUSTMENT"),
  percentOffBp: z.coerce.number().int().min(0).max(10000).default(0),
});

export const PriceListItemInput = z.object({
  priceListId: z.string().min(1),
  productId: z.string().min(1),
  priceMinor: z.coerce.number().int().min(0),
});

export const WarehouseInput = z.object({
  name: z.string().min(2, "Name the warehouse."),
  code: z.string().min(2, "Enter a short code.").regex(/^[A-Z0-9-]+$/, "Uppercase letters, numbers and - only."),
  shippingCostWeightMinor: z.coerce.number().int().min(0).default(0),
  fixedShipmentCostMinor: z.coerce.number().int().min(0).default(0),
  priority: z.coerce.number().int().min(0).default(0),
});

export const ReceiveStockInput = z.object({
  warehouseId: z.string().min(1),
  productId: z.string().min(1),
  qty: z.coerce.number().int().positive("Receive at least one unit."),
  note: z.string().optional(),
  replenishmentPlanId: z.string().optional().or(z.literal("")),
});

export const AdjustStockInput = z.object({
  warehouseId: z.string().min(1),
  productId: z.string().min(1),
  delta: z.coerce.number().int().refine((n) => n !== 0, "Enter a non-zero adjustment."),
  reason: z.string().min(3, "Give a reason for the adjustment."),
});

export const ReorderPointInput = z.object({
  warehouseId: z.string().min(1),
  productId: z.string().min(1),
  reorderPoint: z.coerce.number().int().min(0),
});

export const ReplenishmentInput = z.object({
  warehouseId: z.string().min(1),
  productId: z.string().min(1),
  qty: z.coerce.number().int().positive("Plan at least one unit."),
  eta: z.coerce.date(),
});
