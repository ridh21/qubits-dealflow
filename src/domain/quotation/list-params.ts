import { z } from "zod";

export const quotationStatuses = [
  "DRAFT",
  "PENDING_APPROVAL",
  "REVISION_REQUESTED",
  "APPROVED",
  "SENT",
  "UNDER_NEGOTIATION",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
] as const;
export const quotationSorts = [
  "updatedAt",
  "createdAt",
  "number",
  "totalMinor",
  "oneTimeNetMinor",
  "status",
  "riskBand",
  "customer",
  "owner",
] as const;
type Params = Record<string, string | string[] | undefined>;
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Use a valid calendar date");
const amount = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/)
  .transform((v) => {
    const [whole, fraction = ""] = v.split(".");
    return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  })
  .pipe(z.number().int().min(0).max(2147483647));
const fields = {
  q: z.string().trim().max(200).optional(),
  status: z.array(z.enum(quotationStatuses)).default([]),
  ownerId: z.string().trim().min(1).max(200).optional(),
  teamId: z.string().trim().min(1).max(200).optional(),
  customerId: z.string().trim().min(1).max(200).optional(),
  riskBand: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  minAmount: amount.optional(),
  maxAmount: amount.optional(),
  createdFrom: date.optional(),
  createdTo: date.optional(),
  hasOpenProposals: z.enum(["true", "false"]).optional(),
};
const filters = z.object(fields);
export function parseQuotationListParams(sp: Params) {
  const normalized: Params = {
    ...sp,
    status: [
      ...new Set(
        [sp.status ?? []]
          .flat()
          .flatMap((v) => v.split(","))
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ],
  };
  const values: Record<string, unknown> = {};
  const issues: string[] = [];
  for (const [key, schema] of Object.entries(fields)) {
    const raw = normalized[key] === "" ? undefined : normalized[key];
    const result = schema.safeParse(raw);
    if (result.success) values[key] = raw;
    else issues.push(`Invalid ${key}.`);
  }
  const f = filters.parse(values);
  if (
    f.minAmount !== undefined &&
    f.maxAmount !== undefined &&
    f.minAmount > f.maxAmount
  )
    issues.push("Minimum amount must not exceed maximum amount.");
  if (f.createdFrom && f.createdTo && f.createdFrom > f.createdTo)
    issues.push("Created from must not follow created to.");
  return {
    ...f,
    issues,
    page: z.coerce
      .number()
      .int()
      .min(1)
      .max(2147483647)
      .catch(1)
      .parse(sp.page ?? 1),
    pageSize: z.coerce
      .number()
      .int()
      .min(10)
      .max(100)
      .catch(25)
      .parse(sp.pageSize ?? 25),
    sort: z.enum(quotationSorts).catch("updatedAt").parse(sp.sort),
    dir: z.enum(["asc", "desc"]).catch("desc").parse(sp.dir),
    view: z.enum(["table", "board"]).catch("table").parse(sp.view),
  };
}
export type QuotationListParams = ReturnType<typeof parseQuotationListParams>;

/** Preserve repeated filters across view changes and other URL transitions. */
export function quotationListHref(sp: Params, changes: Params = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...sp, ...changes })) {
    for (const item of [value ?? []].flat())
      if (item !== "") params.append(key, item);
  }
  return `/quotations?${params.toString()}`;
}

export const quotationPipeline = [
  { label: "Draft", statuses: ["DRAFT"] },
  { label: "Pending Approval", statuses: ["PENDING_APPROVAL"] },
  { label: "Revision Requested", statuses: ["REVISION_REQUESTED"] },
  { label: "Approved", statuses: ["APPROVED"] },
  { label: "Sent / Negotiation", statuses: ["SENT", "UNDER_NEGOTIATION"] },
  { label: "Confirmed", statuses: ["CONFIRMED"] },
  { label: "Closed", statuses: ["REJECTED", "CANCELLED", "EXPIRED"] },
];
