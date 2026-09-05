import { expect, it } from "vitest";
import { renderNotice } from "./notice-text";
it("renders an increase with UTC boundary and escapes untrusted HTML", () => {
  const notice = renderNotice({
    productName: "Photo App",
    tierName: "Pro",
    interval: null,
    customerName: "<script>alert('x')</script>",
    nextBoundary: new Date("2026-10-01T00:00:00Z"),
    changes: [
      {
        tierId: "pro",
        interval: "MONTHLY",
        key: "photos",
        label: "Photos per day",
        unit: "photos",
        per: "DAY",
        before: 5,
        after: 7,
      },
    ],
  });
  expect(notice.subject).toBe(
    "Changes to your Photo App Pro plan from your next billing cycle",
  );
  expect(notice.text).toContain(
    "Photos per day: now 7 instead of 5 (from 1 Oct 2026)",
  );
  expect(notice.html).not.toContain("<script>");
  expect(notice.html).toContain("&lt;script&gt;");
});
