import type { AppRole } from "@semse/auth/rbac";

const LEGACY_ORPHAN_ROUTES = new Set(["/dashboard", "/field-ops"]);

export function isLegacyOrphanRoute(pathname: string): boolean {
  return LEGACY_ORPHAN_ROUTES.has(pathname);
}

export function resolveLegacyRouteRedirect(
  pathname: string,
  role: AppRole,
): string | null {
  if (pathname === "/dashboard") {
    if (role === "worker") return "/worker/dashboard";
    if (role === "admin") return "/admin/dashboard";
    return "/client/dashboard";
  }

  if (pathname === "/field-ops") {
    if (role === "worker") return "/worker/field-ops";
    if (role === "admin") return "/admin/field-ops";
    return "/client/dashboard";
  }

  return null;
}
