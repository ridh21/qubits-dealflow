import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductPreview } from "./product-preview";

export function Hero() {
  return (
    <section className="landing-hero">
      <div className="landing-container">
        <div className="landing-hero-copy">
          <p className="landing-pill">One connected workspace for B2B teams</p>
          <h1>See every deal through,<br /><span>from quote to revenue.</span></h1>
          <p className="landing-lead">Bring quotations, approvals, fulfillment, and billing together.<br className="hidden sm:block" /> Know what needs attention and keep every deal moving.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg"><Link href="/signup">Get started</Link></Button>
            <Button asChild size="lg" variant="secondary"><Link href="#flow">See how it works</Link></Button>
          </div>
        </div>
        <div className="hero-preview-backdrop">
          <div className="hero-flow-art" aria-hidden="true" role="presentation" />
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}
