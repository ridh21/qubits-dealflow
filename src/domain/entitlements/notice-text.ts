import type { Change } from "./diff";
import type { Interval } from "./effective";
import { assertDate } from "../proration/period";

export interface NoticeInput {
  productName: string;
  tierName: string;
  interval: Interval | null;
  changes: readonly Change[];
  customerName: string;
  nextBoundary: Date;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
function display(value: unknown): string {
  return value == null
    ? "not set"
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : String(value);
}

export function renderNotice(input: NoticeInput): {
  subject: string;
  text: string;
  html: string;
} {
  assertDate(input.nextBoundary);
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(input.nextBoundary);
  const subject = `Changes to your ${input.productName} ${input.tierName} plan from your next billing cycle`;
  const lines = input.changes.map(
    (change) =>
      `${change.label}: now ${display(change.after)} instead of ${display(change.before)} (from ${date})`,
  );
  const greeting = `Hello ${input.customerName},`;
  return {
    subject,
    text: [greeting, subject, ...lines].join("\n\n"),
    html: `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(subject)}</p><ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`,
  };
}
