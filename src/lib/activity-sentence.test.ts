import { describe, expect, it } from "vitest";
import { activitySentence } from "./activity-sentence";

describe("activitySentence", () => {
  it.each([
    ["QUOTATION.CREATED", "Quotation", "created a quotation"],
    ["QUOTATION.SUBMITTED", "Quotation", "submitted a quotation for approval"],
    ["QUOTATION.SENT", "Quotation", "sent a quotation to the customer"],
    ["QUOTATION.CONFIRMED", "Quotation", "confirmed a quotation"],
    ["QUOTATION.LINE_ADDED", "QuotationLine", "added a quotation line"],
    ["APPROVAL.APPROVE", "ApprovalStep", "approved a quotation review step"],
    ["APPROVAL.REJECT", "ApprovalStep", "rejected a quotation review step"],
    ["APPROVAL.RETURN", "ApprovalStep", "returned a quotation for revision"],
    ["PROPOSAL.APPLY", "NegotiationMessage", "applied a customer proposal"],
    ["ORDER.CREATED", "Order", "created an order"],
    ["SHIPMENT.DISPATCHED", "Shipment", "dispatched a shipment"],
    ["INVOICE.ISSUED", "Invoice", "issued an invoice"],
    ["PAYMENT.RECORDED", "Payment", "recorded a payment"],
    ["CREDIT.APPLIED", "CreditNote", "applied a credit note"],
    ["SUBSCRIPTION.PAUSED", "Subscription", "paused a subscription"],
    ["SUBSCRIPTION.RESUMED", "Subscription", "resumed a subscription"],
    [
      "BILLING.FAILED",
      "Subscription",
      "recorded a subscription billing failure",
    ],
    ["ALERT.CREATED", "DealHealthAlert", "flagged a deal health alert"],
    ["ALERT.ESCALATE", "DealHealthAlert", "escalated a deal health alert"],
    [
      "ALERT.AUTO_RESOLVED",
      "DealHealthAlert",
      "automatically resolved a deal health alert",
    ],
    ["USER.ROLE_ASSIGNED", "User", "assigned an account role"],
  ])("formats %s", (action, entityType, phrase) => {
    expect(activitySentence({ action, entityType, actorType: "USER" })).toBe(
      `A team member ${phrase}.`,
    );
  });
  it.each([
    ["USER", true, "You"],
    ["USER", false, "A team member"],
    ["CUSTOMER", true, "A customer"],
    ["SYSTEM", true, "The system"],
    ["<script>secret</script>", false, "An actor"],
  ])("handles actor %s with self=%s", (actorType, isCurrentActor, subject) => {
    expect(
      activitySentence({
        action: "QUOTATION.CREATED",
        entityType: "Quotation",
        actorType,
        isCurrentActor,
        version: 3,
      }),
    ).toBe(`${subject} created a quotation (v3).`);
  });
  it.each([
    null,
    undefined,
    0,
    -1,
    1.5,
    Infinity,
    NaN,
    Number.MAX_SAFE_INTEGER + 1,
  ])("omits invalid version %s", (version) => {
    expect(
      activitySentence({
        action: "QUOTATION.CREATED",
        entityType: "Quotation",
        actorType: "USER",
        version,
      }),
    ).toBe("A team member created a quotation.");
  });
  it.each([
    "UNKNOWN.SECRET",
    "__proto__",
    "constructor",
    "<script>alert(1)</script>",
  ])("safely handles unknown action %s", (action) => {
    expect(
      activitySentence({
        action,
        entityType: "SecretEntity",
        actorType: "USER",
        version: 7,
      }),
    ).toBe("A team member updated a record.");
  });
  it("does not mislabel a mismatched entity or expose extra audit fields", () => {
    const row = {
      action: "PAYMENT.RECORDED",
      entityType: "User",
      actorType: "USER",
      before: { password: "secret" },
      reason: "private",
      actorId: "private-id",
      version: 1,
    };
    expect(activitySentence(row)).toBe("A team member updated a record.");
  });
});
