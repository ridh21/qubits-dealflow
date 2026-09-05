import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, INTERNAL_NAV } from "@/components/layout/app-shell";
import { getUser, INTERNAL_ROLES } from "@/server/auth/guards";

export default async function InternalLayout({ children }: { children: ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!INTERNAL_ROLES.includes(user.role as (typeof INTERNAL_ROLES)[number])) redirect("/pending");

  return (
    <AppShell nav={INTERNAL_NAV} user={user}>
      {children}
    </AppShell>
  );
}
