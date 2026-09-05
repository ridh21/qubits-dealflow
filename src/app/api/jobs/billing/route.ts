import { randomUUID } from "node:crypto";
import { authorizedJob } from "@/server/jobs/authorize";
import { runBilling } from "@/server/services/billing-job";
import { JobObservationError, logJobEvent } from "@/server/services/job-observation.service";
export async function POST(request: Request) {
  if (!authorizedJob(request))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await runBilling(new Date(), { trigger: "API" });
    return Response.json(result, {
      status: result.status === "SUCCEEDED" ? 200 : 503,
      headers: { "x-correlation-id": result.runId },
    });
  } catch (error) {
    const runId = error instanceof JobObservationError ? error.runId : randomUUID();
    logJobEvent("billing.request_failed", runId);
    return Response.json({ error: "Billing did not finish successfully. Check job history before retrying.", runId }, {
      status: 503, headers: { "x-correlation-id": runId },
    });
  }
}
export const GET = POST;
