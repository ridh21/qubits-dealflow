/** Persist only product IDs, scoped to a quotation revision. */
export const upsellDismissalKey = (quoteId: string, version: number) =>
  `dismiss:${quoteId}:${version}`;

type StorageAccess = () => Pick<Storage, "getItem" | "setItem"> | null;

export function dismissedProductIds(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (id): id is string =>
                typeof id === "string" && id.length > 0 && id.length <= 100,
            ),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

export function createUpsellDismissals(key: string, storage: StorageAccess) {
  let memory: string | undefined;
  const listeners = new Set<() => void>();
  const getSnapshot = () => {
    if (memory !== undefined) return memory;
    try {
      return storage()?.getItem(key) ?? "[]";
    } catch {
      return "[]";
    }
  };
  return {
    getSnapshot,
    // The server and first hydration render agree, without reading browser APIs.
    getServerSnapshot: () => "[]",
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dismiss(productId: string) {
      memory = JSON.stringify([
        ...new Set([...dismissedProductIds(getSnapshot()), productId]),
      ]);
      try {
        storage()?.setItem(key, memory);
      } catch {
        /* Keep this visit usable when storage is blocked/full. */
      }
      listeners.forEach((listener) => listener());
    },
    refresh() {
      memory = undefined;
      listeners.forEach((listener) => listener());
    },
  };
}
