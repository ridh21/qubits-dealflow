import { PageRails } from "@/components/marketing/rails";
import { SiteNav } from "@/components/marketing/site-nav";
import { Hero } from "@/components/marketing/hero";
import { Flow } from "@/components/marketing/flow";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { Cta } from "@/components/marketing/cta";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MarketingMotion } from "@/components/marketing/marketing-motion";

export const metadata = {
  title: "DealFlow360 — quote to cash, accounted for",
  description:
    "One published policy drives discount ceilings, approval routing, warehouse splitting and hybrid billing, so a deal never drifts between the quote and the invoice.",
};

export default function LandingPage() {
  return (
    <PageRails>
      <MarketingMotion>
        <SiteNav />
        <Hero />
        <Flow />
        <Pricing />
        <Faq />
        <Cta />
        <SiteFooter />
      </MarketingMotion>
    </PageRails>
  );
}
