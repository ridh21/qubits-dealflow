import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The nested panel: a tinted outer frame carrying the label, wrapping a white
 * inner card that holds the substance. Used by the feature and pricing
 * sections so both read as the same family rather than two separate designs.
 */
export function Panel({
  label,
  description,
  badge,
  children,
  featured = false,
  className,
}: {
  label: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
  /** The emphasised card in a set — inverts to the brand colour. */
  featured?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl p-2 transition-colors",
        featured
          ? "bg-primary shadow-primary/25 shadow-lg"
          : "bg-muted/70 border-border/70 border",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 px-3.5 pt-3 pb-4">
        <div className="min-w-0">
          <p
            className={cn(
              "font-display text-base font-semibold",
              featured ? "text-primary-foreground" : "text-foreground",
            )}
          >
            {label}
          </p>
          {description && (
            <p
              className={cn(
                "mt-1 text-[13px] leading-relaxed",
                featured ? "text-primary-foreground/80" : "text-muted-foreground",
              )}
            >
              {description}
            </p>
          )}
        </div>
        {badge}
      </div>

      <div className="bg-card border-border/70 flex flex-1 flex-col rounded-xl border p-4 shadow-sm">
        {children}
      </div>
    </div>
  );
}
