"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";

export interface NavItem { href: string; label: string }

export function SidebarNavigation({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  return <SidebarMenu>{items.map((item) => {
    const exact = ["/dashboard", "/admin", "/portal"].includes(item.href);
    const active = exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
    return <SidebarMenuItem key={item.href}>
      <SidebarMenuButton asChild isActive={active}>
        <Link href={item.href} aria-current={active ? "page" : undefined} onClick={() => { if (isMobile) setOpenMobile(false); }}>{item.label}</Link>
      </SidebarMenuButton>
    </SidebarMenuItem>;
  })}</SidebarMenu>;
}
