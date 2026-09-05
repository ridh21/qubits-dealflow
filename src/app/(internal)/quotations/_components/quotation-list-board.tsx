import Link from "next/link";
import { quotationPipeline } from "@/domain/quotation/list-params";
import { formatMinor } from "@/domain/money/money";
import { Badge } from "@/components/ui/badge";
import type { listQuotations } from "@/server/queries/quotations";

type Row = Awaited<ReturnType<typeof listQuotations>>["rows"][number];
export function QuotationListBoard({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Columns show this page’s results in the selected sort order. Use
        pagination to see more. Change quotation status from its detail actions.
      </p>
      {!rows.length && (
        <p className="rounded-xl border p-6 text-sm">
          No quotations match. Adjust or clear the filters.
        </p>
      )}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {quotationPipeline.map((column) => {
          const cards = rows.filter((q) => column.statuses.includes(q.status));
          if (column.label === "Closed" && !cards.length) return null;
          return (
            <section
              key={column.label}
              className="min-w-64 flex-1 rounded-xl bg-muted p-4"
              aria-label={column.label}
            >
              <h2 className="mb-4 flex items-center justify-between gap-2 text-sm font-semibold">
                {column.label}
                <span className="text-xs font-normal text-muted-foreground">
                  {cards.length} on page
                </span>
              </h2>
              <div className="space-y-3">
                {!cards.length && (
                  <p className="text-xs text-muted-foreground">
                    None on this page
                  </p>
                )}
                {cards.map((q) => (
                  <Link
                    key={q.id}
                    draggable={false}
                    href={`/quotations/${q.id}`}
                    className="block space-y-2 rounded-lg border bg-card p-4 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <p className="font-medium">
                      {q.number} · v{q.version}
                    </p>
                    <p className="text-sm">{q.customer?.name ?? "No customer"}</p>
                    <p className="text-xs text-muted-foreground">
                      {q.owner.name} · {q.riskBand.toLowerCase()} risk
                    </p>
                    <Badge variant="outline">
                      {q.status.replaceAll("_", " ")}
                    </Badge>
                    <p className="text-sm">
                      {formatMinor(q.totalMinor, q.currency)} initial total
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMinor(q.oneTimeNetMinor, q.currency)} one-time net
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
