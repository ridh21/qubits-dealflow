import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function KpiTile({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "primary" | "warning" | "success";
}) {
  const toneClass = {
    default: "text-foreground",
    primary: "text-primary-700",
    warning: "text-warning-foreground",
    success: "text-success",
  }[tone];

  return (
    <div className="kpi-tile min-w-0" data-tone={tone}>
      <div className="kpi-label"><span>{label}</span>{icon ? <span aria-hidden="true" className="opacity-60 [&_svg]:size-4">{icon}</span> : null}</div>
      <div className="kpi-value">
        <p className={cn("font-display tabular", toneClass)}>{value}</p>
        {hint ? <p>{hint}</p> : null}
      </div>
    </div>
  );
}
