import { NextRequest, NextResponse } from "next/server";

const ACCESS_TOKEN_COOKIE = "fb_access_token";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  // Anonymous account flows — must not redirect through login first.
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip Next internals and static files.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\.).*)"],
};

