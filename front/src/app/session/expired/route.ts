import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ROUTES,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Dead-session escape hatch. A Server Component can't delete cookies, so when
 * the (app) layout gets a hard 401 (refresh token also dead) it redirects
 * here. A Route Handler *can* clear cookies on the response — without this,
 * the stale cookies keep middleware bouncing /dashboard -> /login -> /dashboard
 * (ERR_TOO_MANY_REDIRECTS) until they expire days later.
 */
export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const url = new URL(ROUTES.LOGIN, request.url);
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    url.searchParams.set("next", next);
  }
  const res = NextResponse.redirect(url);
  res.cookies.delete(ACCESS_TOKEN_COOKIE);
  res.cookies.delete(REFRESH_TOKEN_COOKIE);
  return res;
}
