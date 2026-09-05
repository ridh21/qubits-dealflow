import { sendQueuedEmails } from "@/server/email/outbox";
import { authorizedJob } from "@/server/jobs/authorize";
export async function POST(request: Request) {
  if (!authorizedJob(request))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await sendQueuedEmails(50));
}
export const GET = POST;
