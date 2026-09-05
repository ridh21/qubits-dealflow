"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { MagnifyingGlass } from "@/components/icons";

export function SearchInput({ placeholder = "Search…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [value, setValue] = useState(sp.get("q") ?? "");
  const [, startTransition] = useTransition();

  useEffect(() => {
    const current = sp.get("q") ?? "";
    if (current === value) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      params.set("page", "1");
      startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full sm:w-64">
      <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}
