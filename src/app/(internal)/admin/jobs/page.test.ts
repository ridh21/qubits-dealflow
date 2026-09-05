import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ admin: vi.fn(), list: vi.fn(), get: vi.fn(), retry: vi.fn() }));
vi.mock("@/server/auth/guards", () => ({ requireAdmin: m.admin }));
vi.mock("@/server/queries/jobs", () => ({ listBillingRuns: m.list, getBillingRun: m.get }));
vi.mock("@/server/actions/jobs", () => ({ retryBillingRunAction: m.retry }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));
vi.mock("@/components/layout/workspace-actions", () => ({
  WorkspaceActions: ({ children }: { children: ReactNode }) => createElement("aside", { "data-workspace-actions": true }, children),
}));
import JobsPage from "./page";
const run = {
  runId: "ca756554-a4a2-4f16-94ea-7d131f1e3ee7", startedAt: "2035-09-01T00:00:00Z",
  finishedAt: "2035-09-01T00:01:00Z", asOf: "2035-09-01T00:00:00Z", trigger: "API",
  status: "PARTIAL_FAILURE", canRetry: true, retryOf: null,
  outcome: { ordersStarted: 1, invoices: 2, transitions: 0, failureCount: 1, observationFailures: 0 },
  failures: [{ scope: "ORDER", id: "order-1", code: "CONFIGURATION", message: "Review billing policy." }],
};
beforeEach(() => {
  vi.resetAllMocks(); m.admin.mockResolvedValue({ id: "admin" });
  m.list.mockResolvedValue({ page: 1, hasNext: false, rows: [run] });
  m.get.mockResolvedValue(run);
});
describe("operational jobs page", () => {
  it("renders durable failure details, correlation and all buttons inside workspace actions without running billing", async () => {
    const html = renderToStaticMarkup(await JobsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Review billing policy."); expect(html).toContain(run.runId);
    expect(html).toContain("Retry selected run");
    const sidebar = html.slice(html.indexOf("<aside"), html.indexOf("</aside>"));
    expect(sidebar.match(/<button/g)).toHaveLength(2);
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(m.retry).not.toHaveBeenCalled();
  });
  it("shows an empty history with retry disabled", async () => {
    m.list.mockResolvedValue({ page: 1, hasNext: false, rows: [] });
    const html = renderToStaticMarkup(await JobsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("No billing runs have been recorded yet");
    expect(html).toContain('disabled=""'); expect(m.get).not.toHaveBeenCalled();
  });
  it("requires admin before loading operational data", async () => {
    m.admin.mockRejectedValue(new Error("Forbidden"));
    await expect(JobsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("Forbidden");
    expect(m.list).not.toHaveBeenCalled();
  });
});
