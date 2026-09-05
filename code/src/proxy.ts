import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/pending",
  "/portal/login",
  "/portal/login/verify",
];

const INTERNAL_COOKIE = "df360.internal-session";
const PORTAL_COOKIE = "df360.portal-session";

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return pathname.startsWith("/portal/q/");
}

/**
 * Cookie presence only - the real role check happens in the server guards.
 * Middleware just keeps signed-out visitors off the app shells.
 */
export default function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/fonts") ||
    isPublic(pathname)
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/portal")) {
    if (!req.cookies.get(PORTAL_COOKIE)) {
      const url = req.nextUrl.clone();
      url.pathname = "/portal/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!req.cookies.get(INTERNAL_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts|.*\\.(?:png|jpg|svg|webp|woff2)$).*)"],
};
