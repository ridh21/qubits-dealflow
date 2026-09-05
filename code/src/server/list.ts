import { z } from "zod";
import { ListParams } from "@/lib/zod-schemas/list";

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export type ParsedList<F> = ListParams & { filters: F };

/**
 * One contract for every list page: page/pageSize/sort/dir/q plus the page's
 * own filter schema. Unknown or malformed values fall back to defaults instead
 * of erroring, so a hand-edited URL can never 500 a screen.
 */
export function parseListParams<T extends z.ZodTypeAny>(
  sp: SearchParamsRecord,
  filters: T,
): ParsedList<z.infer<T>> {
  const base = ListParams.safeParse(sp);
  const parsedBase = base.success ? base.data : ListParams.parse({});
  const parsedFilters = filters.safeParse(sp);
  return {
    ...parsedBase,
    filters: (parsedFilters.success ? parsedFilters.data : filters.parse({})) as z.infer<T>,
  };
}

export interface Paginated<Row> {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function paginate<Row>(
  count: () => Promise<number>,
  rows: (skip: number, take: number) => Promise<Row[]>,
  p: { page: number; pageSize: number },
): Promise<Paginated<Row>> {
  const total = await count();
  const pageCount = Math.max(1, Math.ceil(total / p.pageSize));
  const page = Math.min(Math.max(1, p.page), pageCount);
  const data = await rows((page - 1) * p.pageSize, p.pageSize);
  return { rows: data, total, page, pageSize: p.pageSize, pageCount };
}

/** Safe orderBy: only whitelisted columns reach Prisma. */
export function orderByOf<T extends string>(
  sort: string | undefined,
  dir: "asc" | "desc",
  allowed: readonly T[],
  fallback: Record<string, "asc" | "desc">,
): Record<string, "asc" | "desc"> {
  if (sort && (allowed as readonly string[]).includes(sort)) return { [sort]: dir };
  return fallback;
}
