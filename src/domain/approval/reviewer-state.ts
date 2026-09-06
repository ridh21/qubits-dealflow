/**
 * What a pending review means *for the person looking at it*.
 *
 * The queue lists a request for two different reasons — because you have to act
 * on it, and because it concerns a quotation you own. Printing the routed role
 * alone conflates those, so a viewer cannot tell their own work from someone
 * else's at a glance.
 *
 * Owning the quotation does not disqualify you. The routed role is the control:
 * a sales manager clears the sales-manager step on their own high-discount
 * quote, and the deal then moves to finance, which they do not hold.
 */
export type ReviewerState =
  | { kind: "COMPLETE" }
  | { kind: "SUPERSEDED" }
  /** Routed to a role you hold (or you are an admin), so it is yours to decide. */
  | { kind: "NEEDS_YOU"; role: string }
  /** Someone else's to decide. */
  | { kind: "AWAITING"; role: string };

export function reviewerState(input: {
  pendingRole: string | null;
  requestVersion: number;
  quotationVersion: number;
  actor: { id: string; role: string };
}): ReviewerState {
  const { pendingRole, requestVersion, quotationVersion, actor } = input;
  if (!pendingRole) return { kind: "COMPLETE" };
  if (requestVersion !== quotationVersion) return { kind: "SUPERSEDED" };
  if (actor.role === "ADMIN" || actor.role === pendingRole)
    return { kind: "NEEDS_YOU", role: pendingRole };
  return { kind: "AWAITING", role: pendingRole };
}

const humanise = (role: string) => role.replaceAll("_", " ").toLowerCase();

export function reviewerStateLabel(state: ReviewerState): string {
  switch (state.kind) {
    case "COMPLETE":
      return "Complete";
    case "SUPERSEDED":
      return "Superseded";
    case "NEEDS_YOU":
      return "Needs your decision";
    case "AWAITING":
      return `Awaiting ${humanise(state.role)}`;
  }
}
