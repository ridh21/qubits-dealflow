import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db";
import { queueEmail } from "@/server/email/outbox";
import { renderEmail } from "@/server/email/render";
import { ValidationError } from "@/domain/errors";

const TTL_MINUTES = 15;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 5;

const attempts = new Map<string, number[]>();

function rateLimit(email: string) {
  const now = Date.now();
  const hits = (attempts.get(email) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    throw new ValidationError("Too many link requests. Try again in a few minutes.");
  }
  hits.push(now);
  attempts.set(email, hits);
}

/**
 * Always returns the same shape whether or not the address belongs to a portal
 * user, so the endpoint cannot be used to enumerate customers.
 */
export async function issuePortalLink(rawEmail: string) {
  const email = rawEmail.toLowerCase().trim();
  rateLimit(email);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== "CUSTOMER" || !user.isActive) {
    return { issued: false as const, devLink: null };
  }

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  const link = `${base}/portal/login/verify?token=${token}`;

  await prisma.$transaction(async (tx) => {
    await tx.verificationToken.deleteMany({ where: { identifier: email, purpose: "PORTAL_LOGIN" } });
    await tx.verificationToken.create({
      data: { identifier: email, token, expires, purpose: "PORTAL_LOGIN" },
    });
    const body = renderEmail({
      title: "Your DealFlow360 sign-in link",
      intro: `Hi ${user.name}, use the link below to open your customer portal. It expires in ${TTL_MINUTES} minutes.`,
      cta: { label: "Open my portal", href: link },
    });
    await queueEmail(tx, {
      to: email,
      toName: user.name,
      subject: "Your DealFlow360 sign-in link",
      text: body.text,
      html: body.html,
      relatedType: "USER",
      relatedId: user.id,
    });
  });

  return {
    issued: true as const,
    devLink: process.env.NODE_ENV === "production" ? null : link,
  };
}
