"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Pagination as PaginationRoot,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZES = ["10", "25", "50", "100"];

/**
 * Page numbers around the current one, with gaps collapsed. Always the same
 * width so the control does not shift as you move through pages.
 */
function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7)
    return Array.from({ length: pageCount }, (_, i) => i + 1);

  const around = [page - 1, page, page + 1].filter(
    (n) => n > 1 && n < pageCount,
  );
  const out: (number | "gap")[] = [1];
  if (around[0] !== undefined && around[0] > 2) out.push("gap");
  out.push(...around);
  const last = around.at(-1);
  if (last !== undefined && last < pageCount - 1) out.push("gap");
  out.push(pageCount);
  return out;
}

export function Pagination({
  total,
  page,
  pageSize,
  pageCount,
}: {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function hrefFor(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) params.set(k, v);
    return `${pathname}?${params.toString()}`;
  }

  function go(next: Record<string, string>) {
    router.replace(hrefFor(next), { scroll: false });
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const onFirst = page <= 1;
  const onLast = page >= pageCount;

  // Intercept so paging is a client transition, but keep real hrefs so pages
  // stay middle-clickable and readable by assistive tech.
  const navigate = (target: number) => (event: React.MouseEvent) => {
    event.preventDefault();
    go({ page: String(target) });
  };

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col-reverse items-center justify-between gap-3 sm:flex-row"
    >
      <p className="text-muted-foreground text-xs">
        {total === 0 ? (
          "No results"
        ) : (
          <>
            <span className="text-foreground tabular font-medium">{from}</span>
            {"–"}
            <span className="text-foreground tabular font-medium">{to}</span>
            {" of "}
            <span className="text-foreground tabular font-medium">{total}</span>
          </>
        )}
      </p>

      <div className="flex items-center gap-3">
        <Select
          value={String(pageSize)}
          onValueChange={(v) => go({ pageSize: v, page: "1" })}
        >
          <SelectTrigger size="sm" className="w-[110px]" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => (
              <SelectItem key={s} value={s}>
                {s} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <PaginationRoot className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={onFirst ? undefined : hrefFor({ page: String(page - 1) })}
                aria-disabled={onFirst}
                className={
                  onFirst ? "pointer-events-none opacity-50" : undefined
                }
                onClick={onFirst ? undefined : navigate(page - 1)}
              />
            </PaginationItem>

            {pageWindow(page, pageCount).map((slot, i) =>
              slot === "gap" ? (
                <PaginationItem key={`gap-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={slot} className="hidden sm:block">
                  <PaginationLink
                    href={hrefFor({ page: String(slot) })}
                    isActive={slot === page}
                    onClick={navigate(slot)}
                  >
                    {slot}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}

            <PaginationItem className="sm:hidden">
              <span className="text-muted-foreground tabular px-2 text-xs">
                {page} / {pageCount}
              </span>
            </PaginationItem>

            <PaginationItem>
              <PaginationNext
                href={onLast ? undefined : hrefFor({ page: String(page + 1) })}
                aria-disabled={onLast}
                className={onLast ? "pointer-events-none opacity-50" : undefined}
                onClick={onLast ? undefined : navigate(page + 1)}
              />
            </PaginationItem>
          </PaginationContent>
        </PaginationRoot>
      </div>
    </nav>
  );
}
