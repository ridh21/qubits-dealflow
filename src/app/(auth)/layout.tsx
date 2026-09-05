import type { ReactNode } from "react";
import { CheckCircle } from "@/components/icons";
import { Wordmark } from "@/components/marketing/wordmark";

const ASSURANCES = [
  "Discount ceilings from one published policy",
  "Approvals routed by risk, not by memory",
  "Invoices that follow dispatch, not intent",
];

/**
 * Split sign-in layout. The right panel repeats the landing page's rails so the
 * two pages read as one product rather than two designs.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    // flex-1, not min-h-full: the body is a flex column, so a percentage
    // min-height collapses and the right panel stops short of the fold.
    <div className="grid flex-1 lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col justify-center px-6 py-14 sm:px-12 lg:px-16">
        <Wordmark className="mb-10" />
        <div className="w-full max-w-sm">{children}</div>
      </div>

      <div className="bg-primary-50/40 border-border/70 relative hidden border-s lg:flex lg:flex-col lg:justify-center lg:px-16">
        {/* The landing page's lining, carried into the auth screens. */}
        <div
          aria-hidden
          className="border-border/70 pointer-events-none absolute inset-y-0 left-1/2 w-full max-w-md -translate-x-1/2 border-x"
        />

        <div className="relative mx-auto w-full max-w-md px-8 py-12">
          <p className="text-primary-700 text-[11px] font-medium tracking-[0.16em] uppercase">
            One flow, end to end
          </p>
          <h2 className="font-display mt-4 text-3xl leading-[1.15] font-semibold text-balance">
            Quote, approve, fulfil and bill without leaving the deal.
          </h2>
          <p className="text-muted-foreground mt-5 text-[15px] leading-relaxed text-pretty">
            Discount governance, approval routing, warehouse splitting and hybrid
            billing all read from the same policy version — so what you quote is what
            gets shipped and invoiced.
          </p>

          <ul className="mt-8 space-y-3">
            {ASSURANCES.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <CheckCircle
                  className="text-primary mt-0.5 size-4 shrink-0"
                  weight="fill"
                />
                <span className="text-muted-foreground leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
