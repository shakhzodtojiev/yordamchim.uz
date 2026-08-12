export const ROUTES = {
  LOGIN: "/login",
  REGISTER: "/register",
  DASHBOARD: "/dashboard",
  PRESENTATIONS: "/presentations",
  COURSES: "/courses",
  TESTS: "/tests",
  WALLET: "/wallet",
  POOLS: "/admin/pools",
  LESSONS_ADMIN: "/admin/lessons",
  COURSES_ADMIN: "/admin/courses",
  OBJECTIONS: "/admin/objections",
  SETTINGS: "/settings",
} as const;

export const PUBLIC_ROUTES = new Set<string>([
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  "/",
]);

export const ACCESS_TOKEN_COOKIE = process.env.ACCESS_TOKEN_COOKIE ?? "uh_access";
export const REFRESH_TOKEN_COOKIE =
  process.env.REFRESH_TOKEN_COOKIE ?? "uh_refresh";

// Treat empty string the same as missing — a docker build that omits
// `--build-arg NEXT_PUBLIC_API_BASE_URL=...` bakes "" into the bundle,
// and `??` alone would happily prepend "" to every image URL, producing
// frontend-host-relative paths that 404.
const firstNonEmpty = (...values: (string | undefined)[]): string | undefined =>
  values.find((v) => v && v.trim().length > 0);

/** Internal/server-side base — Next.js server uses this to call Django. */
export const API_BASE_URL = (
  firstNonEmpty(
    process.env.API_BASE_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  ) ?? "http://localhost:8000"
).replace(/\/$/, "");

/** Public/browser-side base — used to prefix image/media URLs that the
 *  browser will request directly. In Docker this differs from API_BASE_URL,
 *  which uses the in-network service hostname. */
export const PUBLIC_API_BASE_URL = (
  firstNonEmpty(process.env.NEXT_PUBLIC_API_BASE_URL) ?? "http://localhost:8000"
).replace(/\/$/, "");

export const HISTORY_LIMIT = 5;

// Display-only mirror of backend settings (PRESENTATION_GENERATION_PRICE /
// PRESENTATION_DEFAULT_PRICE). The backend is authoritative and re-checks the
// real values on generate/purchase; these just drive labels + form defaults.
export const GENERATION_PRICE = 15000;
export const DEFAULT_SALE_PRICE = 5000;
