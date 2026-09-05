export function dateLabel(value: Date | string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(value))
    : "—";
}
export function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}
