import { prisma } from "@/server/db";
import { getPortalUser } from "@/server/auth/guards";
import { issuePortalLink } from "@/server/auth/portal-links";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token))
    return new Response("Share link unavailable", { status: 404 });
  const quote = await prisma.quotation.findUnique({
    where: { portalToken: token },
    select: {
      id: true,
      customerId: true,
      validUntil: true,
      sentAt: true,
      status: true,
    },
  });
  if (
    !quote?.sentAt ||
    quote.status === "CANCELLED" ||
    (quote.validUntil && quote.validUntil < new Date())
  )
    return new Response("Share link unavailable or expired", { status: 404 });
  const actor = await getPortalUser();
  if (actor?.role === "CUSTOMER" && actor.customerId === quote.customerId)
    return Response.redirect(
      new URL(`/portal/quotations/${quote.id}`, request.url),
    );
  // The share token never grants an authenticated session. Send a single-use
  // login token to verified contacts; never expose it to the link visitor.
  const contacts = await prisma.user.findMany({
    where: { customerId: quote.customerId, role: "CUSTOMER", isActive: true },
    select: { email: true },
  });
  for (const contact of contacts) {
    try {
      await issuePortalLink(contact.email);
    } catch {
      /* Rate-limited visitors receive the same neutral redirect. */
    }
  }
  return Response.redirect(new URL("/portal/login?shared=1", request.url));
}
