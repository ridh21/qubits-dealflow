import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/server/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Bell, SignOut } from "@/components/icons";
import { NavLink } from "./nav-link";

export interface NavItem {
  href: string;
  label: string;
}

export const INTERNAL_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/quotations", label: "Quotations" },
  { href: "/approvals", label: "Approvals" },
  { href: "/fulfillment", label: "Fulfillment" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/invoices", label: "Invoices" },
  { href: "/deal-health", label: "Deal health" },
  { href: "/reports", label: "Reports" },
  { href: "/admin", label: "Admin" },
];

export const PORTAL_NAV: NavItem[] = [
  { href: "/portal", label: "My quotations" },
  { href: "/portal/subscriptions", label: "My subscriptions" },
  { href: "/portal/messages", label: "Messages" },
  { href: "/portal/profile", label: "Profile" },
];

export function AppShell({
  nav,
  user,
  children,
  variant = "internal",
}: {
  nav: NavItem[];
  user: { name?: string | null; email?: string | null; role?: string };
  children: ReactNode;
  variant?: "internal" | "portal";
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-6 px-6">
          <Link href={variant === "portal" ? "/portal" : "/dashboard"} className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground font-display grid size-7 place-items-center rounded-md text-[13px] font-bold">
              D
            </span>
            <span className="font-display text-[15px] font-semibold">DealFlow360</span>
          </Link>

          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {nav.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="size-4" />
            </Button>
            <div className="hidden text-right sm:block">
              <p className="text-[13px] leading-tight font-medium">{user.name ?? user.email}</p>
              <p className="text-muted-foreground text-[11px] leading-tight">
                {(user.role ?? "").replace(/_/g, " ").toLowerCase()}
              </p>
            </div>
            <form action={logoutAction}>
              <Button variant="ghost" size="icon" type="submit" aria-label="Sign out">
                <SignOut className="size-4" />
              </Button>
            </form>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto border-t px-6 py-2 md:hidden">
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 space-y-8 px-6 py-8">{children}</main>

      <footer className="text-muted-foreground border-t px-6 py-4 text-xs">
        <div className="mx-auto w-full max-w-[1200px]">
          DealFlow360 &middot; quotation, approval, fulfillment and billing in one flow
        </div>
      </footer>
    </div>
  );
}
