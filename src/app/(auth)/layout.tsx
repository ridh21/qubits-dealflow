import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { ProductPreview } from "@/components/marketing/product-preview";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <div className="auth-main">
        <Link href="/" aria-label="DealFlow360 home" className="auth-brand"><BrandMark className="size-9" /><span className="font-display text-base font-semibold">DealFlow360</span></Link>
        <main id="main-content" className="auth-form">{children}</main>
        <p className="auth-footnote">Your team. Your customers. One connected flow.</p>
      </div>
      <aside className="auth-aside" aria-label="About DealFlow360">
        <div className="auth-aside-copy">
          <p className="landing-pill">Every decision, accounted for</p>
          <h2>The full story behind<br />every deal.</h2>
          <p>Follow the work from the first quotation to the moment an order is delivered, paid, or renewed.</p>
        </div>
        <div className="auth-preview"><ProductPreview compact mode="revenue" /></div>
        <div className="auth-aside-bottom"><span>Quotations</span><span>Approvals</span><span>Fulfillment</span><span>Billing</span></div>
      </aside>
    </div>
  );
}
