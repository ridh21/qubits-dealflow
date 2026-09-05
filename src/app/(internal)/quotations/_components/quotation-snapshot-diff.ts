import { diffPolicy } from "@/domain/policy/diff";
import { formatBp, formatMinor } from "@/domain/money/money";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
const terms = [
  "customerId",
  "currency",
  "priceListId",
  "validUntil",
  "requestedDeliveryDate",
  "customerNote",
  "orderDiscountBp",
];
const totals = [
  "subtotalMinor",
  "discountMinor",
  "taxMinor",
  "totalMinor",
  "oneTimeNetMinor",
  "oneTimeMarginMinor",
];
const governance = [
  "status",
  "riskBand",
  "requiredLevel",
  "policyVersionId",
  "approvedVersion",
];
const lineFields = [
  "productId",
  "productName",
  "variantValueIds",
  "variantLabel",
  "planId",
  "interval",
  "qty",
  "unitPriceMinor",
  "costPriceMinor",
  "taxBp",
  "discountBp",
  "baseMinor",
  "lineDiscountMinor",
  "orderDiscountAllocMinor",
  "netMinor",
  "taxMinor",
  "effectiveDiscountBp",
  "limitBp",
  "excessBp",
  "marginMinor",
  "sortOrder",
  "addedFromUpsell",
];
const cycleFields = [
  "netMinor",
  "taxMinor",
  "marginMinor",
  "marginBp",
  "lines",
];
const pick = (source: RecordValue, fields: string[]) =>
  Object.fromEntries(
    fields
      .filter((field) => Object.hasOwn(source, field))
      .map((field) => [field, source[field]]),
  );

/** Select commercial snapshot fields only; portal tokens and internal payloads
 * must never appear in the diff. Line identity is independent of array position.
 */
function normalize(snapshot: unknown): RecordValue | null {
  const source = record(snapshot);
  if (!source) return null;
  const lines = Array.isArray(source.lines) ? source.lines : [];
  const normalizedLines = Object.fromEntries(
    lines.flatMap((value, index) => {
      const line = record(value);
      if (!line) return [];
      const key = encodeURIComponent(
        typeof line.id === "string" ? line.id : `unknown-line-${index}`,
      ).replaceAll(".", "%2E");
      const fields = pick(line, lineFields);
      if (Array.isArray(fields.variantValueIds))
        fields.variantValueIds = [...fields.variantValueIds].sort();
      return [[key, fields]];
    }),
  );
  const cycles = record(source.recurringByCycle) ?? {};
  return {
    terms: pick(source, terms),
    totals: pick(source, totals),
    governance: pick(source, governance),
    lines: normalizedLines,
    recurring: Object.fromEntries(
      Object.entries(cycles).flatMap(([cycle, value]) => {
        const summary = record(value);
        return summary ? [[cycle, pick(summary, cycleFields)]] : [];
      }),
    ),
  };
}

const labels: Record<string, string> = {
  customerId: "Customer",
  currency: "Currency",
  priceListId: "Price list",
  validUntil: "Valid until",
  requestedDeliveryDate: "Requested delivery",
  customerNote: "Customer note",
  orderDiscountBp: "Order discount",
  subtotalMinor: "Subtotal",
  discountMinor: "Discounts",
  taxMinor: "Tax",
  totalMinor: "Saved total",
  oneTimeNetMinor: "One-time net",
  oneTimeMarginMinor: "One-time margin",
  status: "Status",
  riskBand: "Risk band",
  requiredLevel: "Required approval level",
  policyVersionId: "Policy version",
  approvedVersion: "Approved quotation version",
  productId: "Product ID",
  productName: "Product",
  variantValueIds: "Variant IDs",
  variantLabel: "Variant",
  planId: "Plan ID",
  interval: "Billing cycle",
  qty: "Quantity",
  unitPriceMinor: "Unit price",
  costPriceMinor: "Unit cost",
  taxBp: "Tax rate",
  discountBp: "Line discount",
  baseMinor: "Base amount",
  lineDiscountMinor: "Line discount amount",
  orderDiscountAllocMinor: "Allocated order discount",
  netMinor: "Net",
  effectiveDiscountBp: "Effective discount",
  limitBp: "Discount limit",
  excessBp: "Excess discount",
  marginMinor: "Margin",
  sortOrder: "Line position",
  addedFromUpsell: "Added from upsell",
  marginBp: "Margin rate",
  lines: "Line count",
};

function display(
  value: unknown,
  field: string,
  currency: unknown,
  names: Record<string, string>,
): string {
  if (value === null || value === undefined) return "Not set";
  if (typeof value === "number" && field.endsWith("Minor")) {
    if (typeof currency === "string") {
      try {
        return `${currency} ${formatMinor(value, currency)}`;
      } catch {
        /* Historical currency may be invalid. */
      }
    }
    return `${value} minor units`;
  }
  if (typeof value === "number" && field.endsWith("Bp")) return formatBp(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value))
    return (
      value.map((item) => display(item, field, currency, names)).join(", ") ||
      "None"
    );
  const object = record(value);
  if (object)
    return Object.entries(object)
      .map(
        ([key, entry]) =>
          `${labels[key] ?? key}: ${display(entry, key, currency, names)}`,
      )
      .join("; ");
  if (
    field === "customerId" &&
    typeof value === "string" &&
    Object.hasOwn(names, value)
  )
    return `${names[value]} (${value})`;
  return String(value);
}

export function quotationSnapshotDiff(
  before: unknown,
  after: unknown,
  customerNames: Record<string, string> = {},
) {
  const left = normalize(before),
    right = normalize(after);
  if (!left || !right) return { available: false, changes: [] };
  const beforeCurrency = record(before)?.currency,
    afterCurrency = record(after)?.currency;
  const changes = diffPolicy(left, right).map((change) => {
    const [group, key, ...rest] = change.path.split(".");
    const field = rest[0] ?? key;
    const line =
      group === "lines"
        ? (record(record(right.lines)?.[key]) ??
          record(record(left.lines)?.[key]))
        : null;
    const section =
      group === "lines"
        ? `Line: ${line?.productName ?? decodeURIComponent(key)} (${decodeURIComponent(key)})`
        : group === "recurring"
          ? `Recurring: ${key.toLowerCase()} (initial period)`
          : group === "terms"
            ? "Terms"
            : group === "totals"
              ? "Saved totals"
              : "Approval and status";
    return {
      path: change.path,
      section,
      field:
        group === "lines" && !rest.length
          ? change.before === null
            ? "Added line"
            : "Removed line"
          : (labels[field] ?? field),
      before: display(change.before, field, beforeCurrency, customerNames),
      after: display(change.after, field, afterCurrency, customerNames),
    };
  });
  return { available: true, changes };
}
