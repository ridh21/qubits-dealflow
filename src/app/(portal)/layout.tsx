import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, PORTAL_NAV } from "@/components/layout/app-shell";
import { getPortalUser } from "@/server/auth/guards";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await getPortalUser();
  if (!user) redirect("/portal/login");

  return (
    <AppShell nav={PORTAL_NAV} user={user} variant="portal">
      {children}
    </AppShell>
  );
}
