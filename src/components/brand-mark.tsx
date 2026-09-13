import { cn } from "@/lib/utils";

/** The shared DealFlow360 handshake-and-growth mark. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("brand-mark size-8 shrink-0", className)}
    />
  );
}
