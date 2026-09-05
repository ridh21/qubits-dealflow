import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, ShieldCheck, Truck, Receipt, Repeat } from "@/components/icons";

const STEPS = [
  { icon: FileText, title: "Quote", body: "Versioned quotations with live pricing, margin and upsell." },
  { icon: ShieldCheck, title: "Approve", body: "Discount ceilings and reviewer chains from one published policy." },
  { icon: Truck, title: "Fulfil", body: "Multi-warehouse splitting with reservations and backorders." },
  { icon: Receipt, title: "Bill", body: "Dispatch, completion and cycle invoices with credits and payments." },
  { icon: Repeat, title: "Renew", body: "Subscription tiers, entitlements, proration, pause and resume." },
];

export default function LandingPage() {
  return (
    <div className="lining flex-1">
      <header className="flex h-16 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2">
          <span className="bg-primary text-primary-foreground font-display grid size-7 place-items-center rounded-md text-[13px] font-bold">
            D
          </span>
          <span className="font-display text-[15px] font-semibold">DealFlow360</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/portal/login">Customer portal</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <section className="border-b px-6 py-20 text-center">
        <p className="text-primary-700 text-xs font-medium tracking-[0.14em] uppercase">
          Self-governing B2B deals
        </p>
        <h1 className="font-display mx-auto mt-4 max-w-3xl text-4xl leading-[1.1] font-semibold sm:text-5xl">
          What you quote is what gets approved, shipped and invoiced.
        </h1>
        <p className="text-muted-foreground mx-auto mt-5 max-w-xl text-base leading-relaxed">
          One policy version drives discount ceilings, approval routing, warehouse splitting and
          hybrid billing — so a deal never drifts between the quote and the invoice.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Request access</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-px border-b sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s) => (
          <Card key={s.title} className="rounded-none border-0 shadow-none">
            <CardContent className="space-y-2 p-6">
              <s.icon className="text-primary size-5" weight="duotone" />
              <p className="font-display text-sm font-semibold">{s.title}</p>
              <p className="text-muted-foreground text-sm leading-relaxed">{s.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="bg-primary-50/50 px-6 py-16 text-center">
        <h2 className="font-display text-2xl font-semibold">Ready to run a deal end to end?</h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
          Internal teams sign in with a password; customers get a magic link to their portal.
        </p>
        <Button asChild className="mt-6">
          <Link href="/login">Open DealFlow360</Link>
        </Button>
      </section>

      <footer className="text-muted-foreground px-6 py-6 text-xs">
        DealFlow360 — quotation, approval, fulfillment and billing in one flow.
      </footer>
    </div>
  );
}
