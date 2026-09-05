import { FileText, ShieldCheck, Truck, Receipt, Repeat } from "@/components/icons";
import { Eyebrow, Section } from "./rails";
import { Panel } from "./panel";

const STAGES = [
  {
    icon: FileText,
    label: "Quote",
    description: "Versioned quotations with live pricing and margin.",
    metric: "Margin, live",
    detail: [
      ["Line discount", "12.0%"],
      ["Effective", "14.4%"],
      ["Margin", "31.2%"],
    ] as const,
  },
  {
    icon: ShieldCheck,
    label: "Approve",
    description: "Ceilings and reviewer chains from one published policy.",
    metric: "Risk band",
    detail: [
      ["Discount", "Within ceiling"],
      ["Reviewers", "Manager → Finance"],
      ["SLA", "8h remaining"],
    ] as const,
  },
  {
    icon: Truck,
    label: "Fulfil",
    description: "Multi-warehouse splitting, reservations and backorders.",
    metric: "Allocation",
    detail: [
      ["Mumbai", "40 of 60"],
      ["Pune", "20 of 60"],
      ["Backorder", "None"],
    ] as const,
  },
  {
    icon: Receipt,
    label: "Bill",
    description: "Dispatch, completion and cycle invoices with credits.",
    metric: "Receivables",
    detail: [
      ["Issued", "₹8.87 L"],
      ["Settled", "₹8.87 L"],
      ["Overdue", "None"],
    ] as const,
  },
  {
    icon: Repeat,
    label: "Renew",
    description: "Tiers, entitlements, proration, pause and resume.",
    metric: "Recurring",
    detail: [
      ["Active", "12 plans"],
      ["Next cycle", "1 Oct"],
      ["Proration", "Daily"],
    ] as const,
  },
];

export function Flow() {
  return (
    <Section id="flow" innerClassName="py-20">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow>The whole deal, one system</Eyebrow>
        <h2 className="font-display mt-4 text-3xl font-semibold text-balance sm:text-4xl">
          Five stages that never disagree with each other
        </h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-pretty">
          Each stage reads the same policy version the quote was priced against, so
          nothing is re-decided downstream.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {STAGES.map((stage, index) => (
          <Panel
            key={stage.label}
            // 3 across, then the last two split the final row evenly.
            className={index < 3 ? "lg:col-span-2" : "lg:col-span-3"}
            label={stage.label}
            description={stage.description}
            badge={
              <stage.icon
                className="text-primary size-5 shrink-0"
                weight="duotone"
              />
            }
          >
            <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
              {stage.metric}
            </p>
            <dl className="mt-3 space-y-2.5">
              {stage.detail.map(([term, value]) => (
                <div
                  key={term}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <dt className="text-muted-foreground">{term}</dt>
                  <dd className="tabular font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        ))}
      </div>
    </Section>
  );
}
