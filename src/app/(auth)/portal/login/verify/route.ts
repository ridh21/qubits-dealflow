import { NextResponse, type NextRequest } from "next/server";
import { portalSignIn } from "@/server/auth";
import { peekPortalToken } from "@/server/auth/consume-portal-token";

/**
 * Magic-link verification must be a Route Handler, not a page: signing in
 * writes the portal session cookie, and cookies are read-only while a Server
 * Component renders. Verifying during render threw on the cookie write *after*
 * the token had already been consumed, which surfaced every valid link as
 * "expired" and burned it in the process.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const back = (reason: string) =>
    NextResponse.redirect(new URL(`/portal/login?reason=${reason}`, request.url));

  // Classified before consuming so an expired link is not reported as unknown.
  const state = await peekPortalToken(token);
  if (state !== "VALID") return back(state.toLowerCase());

  try {
    await portalSignIn("portal-link", { token, redirect: false });
  } catch {
    // The token is single-use, so a failure here has already spent it.
    return back("failed");
  }

  return NextResponse.redirect(new URL("/portal", request.url));
}
