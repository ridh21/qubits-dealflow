import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ admin: vi.fn(), find: vi.fn() }));
vi.mock("@/server/auth/guards", () => ({ requireAdmin: m.admin }));
vi.mock("@/server/db", () => ({ prisma: { auditLog: { findMany: m.find } } }));
import { getBillingRun, listBillingRuns } from "./jobs";
import { JOB_STARTED, JOB_FINISHED, JOB_FAILURE } from "@/server/services/job-observation.service";
const id = "ca756554-a4a2-4f16-94ea-7d131f1e3ee7";
const start = { entityId: id, action: JOB_STARTED, createdAt: new Date("2035-09-01"), after: { asOf: "2035-09-01T00:00:00.000Z", trigger: "SYSTEM", retryOf: null } };
const failure = { id: "order-1", scope: "ORDER", code: "UNEXPECTED", message: "Needs investigation." };
const finish = { entityId: id, action: JOB_FINISHED, createdAt: new Date("2035-09-02"), after: {
  status: "PARTIAL_FAILURE", ordersStarted: 0, invoices: 0, transitions: 0,
  failureCount: 1, observationFailures: 1, failures: [failure],
} };
beforeEach(() => { vi.resetAllMocks(); m.admin.mockResolvedValue({ id: "admin" }); });
describe("admin billing history", () => {
  it("reads durable outcomes and fallback failures after a separate request", async () => {
    m.find.mockResolvedValue([finish, start]);
    expect(await getBillingRun(id)).toMatchObject({ runId: id, canRetry: true, status: "PARTIAL_FAILURE", failures: [failure] });
    expect(m.find).toHaveBeenCalledTimes(1);
  });
  it("exposes unfinished starts and their item failures without declaring success or permitting retry", async () => {
    m.find.mockResolvedValueOnce([start]).mockResolvedValueOnce([{ after: failure }]);
    expect(await getBillingRun(id)).toMatchObject({ status: "UNFINISHED", canRetry: false, failures: [failure] });
    expect(m.find.mock.calls[1][0].where.action).toBe(JOB_FAILURE);
  });
  it("does not trust malformed outcome payloads", async () => {
    m.find.mockResolvedValueOnce([{ ...finish, after: { status: "SUCCEEDED" } }, start]).mockResolvedValueOnce([]);
    expect(await getBillingRun(id)).toMatchObject({ status: "UNFINISHED", canRetry: false });
  });
  it("bounds list pagination and joins outcomes by correlation ID", async () => {
    m.find.mockResolvedValueOnce([start]).mockResolvedValueOnce([finish]);
    expect(await listBillingRuns(-2)).toMatchObject({ page: 1, hasNext: false, rows: [{ runId: id, status: "PARTIAL_FAILURE" }] });
    expect(m.find.mock.calls[0][0]).toMatchObject({ skip: 0, take: 21 });
  });
  it("requires admin before either query and rejects invalid identifiers", async () => {
    m.admin.mockRejectedValue(new Error("Forbidden"));
    await expect(listBillingRuns()).rejects.toThrow("Forbidden");
    await expect(getBillingRun(id)).rejects.toThrow("Forbidden");
    expect(m.find).not.toHaveBeenCalled();
    m.admin.mockResolvedValue({ id: "admin" });
    await expect(getBillingRun("invalid")).rejects.toThrow("not found");
    expect(m.find).not.toHaveBeenCalled();
  });
});
