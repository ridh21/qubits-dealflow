"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowsDownUp, CaretDown } from "@/components/icons";
import { cn } from "@/lib/utils";

export function SortHeader({ column, label }: { column: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const activeSort = sp.get("sort");
  const dir = sp.get("dir") === "asc" ? "asc" : "desc";
  const active = activeSort === column;

  function toggle() {
    const next = new URLSearchParams(sp.toString());
    next.set("sort", column);
    next.set("dir", active && dir === "desc" ? "asc" : "desc");
    next.set("page", "1");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "hover:text-foreground -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
      {active ? (
        <CaretDown className={cn("size-3 transition-transform", dir === "asc" && "rotate-180")} />
      ) : (
        <ArrowsDownUp className="size-3 opacity-50" />
      )}
    </button>
  );
}
