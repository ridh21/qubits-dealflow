"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  dashboard: "Overview", quotations: "Quotations", approvals: "Approvals",
  fulfillment: "Fulfillment", subscriptions: "Subscriptions", invoices: "Invoices",
  "deal-health": "Deal health", reports: "Reports", analytics: "Analytics",
  admin: "Administration", customers: "Customers", users: "Users & teams",
  products: "Products", warehouses: "Warehouses", "price-lists": "Price lists",
  plans: "Plans & entitlements", policy: "Policy Center", emails: "Email outbox",
  jobs: "Billing jobs", portal: "Customer portal", orders: "Orders", messages: "Messages",
  profile: "Profile", new: "New quotation", history: "History", recommendations: "Recommendations",
  "discount-risk": "Discount & risk", billing: "Billing",
};
export function WorkspaceBreadcrumb({ portal }: { portal: boolean }) {
  const parts = usePathname().split("/").filter(Boolean);
  const named = parts.filter((part) => LABELS[part]);
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-xs sm:flex">
      <Link href={portal ? "/portal" : "/dashboard"} className="text-muted-foreground hover:text-foreground">Workspace</Link>
      <span aria-hidden="true" className="text-border">/</span>
      <span className="max-w-40 truncate font-medium" aria-current="page">{LABELS[named.at(-1) ?? "dashboard"]}</span>
    </nav>
  );
}
