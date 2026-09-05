import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "@/components/icons";
import { Eyebrow, Section } from "./rails";

const PROOF = [
  "Policy-versioned discounts",
  "Multi-warehouse splitting",
  "Hybrid one-time + recurring billing",
];

export function Hero() {
  return (
    <Section innerClassName="py-20 sm:py-28">
      {/* A soft wash bled behind the copy, clipped by the rails so the grid
          still reads as the strongest line on the page. */}
      <div
        aria-hidden
        className="from-primary-50/80 pointer-events-none absolute inset-x-0 -top-16 -z-10 h-80 bg-gradient-to-b to-transparent"
      />

      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow>Self-governing B2B deals</Eyebrow>
        <h1 className="font-display mt-5 text-4xl leading-[1.08] font-semibold text-balance sm:text-5xl lg:text-[3.4rem]">
          What you quote is what gets approved, shipped and invoiced.
        </h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-xl text-base leading-relaxed text-pretty">
          One published policy drives discount ceilings, approval routing, warehouse
          splitting and hybrid billing — so a deal never drifts between the quote and
          the invoice.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/signup">
              Request access
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        <ul className="text-muted-foreground mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px]">
          {PROOF.map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <CheckCircle className="text-primary size-4" weight="fill" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
