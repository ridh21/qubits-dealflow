import { DAY_MS, type HealthFinding } from "./types";
export interface StalledQuote {
  id: string;
  status: string;
  lastActivityAt: Date;
}
export function detectStalled(
  quotes: StalledQuote[],
  now: Date,
  stalledDays: number,
): HealthFinding[] {
  return quotes.flatMap((q) => {
    if (
      !["DRAFT", "REVISION_REQUESTED", "SENT", "UNDER_NEGOTIATION"].includes(
        q.status,
      )
    )
      return [];
    const idleDays = Math.floor(
      (now.getTime() - q.lastActivityAt.getTime()) / DAY_MS,
    );
    if (idleDays < stalledDays) return [];
    return [
      {
        type: "STALLED",
        quotationId: q.id,
        severity: idleDays >= 2 * stalledDays ? "HIGH" : "MEDIUM",
        detail: { idleDays, status: q.status, label: `Idle ${idleDays} days` },
      },
    ];
  });
}
