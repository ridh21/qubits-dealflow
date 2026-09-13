import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import {
  logoutAction,
  portalLogoutAction,
} from "@/server/actions/auth.actions";
import { SignOut } from "@/components/icons";
import { WorkspaceBreadcrumb } from "./workspace-breadcrumb";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  WorkspaceActionsProvider,
  WorkspaceActionsSlot,
} from "./workspace-actions";
import { SidebarNavigation, type NavItem } from "./sidebar-navigation";

export type { NavItem } from "./sidebar-navigation";
export const INTERNAL_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/quotations", label: "Quotations" },
  { href: "/approvals", label: "Approvals" },
  { href: "/fulfillment", label: "Fulfillment" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/invoices", label: "Invoices" },
  { href: "/deal-health", label: "Deal health" },
  { href: "/reports", label: "Reports" },
  { href: "/analytics", label: "Analytics" },
];
export const PORTAL_NAV: NavItem[] = [
  { href: "/portal", label: "My quotations" },
  { href: "/portal/orders", label: "My orders" },
  { href: "/portal/invoices", label: "My invoices" },
  { href: "/portal/subscriptions", label: "My subscriptions" },
  { href: "/portal/messages", label: "Messages" },
  { href: "/portal/profile", label: "Profile" },
];
const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users & teams" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/price-lists", label: "Price lists" },
  { href: "/admin/warehouses", label: "Warehouses & stock" },
  { href: "/admin/policy", label: "Policy Center" },
  { href: "/admin/plans", label: "Plans & entitlements" },
  { href: "/admin/emails", label: "Email outbox" },
  { href: "/admin/jobs", label: "Billing jobs" },
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
  const portal = variant === "portal";
  const configuration =
    user.role === "ADMIN"
      ? ADMIN_NAV
      : ADMIN_NAV.filter(
          (item) =>
            item.href === "/admin/policy" ||
            (user.role === "FINANCE" && item.href === "/admin/warehouses"),
        );
  return (
    <TooltipProvider>
      <WorkspaceActionsProvider>
        <SidebarProvider className="workspace-shell" style={{ "--sidebar-width": "14rem" } as CSSProperties}>
          {/* "icon" rather than "offcanvas": collapsing on desktop should
              narrow the rail to icons, not hide navigation entirely. */}
          <Sidebar collapsible="icon" role="complementary" aria-label="Workspace sidebar">
            <SidebarHeader className="gap-4 p-4 group-data-[collapsible=icon]:px-2">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={portal ? "/portal" : "/dashboard"}
                  aria-label="DealFlow360 home"
                  className="font-display flex items-center gap-2 font-semibold"
                >
                  <BrandMark className="size-8" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    DealFlow360
                  </span>
                </Link>
              </div>
              <p className="text-muted-foreground text-xs group-data-[collapsible=icon]:hidden">
                {portal ? "Customer portal" : "Sales operations"}
              </p>
            </SidebarHeader>
            {/* The sidebar is navigation only. Page actions live in the
                workspace toolbar, beside the content they act on. */}
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Workspace</SidebarGroupLabel>
                <SidebarNavigation items={nav} />
              </SidebarGroup>
              {!portal && configuration.length > 0 && (
                <SidebarGroup>
                  <SidebarGroupLabel>Configuration</SidebarGroupLabel>
                  <SidebarNavigation items={configuration} />
                </SidebarGroup>
              )}
            </SidebarContent>
            <SidebarFooter className="border-t p-3 group-data-[collapsible=icon]:p-1">
              <div className="flex items-center gap-3 px-1 py-2 group-data-[collapsible=icon]:hidden">
                <span className="bg-lilac grid size-9 shrink-0 place-items-center rounded-full text-xs font-medium text-[#59419b]" aria-hidden="true">
                  {(user.name ?? user.email ?? "D").slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {user.name ?? user.email}
                </p>
                <p className="text-muted-foreground text-xs capitalize">
                  {user.role?.replaceAll("_", " ").toLowerCase()}
                </p>
                </div>
              </div>
              <form action={portal ? portalLogoutAction : logoutAction}>
                <SidebarMenuButton type="submit" tooltip="Sign out" className="signout-action">
                  <SignOut className="size-4" />
                  <span>Sign out</span>
                </SidebarMenuButton>
              </form>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className="min-w-0 bg-surface">
            {/* Single toolbar: the one nav toggle, and this page's actions. */}
            <div className="bg-white sticky top-0 z-20 flex min-h-16 flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-6">
              <SidebarTrigger aria-label="Toggle navigation" />
              <WorkspaceBreadcrumb portal={portal} />
              <div className="ms-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
                <WorkspaceActionsSlot />
              </div>
            </div>
            <main id="main-content" className="workspace-content mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-4 py-7 sm:px-6 lg:px-8 lg:py-8">
              {children}
            </main>
            <footer className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 px-6 py-5 text-[11px]">
              <span>DealFlow360 · Every deal, connected.</span>
              <span>{portal ? "Your customer workspace" : "Sales operations workspace"}</span>
            </footer>
          </SidebarInset>
        </SidebarProvider>
      </WorkspaceActionsProvider>
    </TooltipProvider>
  );
}
