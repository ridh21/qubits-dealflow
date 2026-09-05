export interface PolicyDiff {
  path: string;
  before: unknown;
  after: unknown;
}
export function diffPolicy(
  before: unknown,
  after: unknown,
  path = "",
): PolicyDiff[] {
  if (Object.is(before, after)) return [];
  const object = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === "object";
  if (
    object(before) &&
    object(after) &&
    Array.isArray(before) === Array.isArray(after)
  ) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
      .flatMap((key) =>
        diffPolicy(before[key], after[key], path ? `${path}.${key}` : key),
      );
  }
  return [
    { path: path || "policy", before: before ?? null, after: after ?? null },
  ];
}
