import Link from "next/link";
import { Section } from "./rails";
import { Wordmark } from "./wordmark";

const GROUPS = [
  {
    title: "Product",
    links: [
      { href: "#flow", label: "How it works" },
      { href: "#pricing", label: "Pricing" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    title: "Access",
    links: [
      { href: "/login", label: "Internal sign in" },
      { href: "/portal/login", label: "Customer portal" },
      { href: "/signup", label: "Request access" },
    ],
  },
];

export function SiteFooter() {
  return (
    <Section ruled={false} innerClassName="py-14">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div className="max-w-xs">
          <Wordmark />
          <p className="text-muted-foreground mt-4 text-[13px] leading-relaxed">
            Quotation, approval, fulfillment and billing in one flow — with every
            decision accounted for.
          </p>
        </div>

        {GROUPS.map((group) => (
          <div key={group.title}>
            <p className="text-[11px] font-medium tracking-[0.14em] uppercase">
              {group.title}
            </p>
            <ul className="mt-4 space-y-2.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-border/70 text-muted-foreground mt-12 flex flex-col gap-2 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} DealFlow360. All rights reserved.</p>
        <p>Built for Indian B2B desks — INR and GST throughout.</p>
      </div>
    </Section>
  );
}
