"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar";

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

export function WorkspaceActionsSlot() {
  const context = useContext(ActionsContext);
  return <div ref={context?.setTarget} />;
}

/** The ref keeps commands connected when the mobile drawer mounts or closes. */
export function WorkspaceActions({ children }: { children: ReactNode }) {
  const context = useContext(ActionsContext);
  return context?.target
    ? createPortal(
        <SidebarGroup>
          <SidebarGroupLabel>Actions</SidebarGroupLabel>
          <div className="flex flex-col gap-2">{children}</div>
        </SidebarGroup>,
        context.target,
      )
    : null;
}
