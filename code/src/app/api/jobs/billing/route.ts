import { authorizedJob } from "@/server/jobs/authorize";
import { runBilling } from "@/server/services/billing-job";
export async function POST(request: Request) {
  if (!authorizedJob(request))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await runBilling());
}
export const GET = POST;
