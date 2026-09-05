import nodemailer from "nodemailer";

export interface OutgoingEmail {
  to: string;
  toName?: string | null;
  subject: string;
  text: string;
  html?: string | null;
}

let transport: nodemailer.Transporter | null = null;

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
  });
  return transport;
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
