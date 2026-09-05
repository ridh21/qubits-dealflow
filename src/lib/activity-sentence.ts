export interface ActivityInput {
  action: string;
  entityType: string;
  actorType: string;
  isCurrentActor?: boolean;
  version?: number | null;
}

// Pair templates with their entity type; never interpolate free-text audit payloads.
const templates: Record<string, readonly [entity: string, phrase: string]> = {
  "QUOTATION.CREATED": ["Quotation", "created a quotation"],
  "QUOTATION.UPDATED": ["Quotation", "updated a quotation"],
  "QUOTATION.SUBMITTED": ["Quotation", "submitted a quotation for approval"],
  "QUOTATION.AUTO_APPROVED": [
    "Quotation",
    "completed automatic approval of a quotation",
  ],
  "QUOTATION.SENT": ["Quotation", "sent a quotation to the customer"],
  "QUOTATION.REVISION_STARTED": ["Quotation", "started a quotation revision"],
  "QUOTATION.PROPOSALS_SUBMITTED": [
    "Quotation",
    "submitted proposed quotation changes",
  ],
  "QUOTATION.ACCEPTED_BY_CUSTOMER": ["Quotation", "accepted a quotation"],
  "QUOTATION.CONFIRMED": ["Quotation", "confirmed a quotation"],
  "QUOTATION.CANCELLED": ["Quotation", "cancelled a quotation"],
  "QUOTATION.EXPIRED": ["Quotation", "marked a quotation as expired"],
  "QUOTATION.LINE_ADDED": ["QuotationLine", "added a quotation line"],
  "QUOTATION.LINE_UPDATED": ["QuotationLine", "updated a quotation line"],
  "QUOTATION.LINE_REMOVED": ["QuotationLine", "removed a quotation line"],
  "QUOTATION.LINE_REPRICED": ["QuotationLine", "repriced a quotation line"],
  "APPROVAL.APPROVE": ["ApprovalStep", "approved a quotation review step"],
  "APPROVAL.REJECT": ["ApprovalStep", "rejected a quotation review step"],
  "APPROVAL.RETURN": ["ApprovalStep", "returned a quotation for revision"],
  "PROPOSAL.APPLY": ["NegotiationMessage", "applied a customer proposal"],
  "PROPOSAL.DECLINE": ["NegotiationMessage", "declined a customer proposal"],
  "PROPOSAL.WITHDRAWN": ["NegotiationMessage", "withdrew a customer proposal"],
  "ORDER.CREATED": ["Order", "created an order"],
  "FULFILLMENT.PROPOSED": ["FulfillmentPlan", "proposed a fulfillment plan"],
  "FULFILLMENT.ACCEPTED": ["FulfillmentPlan", "accepted a fulfillment plan"],
  "FULFILLMENT.OVERRIDDEN": ["FulfillmentPlan", "overrode a fulfillment plan"],
  "SHIPMENT.DISPATCHED": ["Shipment", "dispatched a shipment"],
  "SERVICE.COMPLETED": ["ServiceCompletion", "recorded a service completion"],
  "BACKORDER.CONSOLIDATED": ["Backorder", "consolidated a backorder"],
  "INVOICE.ISSUED": ["Invoice", "issued an invoice"],
  "INVOICE.PAYMENT_APPLIED": ["Invoice", "applied a payment to an invoice"],
  "PAYMENT.RECORDED": ["Payment", "recorded a payment"],
  "CREDIT.ISSUED": ["CreditNote", "issued a credit note"],
  "CREDIT.APPLIED": ["CreditNote", "applied a credit note"],
  "SUBSCRIPTION.SCHEDULED": ["Subscription", "scheduled a subscription"],
  "SUBSCRIPTION.ACTIVATION_CHANGED": [
    "Subscription",
    "changed a subscription activation date",
  ],
  "SUBSCRIPTION.CHANGED": ["Subscription", "changed a subscription"],
  "SUBSCRIPTION.CANCELLATION_REQUESTED": [
    "Subscription",
    "requested subscription cancellation",
  ],
  "SUBSCRIPTION.ACTIVATE": ["Subscription", "activated a subscription"],
  "SUBSCRIPTION.PAUSE_REQUESTED": [
    "Subscription",
    "requested a subscription pause",
  ],
  "SUBSCRIPTION.PAUSE_WITHDRAWN": [
    "Subscription",
    "withdrew a subscription pause",
  ],
  "SUBSCRIPTION.PAUSED": ["Subscription", "paused a subscription"],
  "SUBSCRIPTION.RESUME_SELECTED": [
    "Subscription",
    "selected a subscription resume date",
  ],
  "SUBSCRIPTION.RESUME_CHANGED": [
    "Subscription",
    "changed a subscription resume date",
  ],
  "SUBSCRIPTION.RESUMED": ["Subscription", "resumed a subscription"],
  "SUBSCRIPTION.CANCELLED": ["Subscription", "cancelled a subscription"],
  "SUBSCRIPTION.PERIOD_ADVANCED": [
    "Subscription",
    "advanced a subscription billing period",
  ],
  "BILLING.FAILED": ["Subscription", "recorded a subscription billing failure"],
  "ALERT.CREATED": ["DealHealthAlert", "flagged a deal health alert"],
  "ALERT.NUDGE": ["DealHealthAlert", "sent a deal health reminder"],
  "ALERT.ESCALATE": ["DealHealthAlert", "escalated a deal health alert"],
  "ALERT.RESOLVE": ["DealHealthAlert", "resolved a deal health alert"],
  "ALERT.AUTO_RESOLVED": [
    "DealHealthAlert",
    "automatically resolved a deal health alert",
  ],
  "USER.SIGNUP": ["User", "registered an account"],
  "USER.ROLE_ASSIGNED": ["User", "assigned an account role"],
  "USER.DEACTIVATED": ["User", "deactivated an account"],
  "USER.REACTIVATED": ["User", "reactivated an account"],
};

/** Plain text for React to escape. Unknown actions never echo raw identifiers or JSON. */
export function activitySentence(input: ActivityInput): string {
  const subject =
    input.actorType === "SYSTEM"
      ? "The system"
      : input.actorType === "CUSTOMER"
        ? "A customer"
        : input.actorType === "USER"
          ? input.isCurrentActor
            ? "You"
            : "A team member"
          : "An actor";
  const template = Object.hasOwn(templates, input.action)
    ? templates[input.action]
    : undefined;
  const phrase =
    template?.[0] === input.entityType ? template[1] : "updated a record";
  const version =
    template?.[0] === input.entityType &&
    Number.isSafeInteger(input.version) &&
    input.version! > 0
      ? ` (v${input.version})`
      : "";
  return `${subject} ${phrase}${version}.`;
}
