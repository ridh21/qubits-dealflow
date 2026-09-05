import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/domain/errors";
import { requireRole, type SessionUser } from "@/server/auth/guards";

/** A small shared boundary: authenticate, validate, mutate, then refresh. */
export async function runAction<S extends z.ZodType, T>(options: {
  roles: readonly string[];
  schema: S;
  input: unknown;
  execute: (actor: SessionUser, input: z.output<S>) => Promise<T>;
  paths?: readonly string[];
}): Promise<ActionResult<T>> {
  try {
    const actor = await requireRole(options.roles);
    const parsed = options.schema.safeParse(options.input instanceof FormData ? Object.fromEntries(options.input) : options.input);
    if (!parsed.success) return { ok: false, error: { code: "VALIDATION", message: parsed.error.issues[0]?.message ?? "Check the form fields." } };
    const data = await options.execute(actor, parsed.data);
    for (const path of options.paths ?? []) revalidatePath(path);
    return { ok: true, data };
  } catch (error) {
    return toActionError(error);
  }
}
