import { describe, expect, it } from "vitest";
import {
  InvalidResume,
  nextTransitions,
  planPause,
  validateResume,
} from "./pause-resume";
const d = (value: string) => new Date(value);
const now = d("2026-09-15");
const sub = {
  status: "ACTIVE",
  billingAnchor: d("2026-09-01"),
  currentPeriodEnd: d("2026-10-01"),
  plan: { interval: "MONTHLY" },
} as const;
const resume = {
  billingAnchor: sub.billingAnchor,
  interval: "MONTHLY",
  pauseEffectiveAt: sub.currentPeriodEnd,
} as const;
describe("pause and resume", () => {
  it("pauses at period end and snaps resumes to a later boundary", () => {
    expect(planPause(sub, now)).toEqual({ pauseEffectiveAt: d("2026-10-01") });
    expect(validateResume(resume, d("2026-12-01"), now)).toEqual({
      resumeAt: d("2026-12-01"),
      adjusted: false,
    });
    expect(validateResume(resume, d("2026-11-15"), now)).toEqual({
      resumeAt: d("2026-12-01"),
      adjusted: true,
    });
  });
  it("requires a full paused cycle and returns six eligible dates", () => {
    try {
      validateResume(resume, d("2026-10-01"), now);
      expect.fail("Expected invalid resume");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidResume);
      expect((error as InvalidResume).eligible).toEqual(
        [
          "2026-11-01",
          "2026-12-01",
          "2027-01-01",
          "2027-02-01",
          "2027-03-01",
          "2027-04-01",
        ].map(d),
      );
    }
    expect(() =>
      validateResume(resume, d("2026-11-15"), d("2026-11-20")),
    ).toThrow(InvalidResume);
    expect(() => validateResume(resume, now, now)).toThrow(InvalidResume);
  });
  it("rejects inactive, missing, stale or off-anchor periods", () => {
    for (const status of ["SCHEDULED", "PAUSED", "CANCELLED"] as const)
      expect(() => planPause({ ...sub, status }, now)).toThrow();
    expect(() => planPause({ ...sub, currentPeriodEnd: null }, now)).toThrow();
    expect(() => planPause(sub, d("2026-10-02"))).toThrow();
    expect(() =>
      planPause({ ...sub, currentPeriodEnd: d("2026-10-02") }, now),
    ).toThrow();
  });
  it("handles due boundaries, catch-up and cancellation precedence", () => {
    const scheduled = {
      status: "PAUSE_SCHEDULED",
      pauseEffectiveAt: d("2026-10-01"),
      resumeAt: d("2026-12-01"),
    } as const;
    expect(nextTransitions(scheduled, now)).toEqual([]);
    expect(nextTransitions(scheduled, d("2026-10-01"))).toEqual(["PAUSE"]);
    expect(
      nextTransitions({ ...scheduled, status: "PAUSED" }, d("2026-11-01")),
    ).toEqual([]);
    expect(
      nextTransitions({ ...scheduled, status: "PAUSED" }, d("2026-12-01")),
    ).toEqual(["RESUME"]);
    expect(nextTransitions(scheduled, d("2026-12-01"))).toEqual([
      "PAUSE",
      "RESUME",
    ]);
    expect(
      nextTransitions(
        { ...scheduled, cancelEffectiveAt: d("2026-12-01") },
        d("2026-12-01"),
      ),
    ).toEqual(["CANCEL_AT_BOUNDARY"]);
    expect(
      nextTransitions({ ...scheduled, status: "CANCELLED" }, d("2026-12-01")),
    ).toEqual([]);
    expect(nextTransitions({ status: "ACTIVE" }, d("2026-12-01"))).toEqual([]);
  });
});
