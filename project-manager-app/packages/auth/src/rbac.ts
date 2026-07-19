export const RBAC_DEFAULT_POLICY = "deny_by_default" as const;

export const rolePermissions: Record<string, string[]> = {
  CLIENT: [
    "jobs:read",
    "jobs:create",
    "jobs:archive",
    "jobs:restore",
    "bids:read",
    "bids:accept",
    "milestones:read",
    "milestones:create",
    "milestones:approve",
    "evidence:read",
    "evidence:write",
    "disputes:read",
    "disputes:create",
    "disputes:archive",
    "disputes:restore",
    "projects:read",
    "projects:financials:read",
    "projects:financials:write",
    "projects:status:update",
    "trust:read",
    "matching:read",
    "reservations:read",
    "reservations:accept",
    "reservations:release",
    "contracts:create",
    "contracts:read",
    "contracts:sign",
    "change-orders:read",
    "change-orders:approve",
    "ratings:read",
    "ratings:create",
    "org:read",
    "org:members:read",
    "users:read",
    "users:memberships:read",
    "notifications:read",
    "agents:run:create",
    "finance:read",
    "finance:write",
    "governance:read",
    "governance:vote",
    "governance:propose",
    "knowledge:read",
    "knowledge:write",
    "tools:read",
    "tools:run",
    "vision:read",
    "vision:run",
    "weather:read",
    "weather:write",
    "agro:read",
    "agro:write"
  ],
  PRO: [
    "jobs:read",
    "bids:read",
    "bids:create",
    "milestones:read",
    "milestones:submit",
    "evidence:read",
    "evidence:write",
    "disputes:read",
    "projects:read",
    "trust:read",
    "reservations:create",
    "reservations:read",
    "reservations:release",
    "contracts:read",
    "contracts:sign",
    "change-orders:read",
    "change-orders:create",
    "ratings:read",
    "ratings:create",
    "org:read",
    "org:members:read",
    "users:read",
    "users:memberships:read",
    "notifications:read",
    "finance:read",
    "finance:write",
    "field-ops:read",
    "field-ops:write",
    "projects:financials:read",
    "agents:run:worker",
    "agents:run:manage",
    "matching:read",
    "governance:read",
    "governance:vote",
    "governance:propose",
    "knowledge:read",
    "tools:read",
    "tools:run",
    "vision:read",
    "vision:run",
    "weather:read",
    "weather:write",
    "agro:read",
    "agro:write"
  ],
  WORKER: [
    "agents:run:worker",
    "agents:run:manage",
    "bids:read",
    "field-ops:read",
    "field-ops:write",
    "knowledge:read",
    "tools:read",
    "tools:run",
    "vision:read",
    "vision:run",
    "weather:read"
  ],
  EVENT_CONSUMER: [
    "domain-events:consume"
  ],
  OPS_ADMIN: [
    "jobs:read",
    "jobs:create",
    "jobs:archive",
    "jobs:restore",
    "bids:read",
    "bids:create",
    "bids:accept",
    "milestones:read",
    "milestones:create",
    "milestones:submit",
    "milestones:approve",
    "milestones:reject",
    "evidence:read",
    "evidence:write",
    "disputes:read",
    "disputes:create",
    "disputes:assign",
    "disputes:resolve",
    "disputes:archive",
    "disputes:restore",
    "projects:read",
    "projects:create",
    "projects:financials:read",
    "projects:financials:write",
    "projects:status:update",
    "trust:read",
    "matching:read",
    "reservations:create",
    "reservations:read",
    "reservations:accept",
    "reservations:release",
    "reservations:expire",
    "contracts:create",
    "contracts:read",
    "contracts:sign",
    "change-orders:read",
    "change-orders:create",
    "change-orders:approve",
    "ratings:read",
    "ratings:create",
    "org:read",
    "org:members:read",
    "users:read",
    "users:memberships:read",
    "users:verify",
    "users:status:update",
    "autonomy:runs:read",
    "autonomy:runs:create",
    "field-ops:read",
    "field-ops:write",
    "ops:audit:read",
    "ops:dashboard:read",
    "ops:dashboard:write",
    "ops:risk:read",
    "ops:alerts:ack",
    "ops:runbooks:execute",
    "ops:incidents:create",
    "domain-events:read",
    "domain-events:emit",
    "domain-events:replay",
    "communications:read",
    "communications:write",
    "communications:admin",
    "agents:run:create",
    "agents:run:retry",
    "agents:run:manage",
    "agents:run:worker",
    "notifications:read",
    "finance:read",
    "finance:write",
    "knowledge:read",
    "knowledge:write",
    "tools:read",
    "tools:run",
    "vision:read",
    "vision:run",
    "weather:read",
    "weather:write",
    "agro:read",
    "agro:write",
    "satellites:admin"
  ],
  // Sesión demo pública (ui.demo-sandbox): SOLO agro, nada más — el aislamiento
  // del sandbox depende de que este set nunca crezca hacia jobs/payments/matching.
  DEMO_AGRO: [
    "agro:read",
    "agro:write"
  ]
};

const roleAliases: Record<string, string> = {
  ADMIN: "OPS_ADMIN",
  FIELD_WORKER: "WORKER",
  PROFESSIONAL: "PRO"
};

export type AppRole = "worker" | "client" | "admin";

export function normalizeRoles(roles: readonly string[]): string[] {
  return Array.from(
    new Set(
      roles
        .map((role) => role.trim())
        .filter(Boolean)
        .map((role) => roleAliases[role] ?? role)
    )
  );
}

export function getPermissionsForRoles(roles: readonly string[]): string[] {
  return Array.from(new Set(normalizeRoles(roles).flatMap((role) => rolePermissions[role] ?? [])));
}

export function hasPermission(roles: readonly string[], permission: string): boolean {
  return getPermissionsForRoles(roles).includes(permission);
}

export function appRoleFromRoles(roles: readonly string[]): AppRole {
  const normalizedRoles = normalizeRoles(roles);

  if (normalizedRoles.includes("OPS_ADMIN")) {
    return "admin";
  }

  if (normalizedRoles.includes("WORKER") || normalizedRoles.includes("PRO")) {
    return "worker";
  }

  return "client";
}

export function appRoleFromPathname(pathname: string): AppRole {
  if (pathname.startsWith("/worker")) return "worker";
  if (pathname.startsWith("/admin")) return "admin";
  return "client";
}

export function defaultDashboardForRole(role: AppRole): string {
  switch (role) {
    case "worker":
      return "/worker/dashboard";
    case "admin":
      return "/admin/dashboard";
    default:
      return "/client/dashboard";
  }
}
