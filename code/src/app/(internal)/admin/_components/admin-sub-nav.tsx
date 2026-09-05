"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/price-lists", label: "Price lists" },
  { href: "/admin/warehouses", label: "Warehouses" },
  { href: "/admin/policy", label: "Policy Center" },
  { href: "/admin/plans", label: "Plans & entitlements" },
  { href: "/admin/emails", label: "Emails" },
];

export function AdminSubNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-muted/50 flex flex-wrap items-center gap-1 rounded-lg p-1">
      {ITEMS.map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-background text-foreground font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
