"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar";

const subscribe = () => () => {};
const snapshot = () => document.getElementById("workspace-actions");
const serverSnapshot = () => null;

/** Page-specific commands share the shadcn sidebar and its mobile drawer. */
export function WorkspaceActions({ children }: { children: ReactNode }) {
  const target = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return target ? createPortal(<SidebarGroup><SidebarGroupLabel>Actions</SidebarGroupLabel><div className="flex flex-col gap-2">{children}</div></SidebarGroup>, target) : null;
}
