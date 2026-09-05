import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

/** The mark, shared by the landing page, the auth pages and the footer. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="DealFlow360 home"
      className={cn("flex items-center gap-2", className)}
    >
      <BrandMark className="size-8" />
      <span className="font-display text-[15px] font-semibold tracking-tight">
        DealFlow360
      </span>
    </Link>
  );
}
