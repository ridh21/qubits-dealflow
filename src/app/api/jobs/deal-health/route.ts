import { authorizedJob } from "@/server/jobs/authorize";
import { runDetectors } from "@/server/services/deal-health.service";
import { expireQuotations } from "@/server/services/quotation.service";
export async function POST(request: Request) {
  if (!authorizedJob(request))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const expired = await expireQuotations(now);
  return Response.json({ expired, ...(await runDetectors(now)) });
}
export const GET = POST;
