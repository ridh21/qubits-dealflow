"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { List, X } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Wordmark } from "./wordmark";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#features", label: "Features" },
  { href: "#flow", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 28);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header className={cn("landing-nav-wrap", scrolled && "is-scrolled")}>
      <nav aria-label="Main navigation" className="landing-nav">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <Wordmark className="pl-2" />
          <div className="hidden items-center gap-6 lg:flex">
            {LINKS.map(link => <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground text-[13px] transition-colors">{link.label}</Link>)}
          </div>
          <div className="flex items-center gap-2">
            <Button asChild className="h-9 px-5"><Link href="/login">Login</Link></Button>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? "Close menu" : "Open menu"}>
              {open ? <X className="size-5" /> : <List className="size-5" />}
            </Button>
          </div>
        </div>
        {open && <div id="mobile-navigation" className="flex flex-col gap-1 border-t p-3 lg:hidden">
          {LINKS.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="hover:bg-muted rounded-xl px-3 py-3 text-sm">{link.label}</Link>)}
          <Link href="/portal/login" className="text-primary-700 px-3 py-3 text-sm">Customer portal</Link>
        </div>}
      </nav>
    </header>
  );
}
