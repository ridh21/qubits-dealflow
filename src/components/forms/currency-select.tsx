"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_CURRENCIES } from "@/domain/money/money";

/** Currency is a fixed set, so it is a Select rather than a free-text code. */
export function CurrencySelect({
  value,
  onChange,
  id,
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  id?: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className={className ?? "w-full"}>
        <SelectValue placeholder="Select currency" />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            <span className="font-medium">{c.code}</span>
            <span className="text-muted-foreground ml-2">{c.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
