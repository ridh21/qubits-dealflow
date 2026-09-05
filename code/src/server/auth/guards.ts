import { Forbidden } from "@/domain/errors";
import { internalAuth, portalAuth } from "./index";
import { INTERNAL_ROLES } from "./config";

export { INTERNAL_ROLES };

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
  teamId: string | null;
  customerId: string | null;
}

export async function getUser(): Promise<SessionUser | null> {
  const session = await internalAuth();
  return (session?.user as SessionUser | undefined) ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new Forbidden("Please sign in to continue.");
  return user;
}

export async function requireRole(roles: readonly string[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new Forbidden("Your role does not allow this action.", { role: user.role });
  }
  return user;
}

export async function requireInternal(): Promise<SessionUser> {
  return requireRole(INTERNAL_ROLES);
}

export async function requireAdmin(): Promise<SessionUser> {
  return requireRole(["ADMIN"]);
}

export async function getPortalUser(): Promise<SessionUser | null> {
  const session = await portalAuth();
  return (session?.user as SessionUser | undefined) ?? null;
}

export async function requirePortalCustomer(): Promise<SessionUser & { customerId: string }> {
  const user = await getPortalUser();
  if (!user || user.role !== "CUSTOMER" || !user.customerId) {
    throw new Forbidden("Please sign in to your customer portal.");
  }
  return user as SessionUser & { customerId: string };
}

/** Owner-or-role check used by quotation actions. */
export function assertOwnerOrRole(
  entityOwnerId: string,
  user: SessionUser,
  roles: readonly string[],
) {
  if (user.id === entityOwnerId) return;
  if (roles.includes(user.role)) return;
  throw new Forbidden("This record belongs to another owner.");
}
