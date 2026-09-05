import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizedJob } from "./authorize";
afterEach(() => vi.unstubAllEnvs());
describe("job authentication", () => {
  it("requires a configured secret in a header", () => {
    vi.stubEnv("JOBS_SECRET", "local-secret");
    vi.stubEnv("CRON_SECRET", "cron-secret");
    expect(
      authorizedJob(
        new Request("https://example.test/jobs?secret=local-secret"),
      ),
    ).toBe(false);
    expect(
      authorizedJob(
        new Request("https://example.test/jobs", {
          headers: { "x-jobs-secret": "local-secret" },
        }),
      ),
    ).toBe(true);
    expect(
      authorizedJob(
        new Request("https://example.test/jobs", {
          headers: { authorization: "Bearer cron-secret" },
        }),
      ),
    ).toBe(true);
    expect(
      authorizedJob(
        new Request("https://example.test/jobs", {
          headers: { authorization: "Bearer wrong" },
        }),
      ),
    ).toBe(false);
  });
  it("rejects requests when secrets are missing", () => {
    vi.stubEnv("JOBS_SECRET", "");
    vi.stubEnv("CRON_SECRET", "");
    expect(
      authorizedJob(
        new Request("https://example.test/jobs", {
          headers: { authorization: "Bearer undefined" },
        }),
      ),
    ).toBe(false);
  });
});
