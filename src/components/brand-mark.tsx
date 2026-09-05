import Image from "next/image";
import { cn } from "@/lib/utils";

/** The shared DealFlow360 handshake-and-growth mark. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/dealflow-mark.png"
      width={64}
      height={64}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("size-8 shrink-0 object-contain", className)}
    />
  );
}
