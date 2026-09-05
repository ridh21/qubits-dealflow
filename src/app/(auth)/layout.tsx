import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-16 sm:px-16">
        <Link href="/" className="mb-10 flex items-center gap-2">
          <span className="bg-primary text-primary-foreground font-display grid size-7 place-items-center rounded-md text-[13px] font-bold">
            D
          </span>
          <span className="font-display text-[15px] font-semibold">DealFlow360</span>
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </div>

      <div className="bg-primary-50/60 hidden border-l lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="lining border-primary-100 max-w-sm px-8 py-10">
          <p className="text-primary-700 text-xs font-medium tracking-wide uppercase">
            One flow, end to end
          </p>
          <h2 className="font-display mt-3 text-3xl leading-tight font-semibold">
            Quote, approve, fulfil and bill without leaving the deal.
          </h2>
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Discount governance, approval routing, warehouse splitting and hybrid billing all read
            from the same policy version, so what you quote is what gets shipped and invoiced.
          </p>
        </div>
      </div>
    </div>
  );
}
