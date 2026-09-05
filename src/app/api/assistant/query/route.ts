import { z } from "zod";
import { requireInternal } from "@/server/auth/guards";
import { ask, AssistantUnavailable } from "@/server/assistant/client";

/**
 * Ask the read-only assistant a question.
 *
 * This handler is the only way into the agent from a browser: it proves the
 * caller holds an internal session before forwarding anything. The agent itself
 * can only SELECT, so the worst a signed-in user can do here is read data the
 * app would show them anyway.
 */

const Body = z.object({ question: z.string().trim().min(1).max(500) });

export async function POST(request: Request) {
  try {
    await requireInternal();
  } catch {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Ask a question first." }, { status: 400 });
  }

  try {
    return Response.json(await ask(parsed.data.question));
  } catch (error) {
    if (error instanceof AssistantUnavailable) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
