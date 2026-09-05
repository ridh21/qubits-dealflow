import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/server/db";
import { consumePortalToken } from "./consume-portal-token";
import { verifyPassword } from "./password";

export const INTERNAL_ROLES = [
  "ADMIN",
  "SALES_REP",
  "SALES_MANAGER",
  "FINANCE",
] as const;
export type InternalRole = (typeof INTERNAL_ROLES)[number];

const EIGHT_HOURS = 60 * 60 * 8;
const TWENTY_FOUR_HOURS = 60 * 60 * 24;

/**
 * Two separate Auth.js instances share this shape but never share a cookie:
 * internal staff sign in with a password, customers with a magic link.
 */
export function buildAuthConfig(kind: "internal" | "portal"): NextAuthConfig {
  const isPortal = kind === "portal";

  return {
    trustHost: true,
    basePath: isPortal ? "/api/portal-auth" : "/api/auth",
    secret: process.env.AUTH_SECRET,
    session: {
      strategy: "jwt",
      maxAge: isPortal ? TWENTY_FOUR_HOURS : EIGHT_HOURS,
    },
    pages: { signIn: isPortal ? "/portal/login" : "/login" },
    cookies: {
      sessionToken: {
        name: isPortal ? "df360.portal-session" : "df360.internal-session",
        options: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: process.env.NODE_ENV === "production",
        },
      },
    },
    providers: isPortal
      ? [
          Credentials({
            id: "portal-link",
            name: "Magic link",
            credentials: { token: { label: "Token", type: "text" } },
            async authorize(raw) {
              const token = typeof raw?.token === "string" ? raw.token : null;
              if (!token) return null;

              const email = await consumePortalToken(token);
              if (!email) return null;

              const user = await prisma.user.findUnique({
                where: { email },
              });
              if (!user || user.role !== "CUSTOMER" || !user.isActive)
                return null;

              await prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() },
              });
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                teamId: user.teamId,
                customerId: user.customerId,
              };
            },
          }),
        ]
      : [
          Credentials({
            id: "credentials",
            name: "Email and password",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            async authorize(raw) {
              const email =
                typeof raw?.email === "string"
                  ? raw.email.toLowerCase().trim()
                  : null;
              const password =
                typeof raw?.password === "string" ? raw.password : null;
              if (!email || !password) return null;

              const user = await prisma.user.findUnique({ where: { email } });
              if (!user?.passwordHash) return null;
              if (!(await verifyPassword(password, user.passwordHash)))
                return null;
              if (user.role === "PENDING" || !user.isActive) {
                throw new Error("Account awaiting admin approval");
              }
              if (user.role === "CUSTOMER") return null;

              await prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() },
              });
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                teamId: user.teamId,
                customerId: user.customerId,
              };
            },
          }),
        ],
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.uid = user.id;
          token.role = (user as { role?: string }).role;
          token.teamId = (user as { teamId?: string | null }).teamId ?? null;
          token.customerId =
            (user as { customerId?: string | null }).customerId ?? null;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = String(token.uid ?? "");
          session.user.role = String(token.role ?? "");
          session.user.teamId = (token.teamId as string | null) ?? null;
          session.user.customerId = (token.customerId as string | null) ?? null;
        }
        return session;
      },
    },
  };
}
