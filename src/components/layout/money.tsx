import { DEFAULT_CURRENCY, formatBp, formatMinor } from "@/domain/money/money";
import { cn } from "@/lib/utils";

export function Money({
  minor,
  currency = DEFAULT_CURRENCY,
  className,
}: {
  minor: number;
  currency?: string;
  className?: string;
}) {
  return (
    <span className={cn("tabular", className)}>{formatMinor(minor, currency)}</span>
  );
}

export function Percent({ bp, className }: { bp: number; className?: string }) {
  return <span className={cn("tabular", className)}>{formatBp(bp)}</span>;
}
