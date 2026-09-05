"use server";

import { AuthError } from "next-auth";
import { LoginInput, SignupInput, PortalLoginInput } from "@/lib/zod-schemas/auth";
import { signupInternalUser } from "@/server/services/auth.service";
import { internalSignIn, internalSignOut, portalSignIn, portalSignOut } from "@/server/auth";
import { issuePortalLink } from "@/server/auth/portal-links";
import { toActionError, type ActionResult } from "@/domain/errors";
import { sendQueuedEmails } from "@/server/email/outbox";

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
): Promise<ActionResult<{ devLink: string | null }>> {
  const parsed = PortalLoginInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: parsed.error.issues[0]?.message ?? "Check the form." },
    };
  }
  try {
    const result = await issuePortalLink(parsed.data.email);
    // Deliver immediately so the customer is not waiting on the outbox job.
    await sendQueuedEmails(5);
    return { ok: true, data: { devLink: result.devLink } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function verifyPortalTokenAction(token: string): Promise<ActionResult<null>> {
  try {
    await portalSignIn("portal-link", { token, redirect: false });
    return { ok: true, data: null };
  } catch {
    return {
      ok: false,
      error: { code: "FORBIDDEN", message: "That link has expired. Request a new one." },
    };
  }
}

export async function portalLogoutAction() {
  await portalSignOut({ redirectTo: "/portal/login" });
}
