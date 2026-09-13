import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared widths and section rhythm, matched to the Tracwell reference. */
export function PageRails({ children }: { children: ReactNode }) {
  return <div className="landing relative flex-1">{children}</div>;
}

export function Section({ id, children, className, innerClassName }: {
  id?: string; children: ReactNode; className?: string; innerClassName?: string;
  ruled?: boolean; crosses?: boolean;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)}>
      <div className={cn("landing-container", innerClassName)}>{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-xs font-medium">{children}</p>;
}
