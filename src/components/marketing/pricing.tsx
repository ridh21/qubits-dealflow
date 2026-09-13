import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Eyebrow, Section } from "./rails";
import { Panel } from "./panel";

const PLANS = [
  {
    name: "Team",
    blurb: "For a single sales desk finding its rhythm.",
    price: "₹24,000",
    cadence: "per month",
    features: [
      "Up to 10 internal seats",
      "Quotations, approvals, orders",
      "Single price list",
      "Email support",
    ],
    cta: "Request access",
    href: "/signup",
  },
  {
    name: "Growth",
    blurb: "For desks running fulfilment and billing together.",
    price: "₹68,000",
    cadence: "per month",
    features: [
      "Up to 40 internal seats",
      "Multi-warehouse fulfilment",
      "Subscriptions and proration",
      "Customer portal",
      "Policy Center with versioning",
    ],
    cta: "Request access",
    href: "/signup",
    featured: true,
  },
  {
    name: "Enterprise",
    blurb: "For multi-entity operations with their own controls.",
    price: "Custom",
    cadence: "billed annually",
    features: [
      "Unlimited seats and warehouses",
      "Custom approval matrices",
      "Data residency and SSO",
      "Named success contact",
    ],
    cta: "Talk to us",
    href: "/signup",
  },
];

export function Pricing() {
  return (
    <Section id="pricing" innerClassName="py-20">
      <div className="reveal-heading mx-auto max-w-2xl text-center">
        <Eyebrow>Pricing</Eyebrow>
        <h2 className="font-display mt-4 text-3xl font-semibold text-balance sm:text-4xl">
          Priced per desk, not per document
        </h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-pretty">
          Every plan includes the full quote-to-cash flow. Quotations, invoices and
          credit notes are never metered.
        </p>
      </div>

      <div className="pricing-grid mt-12 grid items-start gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <Panel
            key={plan.name}
            label={plan.name}
            description={plan.blurb}
            featured={plan.featured}
            badge={
              plan.featured ? (
                <span className="bg-white text-primary-700 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap">
                  Most chosen
                </span>
              ) : undefined
            }
          >
            <p className="flex items-baseline gap-1.5">
              <span className="font-display text-3xl font-semibold">
                {plan.price}
              </span>
              <span className="text-muted-foreground text-[13px]">
                {plan.cadence}
              </span>
            </p>

            <ul className="mt-5 flex-1 space-y-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check
                    className="text-primary mt-0.5 size-4 shrink-0"
                    weight="bold"
                  />
                  <span className="text-muted-foreground leading-relaxed">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <Button
              asChild
              className={cn("mt-6 w-full")}
              variant={plan.featured ? "default" : "outline"}
            >
              <Link href={plan.href}>{plan.cta}</Link>
            </Button>
          </Panel>
        ))}
      </div>

      <p className="text-muted-foreground mt-10 text-center text-xs">
        Prices in INR, exclusive of GST. Customer portal seats are unlimited on every plan.
      </p>
    </Section>
  );
}
