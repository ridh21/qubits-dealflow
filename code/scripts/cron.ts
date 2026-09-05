/** Run with: node --env-file=.env --import tsx scripts/cron.ts */
const origin = process.env.AUTH_URL ?? "http://localhost:3000";
const secret = process.env.JOBS_SECRET;
if (!secret) throw new Error("JOBS_SECRET is required to run local jobs.");

async function tick() {
  for (const job of ["billing", "emails"]) {
    try {
      const response = await fetch(new URL(`/api/jobs/${job}`, origin), {
        method: "POST",
        headers: { "x-jobs-secret": secret! },
        signal: AbortSignal.timeout(240_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      console.log(`${new Date().toISOString()} ${job}:`, await response.json());
    } catch (error) {
      console.error(
        `${job} failed:`,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }
}
// Await each run before scheduling the next; long billing runs never overlap.
async function run() {
  await tick();
  setTimeout(() => void run(), 5 * 60_000);
}
void run();
export {};
