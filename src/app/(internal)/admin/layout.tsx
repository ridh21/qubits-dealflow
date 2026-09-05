import type { ReactNode } from "react";
import { requireInternal } from "@/server/auth/guards";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireInternal();
  return <div className="space-y-6">{children}</div>;
}
