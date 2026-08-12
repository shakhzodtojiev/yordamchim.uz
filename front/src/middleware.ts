import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_TOKEN_COOKIE,
  PUBLIC_ROUTES,
  REFRESH_TOKEN_COOKIE,
  ROUTES,
} from "@/lib/constants";

const STATIC_PREFIXES = ["/_next", "/favicon", "/icon", "/api/_"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    STATIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    pathname.match(/\.(svg|png|jpg|jpeg|webp|ico)$/i)
  ) {
    return NextResponse.next();
  }

  const access = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const hasSession = Boolean(access ?? refresh);
  const isPublic = PUBLIC_ROUTES.has(pathname);

  if (!hasSession && !isPublic) {
    const url = new URL(ROUTES.LOGIN, request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && (pathname === ROUTES.LOGIN || pathname === ROUTES.REGISTER)) {
    return NextResponse.redirect(new URL(ROUTES.DASHBOARD, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
