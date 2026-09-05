import { spawnSync } from "node:child_process";

const url =
  process.env.TEST_DATABASE_URL ??
  "postgresql://dealflow:dealflow_test@127.0.0.1:55436/dealflow_test";
const parsed = new URL(url);
if (
  !parsed.pathname.includes("test") &&
  !parsed.searchParams.get("schema")?.includes("test")
) {
  throw new Error(
    "Use a disposable database name or schema containing 'test'.",
  );
}
const env = {
  ...process.env,
  TEST_DATABASE_URL: url,
  DATABASE_URL: url,
  DIRECT_URL: url,
};
for (const args of [
  ["exec", "prisma", "migrate", "deploy"],
  ["exec", "vitest", "run", ...process.argv.slice(2)],
]) {
  const result = spawnSync("pnpm", args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
