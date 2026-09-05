import { DotmSquare1 } from "@/components/ui/dotm-square-1";
import { cn } from "@/lib/utils";

/**
 * The app's single spinner. Everything that waits shows this dot matrix so a
 * pending screen reads as loading rather than as an empty one.
 */
export function Loader({
  size = 24,
  className,
  label = "Loading",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <DotmSquare1
      size={size}
      dotSize={Math.max(2, Math.round(size / 9))}
      className={cn("text-primary", className)}
      ariaLabel={label}
      colorPreset="solid-theme"
    />
  );
}

/**
 * Centred loader for a whole route. Fills the space the page content would
 * occupy so the dots sit in the optical middle of the workspace, not just
 * below the header.
 */
export function PageLoader({
  label = "Loading",
  description,
  className,
}: {
  label?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center gap-3 text-center",
        className,
      )}
    >
      <Loader size={28} label={label} />
      <div className="space-y-0.5">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        {description ? (
          <p className="text-muted-foreground/70 text-xs">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Inline loader for buttons and table cells, sized to the current text. */
export function InlineLoader({
  label = "Working",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Loader size={14} label={label} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
