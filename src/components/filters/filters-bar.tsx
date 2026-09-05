"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X } from "@/components/icons";

const KEEP = new Set(["pageSize", "sort", "dir"]);

export function FiltersBar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const applied = [...sp.keys()].filter((k) => !KEEP.has(k) && k !== "page" && sp.get(k));

  function clearAll() {
    const params = new URLSearchParams();
    for (const k of KEEP) {
      const v = sp.get(k);
      if (v) params.set(k, v);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      {applied.length > 0 ? (
        <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
          <X className="size-3.5" /> Clear filters
        </Button>
      ) : null}
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
