import { formatInTimeZone } from "date-fns-tz";

export function dateLabel(value: Date | string | null | undefined) {
  return value
    ? formatInTimeZone(new Date(value), "Asia/Kolkata", "d MMM yyyy")
    : "—";
}
export function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}
