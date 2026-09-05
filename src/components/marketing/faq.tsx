import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Eyebrow, Section } from "./rails";

const QUESTIONS = [
  {
    q: "What stops a rep from discounting past the ceiling?",
    a: "The ceiling is part of a published policy version, not a setting someone edits mid-deal. A quote priced against version 4 keeps being evaluated against version 4 — so approvals, margins and the audit trail all agree even after the policy moves on.",
  },
  {
    q: "How are part-shipments and backorders handled?",
    a: "Fulfilment plans split an order across warehouses with real reservations. What cannot be reserved becomes a backorder rather than silently under-shipping, and invoices follow dispatch, so you never bill for stock that has not left.",
  },
  {
    q: "Can one order be both one-time and recurring?",
    a: "Yes. A single confirmed quotation can produce physical lines, service lines and subscription lines. Each is billed on its own schedule, with proration and credit notes handled on pause, resume and cancellation.",
  },
  {
    q: "What do customers see?",
    a: "Customers sign in to a portal with a magic link — no password to manage. They see their own quotations, orders, invoices and subscriptions, can accept or negotiate a quote, and nothing else.",
  },
  {
    q: "Is our data isolated?",
    a: "Every read is scoped by role and, for portal users, by customer. Internal roles are separated into sales, manager, finance and admin, and every state change is written to an immutable audit log.",
  },
];

export function Faq() {
  return (
    <Section id="faq" innerClassName="py-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-16">
        <div>
          <Eyebrow>Questions</Eyebrow>
          <h2 className="font-display mt-4 text-3xl font-semibold text-balance sm:text-4xl">
            The things teams ask first
          </h2>
          <p className="text-muted-foreground mt-4 text-[15px] leading-relaxed text-pretty">
            Still unsure whether it fits how your desk works? Ask for access and we
            will walk a real deal through it with you.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {QUESTIONS.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger className="text-start text-[15px] font-medium">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}
