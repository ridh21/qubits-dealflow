import { formatInTimeZone } from "date-fns-tz";

/**
 * The platform renders every user-facing timestamp in IST regardless of the
 * viewer's browser timezone. Server timestamps are UTC instants; these helpers
 * pin the display wall clock to Asia/Kolkata.
 */
export const IST_TIMEZONE = "Asia/Kolkata";

/** "2026-09-05 23:14 IST" — audit trails, job runs, outbox rows. */
export function formatDateTimeIST(date: Date | string): string {
  return formatInTimeZone(
    typeof date === "string" ? new Date(date) : date,
    IST_TIMEZONE,
    "yyyy-MM-dd HH:mm 'IST'",
  );
}

/** "5 Oct 2026" — validity windows, promised delivery, ETAs. */
export function formatDateIST(date: Date | string): string {
  return formatInTimeZone(
    typeof date === "string" ? new Date(date) : date,
    IST_TIMEZONE,
    "d MMM yyyy",
  );
}
