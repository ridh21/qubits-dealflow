"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

export function SelectFilter({
  param,
  label,
  options,
  width = "w-[170px]",
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  width?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get(param) ?? ALL;

  function onChange(value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value === ALL) params.delete(param);
    else params.set(param, value);
    params.set("page", "1");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className={width} aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: all</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
