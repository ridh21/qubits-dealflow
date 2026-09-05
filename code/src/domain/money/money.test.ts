import { describe, expect, it } from "vitest";
import { allocateProportional, pctOf, ratioBp } from "./money";

describe("money arithmetic", () => {
  it("rounds charges and credits half up", () => {
    expect(pctOf(15, 1000)).toBe(2);
    expect(pctOf(-15, 1000)).toBe(-2);
    expect(ratioBp(36900, 285000)).toBe(1295);
  });
  it("distributes residual cents deterministically", () => {
    expect(allocateProportional(1001, [1, 1, 1])).toEqual([334, 334, 333]);
    expect(allocateProportional(1, [2_000_000_001, 2_000_000_000])).toEqual([1, 0]);
  });
  it("conserves allocations including credits and zero weights", () => {
    for (const total of [-2147483647, -1001, -1, 0, 1, 1001, 2147483647]) {
      for (const weights of [[1, 1, 1], [0, 0], [0, 5, 3], [987654321, 123456789]]) {
        const allocations = allocateProportional(total, weights);
        expect(allocations.reduce((a, b) => a + b, 0)).toBe(total);
        expect(allocations.every(Number.isInteger)).toBe(true);
      }
    }
  });
});
