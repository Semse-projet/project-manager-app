// ─────────────────────────────────────────────────────────────────────────────
// @semse/shared — runtime utilities used across api, web and worker
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

export const API_VERSION = "v1";
export const SEMSE_AGENT_RUN_QUEUE = "semse-agent-runs";
export const SEMSE_DEVELOPER_RUNTIME_QUEUE = "semse-developer-runtime";
export const SEMSE_BOOTSTRAP_HEADER_NAME = "x-semse-bootstrap-token";

export * from "./developer-runtime.js";

export const SEMSE_IDENTITY_HEADER_NAMES = {
  tenantId: "x-tenant-id",
  orgId: "x-org-id",
  userId: "x-user-id",
  roles: "x-roles"
} as const;

export const SEMSE_PROXY_HEADER_NAMES = {
  tenantId: "x-semse-tenant-id",
  orgId: "x-semse-org-id",
  userId: "x-semse-user-id",
  roles: "x-semse-roles"
} as const;

export const SEMSE_REQUEST_HEADER_NAMES = {
  authorization: "authorization",
  bootstrapToken: SEMSE_BOOTSTRAP_HEADER_NAME,
  contentType: "content-type",
  correlationId: "x-correlation-id",
  requestId: "x-request-id",
  ...SEMSE_IDENTITY_HEADER_NAMES
} as const;

export type RequestIdentity = {
  userId: string;
  tenantId: string;
  orgId: string;
  roles: string[];
  sessionId?: string;
};

export * from "./operator-context.js";
export * from "./ui-helpers.js";

export function parseRoleList(raw: unknown): string[] {
  if (typeof raw !== "string") {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function serializeRoleList(roles: readonly string[]): string {
  return roles.map((entry) => entry.trim()).filter(Boolean).join(",");
}

export function buildIdentityHeaders(identity: Pick<RequestIdentity, "tenantId" | "orgId" | "userId" | "roles">): Record<string, string> {
  return {
    [SEMSE_IDENTITY_HEADER_NAMES.tenantId]: identity.tenantId,
    [SEMSE_IDENTITY_HEADER_NAMES.orgId]: identity.orgId,
    [SEMSE_IDENTITY_HEADER_NAMES.userId]: identity.userId,
    [SEMSE_IDENTITY_HEADER_NAMES.roles]: serializeRoleList(identity.roles)
  };
}

export function buildProxyIdentityHeaders(identity: Pick<RequestIdentity, "tenantId" | "orgId" | "userId" | "roles">): Record<string, string> {
  return {
    [SEMSE_PROXY_HEADER_NAMES.tenantId]: identity.tenantId,
    [SEMSE_PROXY_HEADER_NAMES.orgId]: identity.orgId,
    [SEMSE_PROXY_HEADER_NAMES.userId]: identity.userId,
    [SEMSE_PROXY_HEADER_NAMES.roles]: serializeRoleList(identity.roles)
  };
}

export function trimToUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function assertNever(value: never, label = "Unexpected value"): never {
  throw new Error(`${label}: ${String(value)}`);
}

const nonEmptyString = z.string().trim().min(1);

const nodeEnvSchema = z.enum(["development", "test", "production"]).default("development");

export const apiEnvSchema = z
  .object({
    NODE_ENV: nodeEnvSchema,
    DATABASE_URL: nonEmptyString,
    AUTH_SECRET: z.string().min(32).optional(),
    REDIS_URL: nonEmptyString.default("redis://127.0.0.1:6379"),
    CORS_ORIGINS: z.string().optional(),
    RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(20),
    SEMSE_AUTONOMY_REPO_PATH: z.string().trim().optional(),
    SEMSE_AUTONOMY_BASE_BRANCH: z.string().trim().optional(),
    SEMSE_AUTONOMY_LOCAL_PR_MODE: z.enum(["true", "false"]).optional(),
    SEMSE_AUTONOMY_GITHUB_TOKEN: z.string().trim().optional(),
    SEMSE_AUTONOMY_REPO_NAME: z.string().trim().optional(),
    SEMSE_AUTONOMY_OPENAI_API_KEY: z.string().trim().optional(),
    SEMSE_AUTONOMY_OPENAI_MODEL: z.string().trim().optional(),
    SEMSE_AUTONOMY_OPENAI_BASE_URL: z.string().trim().optional(),
    SEMSE_COMMUNICATIONS_MODE: z.enum(["mock", "live"]).default("mock"),
    SEMSE_COMMUNICATIONS_NOTIFICATION_WHATSAPP: z.enum(["true", "false"]).default("false"),
    SEMSE_COMMUNICATIONS_TENANT_ID: nonEmptyString.default("tenant_default"),
    SEMSE_COMMUNICATIONS_ORG_ID: nonEmptyString.default("org_admin_001"),
    SEMSE_COMMUNICATIONS_ACTOR_USER_ID: nonEmptyString.default("usr_admin_001"),
    WHATSAPP_CLOUD_ACCESS_TOKEN: z.string().trim().optional(),
    WHATSAPP_CLOUD_PHONE_NUMBER_ID: z.string().trim().optional(),
    WHATSAPP_CLOUD_VERIFY_TOKEN: z.string().trim().optional(),
    WHATSAPP_CLOUD_API_VERSION: z.string().trim().default("v20.0"),
    WHATSAPP_APP_SECRET: z.string().trim().optional(),
    PORT: z.coerce.number().int().positive().default(4000),
    HOST: nonEmptyString.default("0.0.0.0")
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && !env.AUTH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_SECRET"],
        message: "AUTH_SECRET is required in production"
      });
    }

    if (env.SEMSE_COMMUNICATIONS_MODE === "live") {
      if (!env.WHATSAPP_CLOUD_ACCESS_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["WHATSAPP_CLOUD_ACCESS_TOKEN"],
          message: "WHATSAPP_CLOUD_ACCESS_TOKEN is required when SEMSE_COMMUNICATIONS_MODE=live"
        });
      }
      if (!env.WHATSAPP_CLOUD_PHONE_NUMBER_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["WHATSAPP_CLOUD_PHONE_NUMBER_ID"],
          message: "WHATSAPP_CLOUD_PHONE_NUMBER_ID is required when SEMSE_COMMUNICATIONS_MODE=live"
        });
      }
    }
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function validateApiEnv(config: Record<string, unknown>): ApiEnv {
  const parsed = apiEnvSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid API environment: ${parsed.error.message}`);
  }
  return parsed.data;
}

export const webServerEnvSchema = z.object({
  SEMSE_API_BASE_URL: nonEmptyString.url(),
  SEMSE_TENANT_ID: nonEmptyString,
  SEMSE_ORG_ID: nonEmptyString,
  SEMSE_USER_ID: nonEmptyString,
  SEMSE_ROLES: nonEmptyString.default("OPS_ADMIN"),
  NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED: z.enum(["true", "false"]).default("false")
});

export type WebServerEnv = z.infer<typeof webServerEnvSchema>;

export function validateWebServerEnv(config: Record<string, unknown>): WebServerEnv {
  const parsed = webServerEnvSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid web environment: ${parsed.error.message}`);
  }
  return parsed.data;
}

export const workerEnvSchema = z.object({
  SEMSE_API_URL: nonEmptyString.url().default("http://localhost:4000"),
  REDIS_URL: nonEmptyString.default("redis://127.0.0.1:6379"),
  AUTH_SECRET: z.string().min(32).optional(),
  SEMSE_BOOTSTRAP_TOKEN: nonEmptyString.optional(),
  SEMSE_WORKER_ID: nonEmptyString.optional(),
  SEMSE_TENANT_ID: nonEmptyString.default("tnt_demo"),
  SEMSE_USER_ID: nonEmptyString.default("usr_worker_001"),
  SEMSE_ORG_ID: nonEmptyString.default("org_worker"),
  SEMSE_ROLES: nonEmptyString.default("WORKER"),
  SEMSE_POLL_MS: z.coerce.number().int().positive().default(3000),
  SEMSE_HEARTBEAT_MS: z.coerce.number().int().positive().default(2500),
  SEMSE_RUN_SIM_MS: z.coerce.number().int().positive().default(4000),
  SEMSE_FAIL_RATE: z.coerce.number().min(0).max(1).default(0),
  SEMSE_RECLAIM_MS: z.coerce.number().int().positive().default(10000),
  SEMSE_STALE_AFTER_MS: z.coerce.number().int().positive().default(10000),
  SEMSE_AGENT_TYPE: z.string().trim().optional()
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function validateWorkerEnv(config: Record<string, unknown>): WorkerEnv {
  const parsed = workerEnvSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid worker environment: ${parsed.error.message}`);
  }
  return parsed.data;
}

// ── Currency ──────────────────────────────────────────────────────────────────

/**
 * Format a numeric amount as a locale currency string.
 * Defaults to USD / en-US locale.
 */
export function formatCurrency(
  amount: number | string,
  currency = "USD",
  locale = "en-US"
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Parse an arbitrary value into a finite decimal number.
 * Returns `null` when the input cannot be safely represented.
 */
export function safeParseDecimal(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!isFinite(num) || isNaN(num)) return null;
  return num;
}

// ── Strings ───────────────────────────────────────────────────────────────────

/**
 * Convert a human-readable string into a URL-safe slug.
 *
 * "Hello World 2026!" → "hello-world-2026"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")       // non-alnum → hyphen
    .replace(/^-+|-+$/g, "");          // trim leading/trailing hyphens
}

/**
 * Truncate a string to `maxLen` characters, appending `suffix` when trimmed.
 */
export function truncate(text: string, maxLen: number, suffix = "…"): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - suffix.length) + suffix;
}

// ── Dates ─────────────────────────────────────────────────────────────────────

/**
 * Return the ISO-8601 date portion of a Date or timestamp.
 * "2026-04-07T14:30:00Z" → "2026-04-07"
 */
export function toISODate(date: Date | string | number): string {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * Return a human-readable relative time string.
 * "2 hours ago", "in 3 days", etc.
 */
export function relativeTime(date: Date | string | number, now?: Date): string {
  const base = now ?? new Date();
  const target = new Date(date);
  const diffMs = target.getTime() - base.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSec);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), "month");
  return rtf.format(Math.round(diffSec / 31536000), "year");
}

// ── Domain label maps ─────────────────────────────────────────────────────────

export const JOB_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  PUBLISHED: "Published",
  RESERVED: "Reserved",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In Progress",
  REVIEW: "Under Review",
  DISPUTE: "In Dispute",
  COMPLETED: "Completed",
  AWARDED: "Awarded",
  CANCELLED: "Cancelled",
};

export const MILESTONE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  AWAITING_REVIEW: "Awaiting Review",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
};

export const BID_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const DISPUTE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  UNDER_REVIEW: "Under Review",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
};

export const AGENT_RUN_STATUS_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  RUNNING: "Running",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

// ── Type guards ───────────────────────────────────────────────────────────────

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && isFinite(value) && value > 0;
}

// ── Object utilities ──────────────────────────────────────────────────────────

/**
 * Pick a subset of keys from an object without mutating the original.
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const k of keys) {
    if (k in obj) result[k] = obj[k];
  }
  return result;
}

/**
 * Omit keys from an object without mutating the original.
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const k of keys) delete (result as Record<string, unknown>)[k as string];
  return result as Omit<T, K>;
}

/**
 * Remove all keys with `null` or `undefined` values from a shallow copy.
 */
export function compactObject<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)
  ) as Partial<T>;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function buildPaginationMeta(
  total: number,
  page: number,
  pageSize: number
): PaginationMeta {
  const totalPages = Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export function paginationSkip(page: number, pageSize: number): number {
  return Math.max(0, (page - 1) * pageSize);
}
