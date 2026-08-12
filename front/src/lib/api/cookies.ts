import { cookies } from "next/headers";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/constants";

const ACCESS_MAX_AGE = 60 * 60; // 1h cushion vs the 30m token lifetime
const REFRESH_MAX_AGE = 60 * 60 * 24 * 14;

const baseOptions = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

/**
 * Writing cookies is only allowed inside a Server Action or Route Handler.
 * If we end up here from a Server Component (e.g. apiFetch refreshing on a
 * 401 during RSC render), Next throws — and that's fine: we still want the
 * fresh token in-memory for the current request, the persisted cookie can
 * wait until the next mutation. So we swallow that specific error type.
 */
function safeSet(name: string, value: string, maxAge: number) {
  try {
    cookies().set(name, value, { ...baseOptions, maxAge });
  } catch {
    // RSC context — leave the stale cookie. Middleware/next request handles it.
  }
}

export function setAuthCookies(tokens: { access: string; refresh: string }) {
  safeSet(ACCESS_TOKEN_COOKIE, tokens.access, ACCESS_MAX_AGE);
  safeSet(REFRESH_TOKEN_COOKIE, tokens.refresh, REFRESH_MAX_AGE);
}

export function clearAuthCookies() {
  try {
    const jar = cookies();
    jar.delete(ACCESS_TOKEN_COOKIE);
    jar.delete(REFRESH_TOKEN_COOKIE);
  } catch {
    // Same RSC-context guard as setAuthCookies.
  }
}

export function readAccessToken(): string | undefined {
  return cookies().get(ACCESS_TOKEN_COOKIE)?.value;
}

export function readRefreshToken(): string | undefined {
  return cookies().get(REFRESH_TOKEN_COOKIE)?.value;
}
