type Quote = { ownerId: string; status: string };
type Actor = { id: string; role: string };
export function canManageQuotation(quote: Quote, actor: Actor) {
  return (
    actor.role === "ADMIN" ||
    actor.role === "SALES_MANAGER" ||
    (actor.role === "SALES_REP" && actor.id === quote.ownerId)
  );
}
export function canEditQuotation(quote: Quote, actor: Actor) {
  return (
    canManageQuotation(quote, actor) &&
    ["DRAFT", "REVISION_REQUESTED"].includes(quote.status)
  );
}
export function canReviseQuotation(quote: Quote, actor: Actor) {
  return (
    canManageQuotation(quote, actor) &&
    [
      "APPROVED",
      "SENT",
      "UNDER_NEGOTIATION",
      "PENDING_APPROVAL",
      "REJECTED",
      "REVISION_REQUESTED",
    ].includes(quote.status) &&
    (quote.status !== "PENDING_APPROVAL" || quote.ownerId === actor.id)
  );
}
