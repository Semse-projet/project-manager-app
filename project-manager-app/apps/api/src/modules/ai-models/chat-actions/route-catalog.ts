import { appRoleFromRoles, normalizeRoles, type AppRole } from "@semse/auth";

/**
 * Catálogo CERRADO de pantallas que el chat puede sugerir (spec `prometeo.chat-actions`, D3).
 * Cada destino declara su ruta por espacio de rol: una ruta que el actor no puede abrir no se le propone.
 * Todos los paths existen en `apps/web/app/(app)/` y no llevan parámetros.
 */
export type ChatRoute = {
  id: string;
  label: string;
  paths: Partial<Record<AppRole, string>>;
};

export const CHAT_ROUTE_CATALOG: readonly ChatRoute[] = [
  { id: "dashboard", label: "Panel principal", paths: { client: "/client/dashboard", worker: "/worker/dashboard", admin: "/admin/dashboard" } },
  { id: "projects", label: "Proyectos y trabajos", paths: { client: "/client/jobs", worker: "/worker/jobs", admin: "/admin/ops" } },
  { id: "payments", label: "Pagos", paths: { client: "/client/payments", worker: "/worker/payments", admin: "/admin/finance" } },
  { id: "profile", label: "Perfil y cuenta", paths: { client: "/client/account", worker: "/worker/profile", admin: "/admin/account" } },
  { id: "disputes", label: "Disputas", paths: { admin: "/admin/disputes" } },
  { id: "evidence", label: "Evidencias", paths: { worker: "/worker/evidence" } },
  { id: "milestones", label: "Hitos", paths: { client: "/client/milestones" } },
];

export type ResolvedChatRoute = { id: string; label: string; path: string };

function roleOf(roles: readonly string[]): AppRole | null {
  return normalizeRoles(roles).length === 0 ? null : appRoleFromRoles(roles);
}

/** Rutas que el actor puede abrir, según su rol; sin rol conocido, ninguna. */
export function resolveRoutesFor(roles: readonly string[]): ResolvedChatRoute[] {
  const role = roleOf(roles);
  if (!role) return [];
  return CHAT_ROUTE_CATALOG.flatMap((route) => {
    const path = route.paths[role];
    return path ? [{ id: route.id, label: route.label, path }] : [];
  });
}

/** Una ruta del catálogo para este actor, o `null` si no existe o no le corresponde. */
export function resolveChatRoute(id: string, roles: readonly string[]): ResolvedChatRoute | null {
  return resolveRoutesFor(roles).find((route) => route.id === id) ?? null;
}
