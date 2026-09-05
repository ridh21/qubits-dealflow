import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { QuotationVersion } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/components/ui/sheet", () => {
  const container = ({ children }: { children: ReactNode }) =>
    createElement("div", null, children);
  return {
    Sheet: container,
    SheetContent: container,
    SheetHeader: container,
    SheetTitle: container,
    SheetDescription: container,
  };
});
import { VersionHistory } from "./version-history";
function version(
  n: number,
  snapshot: QuotationVersion["snapshot"],
): QuotationVersion {
  return {
    id: `v${n}`,
    quotationId: "quote",
    version: n,
    snapshot,
    termsHash: "hash",
    policyVersionId: null,
    riskMetrics: null,
    requiredLevel: 0,
    createdById: "owner",
    createdByType: "USER",
    reason: "Saved terms",
    createdAt: new Date("2026-09-05Z"),
  };
}
const render = (versions: QuotationVersion[]) =>
  renderToStaticMarkup(
    createElement(VersionHistory, {
      versions,
      open: true,
      onOpenChange: () => {},
      actorNames: { owner: "J. Rao" },
    }),
  );
describe("version history drawer", () => {
  it("selects newest snapshot and compares previous recorded version across gaps", () => {
    const html = render([
      version(1, { currency: "USD", oneTimeNetMinor: 100 }),
      version(4, { currency: "USD", oneTimeNetMinor: 500 }),
    ]);
    expect(html).toContain("Compared with v1");
    expect(html).toContain("J. Rao");
    expect(html).toContain("USD $1.00");
    expect(html).toContain("USD $5.00");
    expect(html).toContain("2026-09-05 00:00");
  });
  it("shows an initial snapshot and escapes user-controlled text", () => {
    const html = render([
      version(1, {
        customerNote: "<script>private</script>",
        portalToken: "secret-token",
      }),
    ]);
    expect(html).toContain("Initial snapshot");
    expect(html).toContain("&lt;script&gt;private&lt;/script&gt;");
    expect(html).not.toContain("secret-token");
    expect(html).not.toContain("<script>private");
  });
  it("handles missing history and invalid snapshots explicitly", () => {
    expect(render([])).toContain("No saved versions yet");
    expect(render([version(1, null)])).toContain(
      "Snapshot data is unavailable",
    );
  });
});
