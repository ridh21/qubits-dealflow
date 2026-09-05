"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { List, X } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Wordmark } from "./wordmark";

const LINKS = [
  { href: "#flow", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-background/85 sticky top-0 z-30 border-b border-border/70 backdrop-blur">
      <div className="relative mx-auto max-w-6xl px-6 sm:px-10">
        <div className="flex h-16 items-center justify-between gap-4">
          <Wordmark />

          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/portal/login">Customer portal</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-4" /> : <List className="size-4" />}
          </Button>
        </div>

        <div
          className={cn(
            "grid overflow-hidden transition-[grid-template-rows] duration-200 md:hidden",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="min-h-0">
            <nav className="flex flex-col gap-1 pb-4">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-3 py-2 text-sm"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 flex flex-col gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/portal/login">Customer portal</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
