"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      className={cn(
        "relative rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
        active
          ? "text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      {label}
      {active ? (
        <span className="bg-primary absolute inset-x-3 -bottom-[9px] h-0.5 rounded-full" />
      ) : null}
    </Link>
  );
}
