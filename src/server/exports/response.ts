import { ZodError } from "zod";
import { Forbidden, NotFound } from "@/domain/errors";
export function exportError(error: unknown) {
  if (error instanceof Forbidden)
    return Response.json({ error: "Forbidden" }, { status: 403 });
  if (error instanceof NotFound)
    return Response.json({ error: "Not found" }, { status: 404 });
  if (error instanceof ZodError)
    return Response.json(
      { error: error.issues[0]?.message ?? "Invalid filters" },
      { status: 400 },
    );
  console.error("Export failed", error);
  return Response.json({ error: "Unable to generate export" }, { status: 500 });
}
export function attachment(body: Uint8Array, type: string, filename: string) {
  return new Response(body as BodyInit, {
    headers: {
      "content-type": type,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
