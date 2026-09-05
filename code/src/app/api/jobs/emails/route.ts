import { NextResponse } from "next/server";
import { sendQueuedEmails } from "@/server/email/outbox";

export async function POST(req: Request) {
  const secret = req.headers.get("x-jobs-secret") ?? new URL(req.url).searchParams.get("secret");
  if (!process.env.JOBS_SECRET || secret !== process.env.JOBS_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendQueuedEmails(50);
  return NextResponse.json({ ok: true, ...result });
}
