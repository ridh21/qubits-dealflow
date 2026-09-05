"use client";

import { Input } from "@/components/ui/input";
import { parseMoneyToMinor } from "@/domain/money/money";

export function MoneyInput({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (minorUnits: number) => void;
}) {
  return (
    <Input
      {...props}
      type="number"
      inputMode="decimal"
      min={0}
      step={0.01}
      value={value / 100}
      onChange={(event) => onChange(parseMoneyToMinor(event.target.value))}
    />
  );
}
