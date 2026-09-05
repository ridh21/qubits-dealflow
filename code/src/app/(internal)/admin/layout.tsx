import type { ReactNode } from "react";
import { requireInternal } from "@/server/auth/guards";
import { AdminSubNav } from "./_components/admin-sub-nav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireInternal();
  return (
    <div className="space-y-6">
      <AdminSubNav />
      {children}
    </div>
  );
}
