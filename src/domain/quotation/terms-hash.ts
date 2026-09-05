import { createHash } from "node:crypto";
function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export function termsHash(terms: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(terms)))
    .digest("hex");
}
