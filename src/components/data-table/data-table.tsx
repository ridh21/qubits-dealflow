import Link from "next/link";
import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { SortHeader } from "./sort-header";
import { Pagination } from "./pagination";

export interface Column<Row> {
  /** Column id; when `sortable` is set this is also the `sort` search param. */
  key: string;
  header: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  cell: (row: Row) => ReactNode;
}

export interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  getRowKey: (row: Row) => string;
  getRowHref?: (row: Row) => string;
  /** Accessible name for the table, announced before the rows. */
  caption?: string;
  empty?: { title: string; description?: string; action?: ReactNode; icon?: ReactNode };
}

const alignment = {
  right: "text-right tabular",
  center: "text-center",
  left: "",
} as const;

/**
 * Server-driven table: the page does the querying, this renders it. Sorting and
 * paging live in the URL so a list view is always shareable and refresh-safe.
 */
export function DataTable<Row>({
  columns,
  rows,
  total,
  page,
  pageSize,
  pageCount,
  getRowKey,
  getRowHref,
  caption,
  empty,
}: DataTableProps<Row>) {
  if (rows.length === 0) {
    return (
      <div className="bg-card rounded-xl border">
        <EmptyState
          title={empty?.title ?? "Nothing here yet"}
          description={empty?.description}
          action={empty?.action}
          icon={empty?.icon}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-card overflow-hidden rounded-xl border">
        {/* max-h keeps the sticky header useful on long pages; the Table's own
            card is stripped because this wrapper already provides it. */}
        <div className="max-h-[70vh] overflow-auto">
          <Table containerClassName="rounded-none border-0 overflow-visible">
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((c) => (
                  <TableHead
                    key={c.key}
                    className={cn(alignment[c.align ?? "left"], c.className)}
                  >
                    {c.sortable ? (
                      <SortHeader column={c.key} label={c.header} />
                    ) : (
                      c.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const href = getRowHref?.(row);
                return (
                  <TableRow
                    key={getRowKey(row)}
                    className={cn(
                      // `relative` anchors the stretched link below.
                      href && "focus-within:bg-muted/40 relative cursor-pointer",
                    )}
                  >
                    {columns.map((c, i) => (
                      <TableCell
                        key={c.key}
                        className={cn(
                          "text-sm",
                          alignment[c.align ?? "left"],
                          c.className,
                        )}
                      >
                        {href && i === 0 ? (
                          // One stretched link makes the whole row clickable
                          // while keeping a single, real tab stop per row.
                          <Link
                            href={href}
                            className="font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-none"
                          >
                            {c.cell(row)}
                          </Link>
                        ) : (
                          c.cell(row)
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <Pagination total={total} page={page} pageSize={pageSize} pageCount={pageCount} />
    </div>
  );
}
