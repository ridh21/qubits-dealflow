import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), run: vi.fn() }));
vi.mock("@/server/jobs/authorize", () => ({ authorizedJob: m.auth }));
vi.mock("@/server/services/billing-job", () => ({ runBilling: m.run }));
vi.mock("@/server/db", () => ({ prisma: {} }));
import { POST, GET } from "./route";
import { JobObservationError } from "@/server/services/job-observation.service";
beforeEach(() => { vi.resetAllMocks(); m.auth.mockReturnValue(true); });
describe("billing scheduler endpoint", () => {
  it("rejects unauthorized requests without invoking billing", async () => {
    m.auth.mockReturnValue(false);
    expect((await POST(new Request("http://localhost/api/jobs/billing"))).status).toBe(401);
    expect(m.run).not.toHaveBeenCalled();
  });
  it.each([ ["SUCCEEDED", 200], ["PARTIAL_FAILURE", 503], ["FAILED", 503] ])("returns %s with HTTP %s and correlation", async (status, http) => {
    m.run.mockResolvedValue({ status, runId: "run-id", failed: [] });
    const response = await GET(new Request("http://localhost/api/jobs/billing"));
    expect(response.status).toBe(http); expect(response.headers.get("x-correlation-id")).toBe("run-id");
    expect(m.run).toHaveBeenCalledWith(expect.any(Date), { trigger: "API" });
  });
  it("handles persistence failures without leaking exception details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.run.mockRejectedValue(new JobObservationError("correlation"));
    const response = await POST(new Request("http://localhost/api/jobs/billing"));
    expect(response.status).toBe(503); expect(response.headers.get("x-correlation-id")).toBe("correlation");
    m.run.mockRejectedValue(new Error("postgres://user:secret@host/db"));
    const unexpected = await POST(new Request("http://localhost/api/jobs/billing"));
    expect(JSON.stringify([await unexpected.json(), log.mock.calls])).not.toMatch(/postgres|secret@host/);
    log.mockRestore();
  });
});
