import { PrismaClient } from "@prisma/client";
import { softDeleteExtension } from "@/server/soft-delete";

/** Integration tests must explicitly opt into a disposable database. */
export function testDatabase() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url)
    throw new Error(
      "Set TEST_DATABASE_URL to a disposable PostgreSQL database.",
    );
  const parsed = new URL(url);
  if (
    !parsed.pathname.includes("test") &&
    !parsed.searchParams.get("schema")?.includes("test")
  ) {
    throw new Error("The test database name or schema must contain 'test'.");
  }
  // Extended like the app client so tests exercise the same soft-delete reads.
  return new PrismaClient({ datasources: { db: { url } } }).$extends(
    softDeleteExtension,
  );
}
