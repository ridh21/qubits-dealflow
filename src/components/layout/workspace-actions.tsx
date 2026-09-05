"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const ActionsContext = createContext<{
  target: HTMLDivElement | null;
  setTarget: (target: HTMLDivElement | null) => void;
} | null>(null);

export function WorkspaceActionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return (
    <ActionsContext.Provider value={{ target, setTarget }}>
      {children}
    </ActionsContext.Provider>
  );
}

/** Rendered once, in the workspace toolbar above the page content. */
export function WorkspaceActionsSlot() {
  const context = useContext(ActionsContext);
  return <div ref={context?.setTarget} className="contents" />;
}

/**
 * Page-level commands. They render into the toolbar beside the content they
 * act on rather than into the sidebar, which is navigation only.
 * The ref keeps commands connected across route changes.
 */
export function WorkspaceActions({ children }: { children: ReactNode }) {
  const context = useContext(ActionsContext);
  return context?.target
    ? createPortal(
        <div className="flex flex-wrap items-center justify-end gap-2">
          {children}
        </div>,
        context.target,
      )
    : null;
}
