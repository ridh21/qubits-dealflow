import NextAuth from "next-auth";
import { buildAuthConfig } from "./config";

export const {
  handlers: internalHandlers,
  auth: internalAuth,
  signIn: internalSignIn,
  signOut: internalSignOut,
} = NextAuth(buildAuthConfig("internal"));

export const {
  handlers: portalHandlers,
  auth: portalAuth,
  signIn: portalSignIn,
  signOut: portalSignOut,
} = NextAuth(buildAuthConfig("portal"));
