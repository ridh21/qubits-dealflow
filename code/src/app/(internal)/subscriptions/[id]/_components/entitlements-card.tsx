import type { Prisma } from "@prisma/client";
import { Section } from "@/components/layout/page-header";
import { dateLabel } from "../../_components/format";
function entries(snapshot: Prisma.JsonValue | object | null) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot))
    return [];
  return Object.entries(snapshot).map(([key, raw]) => {
    const cell: Record<string, unknown> =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : { value: raw };
    const value = cell.value;
    return {
      key,
      label: String(cell.label ?? key),
      value:
        value === true
          ? "Yes"
          : value === false
            ? "No"
            : value == null
              ? "Not set"
              : typeof value === "object"
                ? JSON.stringify(value)
                : String(value),
      unit: cell.unit ? String(cell.unit) : "",
      per: cell.per ? String(cell.per).toLowerCase() : "",
    };
  });
}
export function EntitlementsCard({
  current,
  next,
  boundary,
  paused,
}: {
  current: Prisma.JsonValue | null;
  next: object;
  boundary: Date | null;
  paused: boolean;
}) {
  const present = entries(current),
    future = entries(next);
  const changed = JSON.stringify(present) !== JSON.stringify(future);
  return (
    <Section
      title="Entitlements"
      description={
        paused
          ? "Access is paused. The last billed snapshot is retained below."
          : "Current-period values stay fixed until the next billed period."
      }
    >
      <div className="rounded-xl border bg-card p-5">
        <dl className="divide-y">
          {present.map((item) => (
            <div key={item.key} className="flex justify-between gap-4 py-3">
              <dt className="text-sm text-muted-foreground">{item.label}</dt>
              <dd className="text-sm font-medium">
                {item.value} {item.unit}
                {item.per ? ` / ${item.per}` : ""}
              </dd>
            </div>
          ))}
        </dl>
        {!present.length && (
          <p className="text-sm text-muted-foreground">
            No entitlements have been captured for a billed period.
          </p>
        )}
        {changed && future.length > 0 && (
          <div className="mt-4 rounded-lg bg-muted p-4">
            <p className="mb-2 text-sm font-medium">
              From {boundary ? dateLabel(boundary) : "the next billed period"}
            </p>
            {future.map((item) => (
              <p className="text-sm text-muted-foreground" key={item.key}>
                {item.label}: {item.value} {item.unit}
                {item.per ? ` / ${item.per}` : ""}
              </p>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
