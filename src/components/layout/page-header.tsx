import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-2">
        <h1 className="font-display text-[28px] leading-tight font-semibold tracking-[-0.03em]">{title}</h1>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="workspace-section min-w-0 space-y-2">
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold">{title}</h2>
            {description ? (
              <p className="text-muted-foreground mt-1 max-w-[70ch] text-xs leading-relaxed">{description}</p>
            ) : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className="workspace-section-body">{children}</div>
    </section>
  );
}
