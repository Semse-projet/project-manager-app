import { matchesScope } from "./policy.js";

/**
 * Single source of truth for "this path touches something sensitive" — before
 * this file, patch-planner.ts and deployment-provider.ts each hand-typed an
 * identical 6-pattern CRITICAL_PATTERNS list, rollback-provider.ts had its
 * own narrower 3-pattern DATA_PATTERNS, and security-review-provider.ts had
 * a differently-shaped 13-rule SENSITIVE_PATTERNS — three lists that could
 * (and did) drift out of sync. See docs/reportes/forge_agent_harness_auditoria_2026-08-10.md.
 *
 * `leaseRequired` marks the categories that also need a Forge resource lease
 * (SEMSE_FORGE_AGENT_HARNESS.spec.md §9) — narrower than "worth a security
 * finding": e.g. an .env file is a secrets concern but not something two
 * concurrent tasks would race to write, so it isn't lease-worthy.
 */

export type SensitiveResourceCategory =
  | "schema"
  | "migrations"
  | "lockfiles"
  | "cicd"
  | "infra"
  | "database-package"
  | "auth-module"
  | "agent-runtime"
  | "payments-identity"
  | "secrets";

export type SensitiveResourceSeverity = "low" | "medium" | "high" | "critical";

export type SensitiveResourceRule = {
  rule: string;
  category: SensitiveResourceCategory;
  scope: string;
  severity: SensitiveResourceSeverity;
  message: string;
  leaseRequired: boolean;
};

export const SENSITIVE_RESOURCE_RULES: SensitiveResourceRule[] = [
  {
    rule: "security.env_file",
    category: "secrets",
    scope: "**/.env*",
    severity: "high",
    message: "Environment files detected in scope; may contain secrets.",
    leaseRequired: false
  },
  {
    rule: "security.credential_file",
    category: "secrets",
    scope: "**/*.key",
    severity: "critical",
    message: "Credential material detected in scope.",
    leaseRequired: false
  },
  {
    rule: "security.credential_file",
    category: "secrets",
    scope: "**/*.pem",
    severity: "critical",
    message: "Credential material detected in scope.",
    leaseRequired: false
  },
  {
    rule: "security.credential_file",
    category: "secrets",
    scope: "**/*.p12",
    severity: "critical",
    message: "Credential material detected in scope.",
    leaseRequired: false
  },
  {
    rule: "security.database_schema",
    category: "database-package",
    scope: "packages/db/prisma/**",
    severity: "high",
    message: "Database schema or migration changes require data governance review.",
    leaseRequired: false
  },
  {
    rule: "security.ci_workflow",
    category: "cicd",
    scope: ".github/workflows/**",
    severity: "medium",
    message: "CI workflow changes can affect supply chain and deployment pipeline.",
    leaseRequired: false
  },
  {
    rule: "security.infrastructure",
    category: "infra",
    scope: "**/railway.json",
    severity: "high",
    message: "Infrastructure configuration changes detected.",
    leaseRequired: true
  },
  {
    rule: "security.infrastructure",
    category: "infra",
    scope: "**/Dockerfile*",
    severity: "high",
    message: "Container build changes detected.",
    leaseRequired: true
  },
  {
    rule: "security.infrastructure",
    category: "infra",
    scope: "**/docker-compose*",
    severity: "high",
    message: "Container orchestration changes detected.",
    leaseRequired: false
  },
  {
    rule: "security.auth_module",
    category: "auth-module",
    scope: "packages/auth/**",
    severity: "critical",
    message: "Authentication module changes require security review.",
    leaseRequired: true
  },
  {
    rule: "security.agent_runtime",
    category: "agent-runtime",
    scope: "packages/agents/**",
    severity: "high",
    message: "Agent runtime changes can affect governed execution.",
    leaseRequired: false
  },
  {
    rule: "security.payment_or_identity",
    category: "payments-identity",
    scope: "packages/payments/**",
    severity: "critical",
    message: "Payment module changes require security and compliance review.",
    leaseRequired: true
  },
  {
    rule: "security.payment_or_identity",
    category: "payments-identity",
    scope: "**/identity*",
    severity: "critical",
    message: "Identity-related changes require security review.",
    leaseRequired: true
  },
  // Narrow data-file rules — distinct from the broader "database-package" rule
  // above (packages/db/prisma/**), which security-review-provider uses for
  // its finding. These are what patch-planner/deployment-provider's old
  // CRITICAL_PATTERNS and rollback-provider's old DATA_PATTERNS actually
  // matched on.
  {
    rule: "forge.critical_path.schema",
    category: "schema",
    scope: "packages/db/prisma/schema.prisma",
    severity: "critical",
    message: "Prisma schema changes require coordinated, exclusive access.",
    leaseRequired: true
  },
  {
    rule: "forge.critical_path.migrations",
    category: "migrations",
    scope: "packages/db/prisma/migrations/**",
    severity: "critical",
    message: "Migration changes require coordinated, exclusive access.",
    leaseRequired: true
  },
  {
    rule: "forge.critical_path.sql",
    category: "migrations",
    scope: "**/*.sql",
    severity: "high",
    message: "Raw SQL changes require coordinated, exclusive access.",
    leaseRequired: true
  },
  // New coverage: SEMSE_FORGE_AGENT_HARNESS.spec.md §9 lists lockfiles as a
  // lease-worthy resource; none of the 4 pre-existing lists covered them.
  {
    rule: "forge.critical_path.lockfile",
    category: "lockfiles",
    scope: "**/pnpm-lock.yaml",
    severity: "high",
    message: "Lockfile changes can affect reproducibility across the whole workspace.",
    leaseRequired: true
  }
];

export function matchingRules(path: string): SensitiveResourceRule[] {
  return SENSITIVE_RESOURCE_RULES.filter((entry) => matchesScope(path, entry.scope));
}

const CRITICAL_PATH_CATEGORIES: SensitiveResourceCategory[] = [
  "schema",
  "migrations",
  "cicd",
  "infra",
  "lockfiles"
];

/**
 * Drop-in replacement for patch-planner.ts / deployment-provider.ts's old
 * local isCriticalPath(). Matches their original 6 CRITICAL_PATTERNS exactly
 * (schema.prisma, migrations/**, CI workflows, railway.json, Dockerfile*,
 * docker-compose*) plus lockfiles and raw *.sql (new coverage, see above —
 * neither breaks any existing test, both are strict additions).
 */
export function isCriticalPath(path: string): boolean {
  return matchingRules(path).some((entry) => CRITICAL_PATH_CATEGORIES.includes(entry.category));
}

const DATA_CATEGORIES: SensitiveResourceCategory[] = ["schema", "migrations"];

/** Drop-in replacement for rollback-provider.ts's old local touchesDataFiles() check. */
export function isDataPath(path: string): boolean {
  return matchingRules(path).some((entry) => DATA_CATEGORIES.includes(entry.category));
}

/** Distinct, lease-required categories touched by a set of changed file paths — feeds ForgeLeaseService. */
export function categoriesForPaths(paths: string[]): Set<SensitiveResourceCategory> {
  const categories = new Set<SensitiveResourceCategory>();
  for (const path of paths) {
    for (const entry of matchingRules(path)) {
      if (entry.leaseRequired) categories.add(entry.category);
    }
  }
  return categories;
}
