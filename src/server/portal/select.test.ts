import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_PORTAL_KEYS,
  PORTAL_QUOTE_SELECT,
  PORTAL_ORDER_SELECT,
  PORTAL_INVOICE_SELECT,
  PORTAL_SUBSCRIPTION_SELECT,
  safeEntitlements,
} from "./select";
function keys(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...keys(child)]);
}
describe("portal disclosure boundary", () => {
  it.each([
    PORTAL_QUOTE_SELECT,
    PORTAL_ORDER_SELECT,
    PORTAL_INVOICE_SELECT,
    PORTAL_SUBSCRIPTION_SELECT,
  ])("excludes internal fields recursively", (select) => {
    const exposed = keys(select);
    for (const forbidden of FORBIDDEN_PORTAL_KEYS)
      expect(exposed).not.toContain(forbidden);
  });
  it("projects entitlement JSON to public display fields", () => {
    expect(
      safeEntitlements({
        costPriceMinor: 100,
        photos: {
          label: "Photos",
          value: 5,
          unit: "photos",
          per: "DAY",
          passwordHash: "secret",
        },
      }),
    ).toEqual([{ label: "Photos", value: "5", unit: "photos", per: "day" }]);
  });
});
