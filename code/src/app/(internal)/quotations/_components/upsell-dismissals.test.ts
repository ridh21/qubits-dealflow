import { describe, expect, it, vi } from "vitest";
import {
  createUpsellDismissals,
  dismissedProductIds,
  upsellDismissalKey,
} from "./upsell-dismissals";
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
describe("upsell dismissals", () => {
  it("restores dismissals after remount but isolates quote and revision", () => {
    const local = storage();
    const key = upsellDismissalKey("q1", 3);
    expect(key).toBe("dismiss:q1:3");
    createUpsellDismissals(key, () => local).dismiss("dock");
    expect(
      dismissedProductIds(
        createUpsellDismissals(key, () => local).getSnapshot(),
      ),
    ).toEqual(["dock"]);
    expect(
      createUpsellDismissals(
        upsellDismissalKey("q1", 4),
        () => local,
      ).getSnapshot(),
    ).toBe("[]");
    expect(
      createUpsellDismissals(
        upsellDismissalKey("q2", 3),
        () => local,
      ).getSnapshot(),
    ).toBe("[]");
  });
  it.each(["broken JSON", "null", "{}", '"dock"'])(
    "ignores corrupt storage %s",
    (raw) => {
      expect(dismissedProductIds(raw)).toEqual([]);
    },
  );
  it("keeps only distinct valid IDs", () => {
    expect(
      dismissedProductIds(
        JSON.stringify(["dock", 4, null, {}, "", "dock", "x".repeat(101)]),
      ),
    ).toEqual(["dock"]);
  });
  it("continues in memory when storage access or writes fail", () => {
    for (const access of [
      () => {
        throw new Error("blocked");
      },
      () => ({
        getItem: () => "[]",
        setItem: () => {
          throw new Error("quota");
        },
      }),
      () => null,
    ]) {
      const store = createUpsellDismissals("dismiss:q:1", access);
      store.dismiss("dock");
      store.dismiss("dock");
      store.dismiss("care");
      expect(dismissedProductIds(store.getSnapshot())).toEqual([
        "dock",
        "care",
      ]);
    }
  });
  it("notifies subscribers and refreshes when another tab changes storage", () => {
    const local = storage(),
      store = createUpsellDismissals("key", () => local),
      listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.dismiss("dock");
    local.setItem("key", '["care"]');
    store.refresh();
    expect(dismissedProductIds(store.getSnapshot())).toEqual(["care"]);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.dismiss("dock");
    expect(listener).toHaveBeenCalledTimes(2);
  });
  it("does not access storage for SSR and returns stable snapshot values", () => {
    const access = vi.fn(() => storage());
    const store = createUpsellDismissals("key", access);
    expect(store.getServerSnapshot()).toBe("[]");
    expect(access).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });
});
