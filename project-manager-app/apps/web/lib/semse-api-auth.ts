export const PUBLIC_SEMSE_API_EXACT_PATHS = [
  "/api/semse/auth/forgot-password",
  "/api/semse/auth/login",
  "/api/semse/auth/register",
  "/api/semse/auth/reset-password",
  "/api/semse/auth/token",
  "/api/semse/healthz",
  "/api/semse/stats/public",
  "/api/semse/product-intelligence/ingest",
] as const;

export const PUBLIC_SEMSE_API_PREFIXES = ["/api/semse/public/"] as const;

export function isSemseApiPath(pathname: string): boolean {
  return pathname === "/api/semse" || pathname.startsWith("/api/semse/");
}

export function isPublicSemseApiPath(pathname: string): boolean {
  return (
    PUBLIC_SEMSE_API_EXACT_PATHS.includes(pathname as (typeof PUBLIC_SEMSE_API_EXACT_PATHS)[number]) ||
    PUBLIC_SEMSE_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export function buildSemseApiUnauthorizedBody(): { error: { status: 401; message: string } } {
  return {
    error: {
      status: 401,
      message: "Authentication required for SEMSE API route",
    },
  };
}
