import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  orderFind: vi.fn(), subFind: vi.fn(), subGet: vi.fn(), changes: vi.fn(), audit: vi.fn(),
  tx: vi.fn(), lock: vi.fn(), start: vi.fn(), issue: vi.fn(), regenerate: vi.fn(), process: vi.fn(),
}));
vi.mock("@/server/db", () => ({
  prisma: { order: { findMany: m.orderFind }, subscription: { findMany: m.subFind }, auditLog: { create: m.audit } },
  withTx: m.tx, lockRow: m.lock,
}));
vi.mock("./subscription-billing.service", () => ({
  startSubscriptionsForOrder: m.start, issuePeriod: m.issue, regenerateSchedule: m.regenerate,
}));
vi.mock("./pause-resume.service", () => ({ processOneTransition: m.process }));
import { runBilling } from "./billing-job";
import { JOB_STARTED, JOB_FINISHED, JOB_FAILURE, JobObservationError } from "./job-observation.service";

const now = new Date("2035-09-16T00:00:00Z");
const secret = "postgresql://private-user:super-secret@private-host/db?token=private-token";
let audits: Array<{ action: string; entityId: string; after: Record<string, unknown> }>;
let logs: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.resetAllMocks();
  logs = vi.spyOn(console, "error").mockImplementation(() => {});
  audits = [];
  m.orderFind.mockResolvedValue([]); m.subFind.mockResolvedValue([]);
  m.audit.mockImplementation(async ({ data }) => { audits.push(data); return data; });
  m.tx.mockImplementation(async (fn) => fn({
    subscription: { findUniqueOrThrow: m.subGet }, subscriptionTransition: { findMany: m.changes },
  }));
  m.start.mockResolvedValue(undefined); m.regenerate.mockResolvedValue(undefined);
  m.process.mockResolvedValue(false); m.changes.mockResolvedValue([]);
});
afterEach(() => { logs.mockRestore(); });
function billable() {
  let issued = false;
  m.subFind.mockResolvedValue([{ id: "good-sub" }]);
  m.subGet.mockImplementation(async () => ({
    id: "good-sub", status: "ACTIVE", nextBillingDate: issued ? new Date("2036-01-01") : now,
  }));
  m.issue.mockImplementation(async () => { issued = true; return { id: "invoice" }; });
}

describe("durable billing run observation", () => {
  it("records a successful start/outcome, correlation and committed counts", async () => {
    billable(); m.orderFind.mockResolvedValue([{ id: "order" }]);
    const result = await runBilling(now, { trigger: "API" });
    expect(result).toMatchObject({ status: "SUCCEEDED", ordersStarted: 1, invoices: 1, failed: [] });
    expect(audits.map((row) => row.action)).toEqual([JOB_STARTED, JOB_FINISHED]);
    expect(audits.every((row) => row.entityId === result.runId)).toBe(true);
    expect(audits[0].after).toMatchObject({ asOf: now.toISOString(), trigger: "API", retryOf: null });
    expect(audits[1].after).toMatchObject({ status: "SUCCEEDED", invoices: 1, failureCount: 0 });
  });
  it("continues after order-start and per-subscription failures without logging exception secrets", async () => {
    billable();
    const goodGet = m.subGet.getMockImplementation()!;
    m.subFind.mockResolvedValue([{ id: "bad-sub" }, { id: "good-sub" }]);
    m.subGet.mockImplementation((args) => args.where.id === "bad-sub"
      ? Promise.reject(Object.assign(new Error(secret), { code: "P1001" })) : goodGet(args));
    m.orderFind.mockResolvedValue([{ id: "bad-order" }, { id: "good-order" }]);
    m.start.mockImplementation(async (_tx, id) => { if (id === "bad-order") throw new Error(secret); });
    const result = await runBilling(now);
    expect(result).toMatchObject({ status: "PARTIAL_FAILURE", ordersStarted: 1, invoices: 1 });
    expect(result.failed.map((failure) => [failure.scope, failure.id])).toEqual([["ORDER", "bad-order"], ["SUBSCRIPTION", "bad-sub"]]);
    expect(audits.filter((row) => row.action === JOB_FAILURE)).toHaveLength(2);
    expect(logs.mock.calls.every(([line]: unknown[]) => JSON.parse(String(line)).correlationId === result.runId)).toBe(true);
    expect(JSON.stringify([audits, logs.mock.calls, result])).not.toMatch(/super-secret|private-user|private-host|private-token|postgresql/);
  });
  it("keeps processing if an individual failure audit fails and saves fallback details in the outcome", async () => {
    billable(); m.orderFind.mockResolvedValue([{ id: "bad-order" }]);
    m.start.mockRejectedValue(new Error(secret));
    m.audit.mockImplementation(async ({ data }) => {
      if (data.action === JOB_FAILURE) throw new Error(secret);
      audits.push(data); return data;
    });
    const result = await runBilling(now);
    expect(result).toMatchObject({ invoices: 1, observationFailures: 1, status: "PARTIAL_FAILURE" });
    expect(audits.at(-1)?.after).toMatchObject({ observationFailures: 1, failures: result.failed });
    expect(JSON.stringify(logs.mock.calls)).not.toContain(secret);
  });
  it("fails closed when the durable start cannot be saved", async () => {
    m.audit.mockRejectedValue(new Error(secret));
    await expect(runBilling(now)).rejects.toBeInstanceOf(JobObservationError);
    expect(m.orderFind).not.toHaveBeenCalled(); expect(m.tx).not.toHaveBeenCalled();
    expect(JSON.stringify(logs.mock.calls)).not.toContain(secret);
  });
  it("leaves the durable start visible and rejects when the completion cannot be saved", async () => {
    m.audit.mockImplementation(async ({ data }) => {
      if (data.action === JOB_FINISHED) throw new Error(secret);
      audits.push(data); return data;
    });
    const error = await runBilling(now).catch((caught) => caught);
    expect(error).toBeInstanceOf(JobObservationError);
    expect(audits.map((row) => row.action)).toEqual([JOB_STARTED]);
    expect(error.runId).toBe(audits[0].entityId);
  });
  it("records discovery failures and continues the independent discovery stage", async () => {
    billable(); m.orderFind.mockRejectedValue(new Error(secret));
    const result = await runBilling(now);
    expect(result).toMatchObject({ status: "FAILED", invoices: 1, failed: [{ scope: "ORDER_DISCOVERY" }] });
    expect(audits.at(-1)?.action).toBe(JOB_FINISHED);
  });
  it("records failed subscription discovery after successful order startup", async () => {
    m.orderFind.mockResolvedValue([{ id: "order" }]); m.subFind.mockRejectedValue(new Error(secret));
    expect(await runBilling(now)).toMatchObject({ status: "FAILED", ordersStarted: 1, failed: [{ scope: "SUBSCRIPTION_DISCOVERY" }] });
  });
  it("makes the catch-up cap visible while retaining progress for the next retry", async () => {
    billable();
    m.subGet.mockResolvedValue({ id: "good-sub", status: "ACTIVE", nextBillingDate: now });
    const result = await runBilling(now);
    expect(result).toMatchObject({ invoices: 120, status: "PARTIAL_FAILURE", failed: [{ code: "CATCH_UP_LIMIT" }] });
    expect(m.regenerate).toHaveBeenCalled();
    expect(audits.at(-1)?.after).toMatchObject({ invoices: 120 });
  });
  it("does not report a catch-up failure when exactly 120 events finish all due work", async () => {
    billable();
    let issued = 0;
    m.issue.mockImplementation(async () => { issued++; return { id: "invoice" }; });
    m.subGet.mockImplementation(async () => ({
      id: "good-sub", status: "ACTIVE", nextBillingDate: issued < 120 ? now : new Date("2036-01-01"),
    }));
    expect(await runBilling(now)).toMatchObject({ invoices: 120, status: "SUCCEEDED", failed: [] });
  });

});
