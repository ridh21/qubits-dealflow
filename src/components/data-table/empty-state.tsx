import type { ReactNode } from "react";
import { Stack } from "@/components/icons";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-full">
        {icon ?? <Stack aria-hidden="true" className="size-5" />}
      </div>
      <div className="space-y-1.5">
        <p className="font-display text-base font-semibold">{title}</p>
        {description ? (
          <p className="text-muted-foreground mx-auto max-w-sm text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
