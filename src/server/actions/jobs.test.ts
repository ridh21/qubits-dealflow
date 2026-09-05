import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ admin: vi.fn(), get: vi.fn(), run: vi.fn(), refresh: vi.fn() }));
vi.mock("@/server/auth/guards", () => ({ requireAdmin: m.admin }));
vi.mock("@/server/queries/jobs", () => ({ getBillingRun: m.get }));
vi.mock("@/server/services/billing-job", () => ({ runBilling: m.run }));
vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
import { retryBillingRunAction } from "./jobs";
import { Forbidden } from "@/domain/errors";
const id = "ca756554-a4a2-4f16-94ea-7d131f1e3ee7";
beforeEach(() => {
  vi.resetAllMocks(); m.admin.mockResolvedValue({ id: "admin" });
  m.get.mockResolvedValue({ runId: id, canRetry: true, asOf: "2035-09-01T00:00:00.000Z" });
  m.run.mockResolvedValue({ runId: "new-run", status: "SUCCEEDED" });
});
describe("admin retry boundary", () => {
  it("reuses the durable cutoff and records actor and parent correlation", async () => {
    expect(await retryBillingRunAction({ runId: id })).toMatchObject({ ok: true, data: { runId: "new-run" } });
    expect(m.run).toHaveBeenCalledWith(new Date("2035-09-01"), { trigger: "ADMIN_RETRY", actorId: "admin", retryOf: id });
    expect(m.refresh).toHaveBeenCalledWith("/admin/jobs");
  });
  it("denies unauthorized callers before reading or running a job", async () => {
    m.admin.mockRejectedValue(new Forbidden());
    expect(await retryBillingRunAction({ runId: id })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(m.get).not.toHaveBeenCalled(); expect(m.run).not.toHaveBeenCalled();
  });
  it("rejects browser-supplied dates, invalid IDs and non-retryable runs", async () => {
    expect(await retryBillingRunAction({ runId: id, asOf: "2099-01-01" })).toMatchObject({ ok: false });
    expect(await retryBillingRunAction({ runId: "invalid" })).toMatchObject({ ok: false });
    m.get.mockResolvedValue({ runId: id, canRetry: false, asOf: "2035-09-01" });
    expect(await retryBillingRunAction({ runId: id })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(m.run).not.toHaveBeenCalled();
  });
  it("does not expose unexpected exception messages in logs or responses", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.run.mockRejectedValue(new Error("postgres://user:secret@host/db"));
    const result = await retryBillingRunAction({ runId: id });
    expect(JSON.stringify([result, log.mock.calls])).not.toMatch(/postgres|secret@host/);
    expect(result).toMatchObject({ ok: false, error: { code: "UNEXPECTED" } });
    log.mockRestore();
  });
});
