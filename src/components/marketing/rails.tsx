import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The page's structural motif: two continuous vertical hairlines at the content
 * edge, running the full height of the page, crossed by full-bleed horizontal
 * rules between sections.
 *
 * The rails are one absolutely-positioned element spanning the whole page
 * rather than a border on each section. Per-section borders look continuous
 * until a section changes background or padding, and then the seams show; a
 * single element cannot drift.
 */

/** Matches the 72rem of the `lining` utility in globals.css. */
const RAIL_WIDTH = "max-w-6xl";

export function PageRails({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex-1">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-1/2 z-10 w-full -translate-x-1/2",
          "border-border/70 border-x",
          RAIL_WIDTH,
        )}
      />
      {children}
    </div>
  );
}

/**
 * One band of the page. The horizontal rule is full-bleed so it reads as the
 * page being ruled, with the rails laid over the top.
 */
export function Section({
  id,
  children,
  className,
  innerClassName,
  ruled = true,
  crosses = true,
}: {
  /** Anchor target for the in-page nav. */
  id?: string;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  /** Draw the closing horizontal rule. */
  ruled?: boolean;
  /** Mark where that rule meets the rails. */
  crosses?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        ruled && "border-border/70 border-b",
        // The nav is sticky, so anchored sections need headroom.
        id && "scroll-mt-16",
        className,
      )}
    >
      <div
        className={cn(
          "relative mx-auto px-6 sm:px-10",
          RAIL_WIDTH,
          innerClassName,
        )}
      >
        {children}
        {ruled && crosses && (
          <>
            <RailCross className="start-0 bottom-0" />
            <RailCross className="end-0 bottom-0" />
          </>
        )}
      </div>
    </section>
  );
}

/** A small plus where a rule crosses a rail — the detail that makes the grid deliberate. */
function RailCross({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-20 grid size-[9px] place-items-center",
        "translate-x-[calc(var(--cross-shift)*-1)] translate-y-1/2",
        "[--cross-shift:4px] rtl:translate-x-[var(--cross-shift)]",
        className,
      )}
    >
      <span className="bg-border absolute h-px w-full" />
      <span className="bg-border absolute h-full w-px" />
    </span>
  );
}

/** Eyebrow label used above every section heading, for one consistent rhythm. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-primary-700 text-[11px] font-medium tracking-[0.16em] uppercase">
      {children}
    </p>
  );
}
