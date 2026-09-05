"use client";

import { Input } from "@/components/ui/input";

export function PercentInput({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (basisPoints: number) => void;
}) {
  return (
    <Input
      {...props}
      type="number"
      inputMode="decimal"
      min={0}
      max={100}
      step={0.01}
      value={value / 100}
      onChange={(event) => {
        const percent = Number(event.target.value);
        if (Number.isFinite(percent)) onChange(Math.round(percent * 100));
      }}
    />
  );
}
