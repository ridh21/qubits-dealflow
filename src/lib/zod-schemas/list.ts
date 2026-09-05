import { z } from "zod";

export const ListParams = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
  sort: z.string().optional(),
  dir: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().trim().optional(),
});

export type ListParams = z.infer<typeof ListParams>;

/** `status=DRAFT&status=SENT` and `status=DRAFT` both parse to an array. */
export const csvArray = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => {
    if (v === undefined || v === "") return undefined;
    if (Array.isArray(v)) return v;
    return String(v).split(",").filter(Boolean);
  }, z.array(inner).optional());
