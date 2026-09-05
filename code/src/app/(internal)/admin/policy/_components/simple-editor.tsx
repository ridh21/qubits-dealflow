"use client";
import type { PolicyKind, PolicyPayload } from "@/domain/policy/schemas";
import { NumberField, ToggleField, ChoiceField } from "./fields";
type SimpleKind = Exclude<PolicyKind, "DISCOUNT_RISK">;
const labels: Record<string, string> = {
  shipmentCountPenaltyMinor: "Penalty per shipment (minor currency units)",
  maxWarehousesPerOrder: "Maximum warehouses per order",
  tieBreak: "Warehouse tie-break",
  allowPreviewBeforeConfirmation:
    "Allow split preview before customer confirmation",
  invoiceDueDays: "Invoice due after (days)",
  defaultProration: "Default proration",
  defaultCancellation: "Default cancellation credit",
  allowImmediateCancellation: "Allow immediate cancellation",
  autoApplyCredits: "Automatically apply available credits",
  scheduleHorizonPeriods: "Billing schedule horizon (periods)",
  stalledDays: "Mark stalled after (days)",
  anomalyMinDeltaBp: "Minimum discount anomaly (percentage points)",
  anomalyMinSamples: "Minimum samples for anomaly detection",
  anomalyLookbackDays: "Anomaly history window (days)",
  slippageWindowDays: "Delivery slippage window (days)",
  approvalSlaAlerts: "Enable approval SLA alerts",
  quoteValidityDays: "Quote validity (days)",
  autoApplyCustomerProposals:
    "Automatically apply customer proposals as new revisions",
  allowCustomerPauseResume: "Allow customer pause and resume",
  magicLinkMinutes: "Magic link lifetime (minutes)",
  maxSuggestions: "Maximum suggestions",
  promotedBoost: "Promotion ranking boost",
  enforceMinMargin: "Enforce each product’s minimum margin",
};
const choices: Record<string, { value: string; label: string }[]> = {
  tieBreak: [
    { value: "PRIORITY", label: "Warehouse priority, then code" },
    { value: "CODE", label: "Warehouse code" },
  ],
  defaultProration: [
    { value: "DAILY", label: "Actual calendar days" },
    { value: "NONE", label: "No proration" },
  ],
  defaultCancellation: [
    { value: "NONE", label: "No credit" },
    { value: "PRORATED_CREDIT", label: "Credit unused days" },
    { value: "FULL_CREDIT", label: "Full period credit" },
  ],
};
export function SimpleEditor<K extends SimpleKind>({
  value,
  onChange,
}: {
  value: PolicyPayload<K>;
  onChange: (p: PolicyPayload<K>) => void;
}) {
  return (
    <div className="grid items-start gap-6 sm:grid-cols-2">
      {Object.entries(value)
        .filter(([key]) => labels[key])
        .map(([key, v]) => {
          const label = labels[key],
            change = (next: unknown) => onChange({ ...value, [key]: next });
          if (typeof v === "boolean")
            return (
              <ToggleField
                key={key}
                label={label}
                value={v}
                onChange={change}
              />
            );
          if (typeof v === "number")
            return (
              <NumberField
                key={key}
                label={label}
                value={v}
                bp={key.endsWith("Bp")}
                step={key === "promotedBoost" ? 0.1 : undefined}
                onChange={change}
              />
            );
          if (typeof v === "string" && choices[key])
            return (
              <ChoiceField
                key={key}
                label={label}
                value={v}
                options={choices[key]}
                onChange={change}
              />
            );
          return null;
        })}
    </div>
  );
}
