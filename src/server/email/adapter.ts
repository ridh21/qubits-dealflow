import nodemailer from "nodemailer";

export interface OutgoingEmail {
  to: string;
  toName?: string | null;
  subject: string;
  text: string;
  html?: string | null;
}

let transport: nodemailer.Transporter | null = null;

/**
 * Explicit timeouts matter more than they look: without them nodemailer waits
 * on the OS default, so one unreachable SMTP host stalls the request that is
 * sending the mail. Pooling reuses an authenticated connection instead of
 * paying the TLS + AUTH handshake on every message.
 */
function getTransport() {
  if (transport) return transport;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transport;
}

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

/** Authenticates without sending, so setup problems surface as config errors. */
export async function verifyTransport(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const t = getTransport();
  if (!t) return { ok: false, error: "SMTP_HOST is not configured." };
  try {
    await t.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** SMTP when configured, otherwise log to the server console (dev). */
export async function sendEmail(email: OutgoingEmail): Promise<void> {
  const t = getTransport();
  if (!t) {
    console.info(`[email:dev] to=${email.to} subject=${email.subject}\n${email.text}`);
    return;
  }
  await t.sendMail({
    from: process.env.SMTP_FROM ?? process.env.EMAIL_FROM ?? "no-reply@dealflow360.app",
    to: email.toName ? `"${email.toName}" <${email.to}>` : email.to,
    subject: email.subject,
    text: email.text,
    html: email.html ?? undefined,
  });
}
