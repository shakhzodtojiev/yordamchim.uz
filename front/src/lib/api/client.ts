import "server-only";

import { API_BASE_URL } from "@/lib/constants";

import {
  readAccessToken,
  readRefreshToken,
  setAuthCookies,
} from "./cookies";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type RequestOptions = RequestInit & {
  /** Skip injecting the Bearer token (used for /auth/login etc.) */
  anonymous?: boolean;
  /** Next.js fetch caching options */
  next?: NextFetchRequestConfig;
};

async function refreshAccessToken(): Promise<string | null> {
  const refresh = readRefreshToken();
  if (!refresh) return null;

  const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access: string; refresh?: string };
  setAuthCookies({ access: json.access, refresh: json.refresh ?? refresh });
  return json.access;
}

/**
 * Server-side fetch helper. Adds Authorization, transparently retries once
 * after refreshing the access token on 401, and converts non-2xx into ApiError.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const buildHeaders = (token?: string): HeadersInit => {
    const headers = new Headers(options.headers);
    const isFormData =
      typeof FormData !== "undefined" && options.body instanceof FormData;
    if (!headers.has("Content-Type") && !isFormData) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("Accept", "application/json");
    if (token && !options.anonymous) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  };

  let token = options.anonymous ? undefined : readAccessToken();
  let response = await fetch(url, {
    ...options,
    headers: buildHeaders(token),
    cache: options.cache ?? "no-store",
  });

  if (response.status === 401 && !options.anonymous) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await fetch(url, {
        ...options,
        headers: buildHeaders(newToken),
        cache: options.cache ?? "no-store",
      });
    }
  }

  if (!response.ok) {
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      // ignore — non-JSON error body
    }
    const message =
      (data && typeof data === "object" && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : null) ??
      `Request failed: ${response.status} ${response.statusText}`;
    throw new ApiError(response.status, message, data);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as unknown as T;
}
