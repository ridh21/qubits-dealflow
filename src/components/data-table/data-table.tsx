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
  empty?: { title: string; description?: string; action?: ReactNode; icon?: ReactNode };
}

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
  empty,
}: DataTableProps<Row>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border">
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
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(
                    "h-10 text-xs font-medium",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    c.className,
                  )}
                >
                  {c.sortable ? <SortHeader column={c.key} label={c.header} /> : c.header}
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
                  className={cn("h-11", href && "hover:bg-muted/40 cursor-pointer")}
                >
                  {columns.map((c, i) => (
                    <TableCell
                      key={c.key}
                      className={cn(
                        "py-2 text-sm",
                        c.align === "right" && "text-right",
                        c.align === "center" && "text-center",
                        c.className,
                      )}
                    >
                      {href && i === 0 ? (
                        <a href={href} className="block font-medium hover:underline">
                          {c.cell(row)}
                        </a>
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

      <Pagination total={total} page={page} pageSize={pageSize} pageCount={pageCount} />
    </div>
  );
}
