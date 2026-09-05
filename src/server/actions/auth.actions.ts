"use server";

import { AuthError } from "next-auth";
import { LoginInput, SignupInput, PortalLoginInput } from "@/lib/zod-schemas/auth";
import { signupInternalUser } from "@/server/services/auth.service";
import { internalSignIn, internalSignOut, portalSignOut } from "@/server/auth";
import { issuePortalLink } from "@/server/auth/portal-links";
import { toActionError, type ActionResult } from "@/domain/errors";
import { sendQueuedEmail } from "@/server/email/outbox";

export async function signupAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ role: string }>> {
  const parsed = SignupInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: parsed.error.issues[0]?.message ?? "Check the form." },
    };
  }
  try {
    const user = await signupInternalUser(parsed.data);
    return { ok: true, data: { role: user.role } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function loginAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = LoginInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: parsed.error.issues[0]?.message ?? "Check the form." },
    };
  }
  const next = String(formData.get("next") ?? "") || "/dashboard";
  try {
    await internalSignIn("credentials", { ...parsed.data, redirect: false });
    return { ok: true, data: { redirectTo: next } };
  } catch (e) {
    if (e instanceof AuthError) {
      const message = e.cause?.err?.message ?? "";
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: message.includes("awaiting")
            ? "Account awaiting admin approval."
            : "Email or password is incorrect.",
        },
      };
    }
    return toActionError(e);
  }
}

export async function logoutAction() {
  await internalSignOut({ redirectTo: "/login" });
}

export async function requestPortalLinkAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ delivered: boolean }>> {
  const parsed = PortalLoginInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: parsed.error.issues[0]?.message ?? "Check the form." },
    };
  }
  try {
    const result = await issuePortalLink(parsed.data.email);
    // Send only this message. Draining the outbox here would make one
    // unreachable address delay every other customer's sign-in.
    const delivered = result.messageId
      ? await sendQueuedEmail(result.messageId)
      : false;
    return { ok: true, data: { delivered } };
  } catch (e) {
    return toActionError(e);
  }
}

// Magic-link verification lives in the /portal/login/verify route handler:
// signing in writes a cookie, which a Server Component render cannot do.

export async function portalLogoutAction() {
  await portalSignOut({ redirectTo: "/portal/login" });
}
