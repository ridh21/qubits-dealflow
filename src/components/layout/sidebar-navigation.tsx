"use client";

import Link from "next/link";
import {
  Gauge,
  FileText,
  ShieldCheck,
  Truck,
  Repeat,
  Receipt,
  WarningCircle,
  ChartLineUp,
  Gear,
  Users,
  Buildings,
  Cube,
  Tag,
  Warehouse,
  Envelope,
  UserIcon,
  Package,
  ClockCounterClockwise,
} from "@/components/icons";
const navigationIcons: Record<string, typeof Gauge> = {
  dashboard: Gauge,
  quotations: FileText,
  approvals: ShieldCheck,
  fulfillment: Truck,
  subscriptions: Repeat,
  invoices: Receipt,
  "deal-health": WarningCircle,
  reports: ChartLineUp,
  analytics: ChartLineUp,
  admin: Gear,
  users: Users,
  customers: Buildings,
  products: Cube,
  "price-lists": Tag,
  warehouses: Warehouse,
  policy: ShieldCheck,
  plans: Repeat,
  emails: Envelope,
  jobs: ClockCounterClockwise,
  portal: FileText,
  orders: Package,
  messages: Envelope,
  profile: UserIcon,
};
import { usePathname } from "next/navigation";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export interface NavItem {
  href: string;
  label: string;
}

export function SidebarNavigation({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon =
          navigationIcons[item.href.split("/").filter(Boolean).at(-1) ?? ""] ??
          FileText;
        const exact = ["/dashboard", "/admin", "/portal"].includes(item.href);
        const active = exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={active}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  if (isMobile) setOpenMobile(false);
                }}
              >
                <Icon
                  aria-hidden="true"
                  className="size-4 shrink-0"
                  weight={active ? "duotone" : "regular"}
                />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
