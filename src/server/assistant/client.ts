import "server-only";

/**
 * Server-side client for the read-only assistant microservice.
 *
 * The FastAPI service is bound to 127.0.0.1 and never reachable from a browser.
 * Everything goes through the route handlers in src/app/api/assistant, which
 * check the internal session first — so the assistant inherits the app's auth
 * instead of having its own.
 */

const BASE_URL = process.env.ASSISTANT_URL ?? "http://127.0.0.1:8000";
const SERVICE_KEY = process.env.ASSISTANT_SERVICE_KEY ?? "";

/**
 * The upstream LLM can stall on a heavy question. Fail at 45s so the widget
 * shows a real message rather than spinning; the agent's own per-call timeout
 * is deliberately shorter, so this is the outer backstop.
 */
const TIMEOUT_MS = 45_000;

export class AssistantUnavailable extends Error {}

async function call<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(SERVICE_KEY ? { "x-assistant-key": SERVICE_KEY } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (cause) {
    throw new AssistantUnavailable(
      cause instanceof Error && cause.name === "TimeoutError"
        ? "The assistant took too long to answer."
        : "The assistant service is not running.",
      { cause },
    );
  }

  if (!response.ok) {
    throw new AssistantUnavailable(
      `The assistant service returned ${response.status}.`,
    );
  }
  return response.json() as Promise<T>;
}

export interface AssistantAnswer {
  answer: string;
  /** The SELECTs the agent actually ran, shown in the widget for transparency. */
  sql: string[];
}

export function ask(question: string) {
  return call<AssistantAnswer>("/query", { question });
}
