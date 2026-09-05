import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      teamId: string | null;
      customerId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    teamId?: string | null;
    customerId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: string;
    teamId?: string | null;
    customerId?: string | null;
  }
}
