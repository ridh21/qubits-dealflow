import { timingSafeEqual } from "node:crypto";

/** Local jobs use JOBS_SECRET; Vercel supplies CRON_SECRET as a bearer token. */
export function authorizedJob(request: Request) {
  const supplied =
    request.headers.get("x-jobs-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!supplied) return false;
  const actual = Buffer.from(supplied);
  return [process.env.JOBS_SECRET, process.env.CRON_SECRET].some((secret) => {
    if (!secret) return false;
    const expected = Buffer.from(secret);
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  });
}
