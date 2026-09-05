"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CaretLeft, CaretRight } from "@/components/icons";

const PAGE_SIZES = ["10", "25", "50", "100"];

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

  function go(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) params.set(k, v);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-muted-foreground text-xs">
        Showing <span className="tabular font-medium">{from}</span>–
        <span className="tabular font-medium">{to}</span> of{" "}
        <span className="tabular font-medium">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => go({ pageSize: v, page: "1" })}>
          <SelectTrigger size="sm" className="w-[92px]">
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

        <Button
          variant="outline"
          size="icon"
          disabled={page <= 1}
          onClick={() => go({ page: String(page - 1) })}
          aria-label="Previous page"
        >
          <CaretLeft className="size-4" />
        </Button>
        <span className="tabular text-xs">
          {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon"
          disabled={page >= pageCount}
          onClick={() => go({ page: String(page + 1) })}
          aria-label="Next page"
        >
          <CaretRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
