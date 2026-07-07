import { type NextRequest, NextResponse } from "next/server";
import {
  SEMSE_BOOTSTRAP_HEADER_NAME,
  buildIdentityHeaders,
  parseRoleList,
  SEMSE_PROXY_HEADER_NAMES,
  trimToUndefined,
  validateWebServerEnv
} from "@semse/shared";
import { decodeSession, SESSION_COOKIE } from "../../../lib/auth";
import { AccessTokenBootstrapper } from "./_access-token-bootstrap";

type ApiEnvelope<T> = {
  requestId: string;
  data: T;
};

const accessTokenBootstrapper = new AccessTokenBootstrapper();

type RuntimeConfig = {
  apiBaseUrl: string;
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string;
};

function resolveLocalDevRuntimeConfig(): RuntimeConfig | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return {
    apiBaseUrl: trimToUndefined(process.env.SEMSE_API_BASE_URL) ?? "http://127.0.0.1:4000",
    tenantId: trimToUndefined(process.env.SEMSE_TENANT_ID) ?? "tenant_default",
    orgId: trimToUndefined(process.env.SEMSE_ORG_ID) ?? "org_admin_001",
    userId: trimToUndefined(process.env.SEMSE_USER_ID) ?? "usr_admin_001",
    roles: trimToUndefined(process.env.SEMSE_ROLES) ?? "OPS_ADMIN"
  };
}

class SemseProxyError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    message: string
  ) {
    super(message);
  }
}

function normalizeErrorMessage(path: string, status: number, raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: { message?: unknown } };
      const nestedMessage = parsed.error?.message;
      if (typeof nestedMessage === "string" && nestedMessage.trim().length > 0) {
        return nestedMessage.trim();
      }
      if (
        nestedMessage &&
        typeof nestedMessage === "object" &&
        "message" in nestedMessage &&
        typeof (nestedMessage as { message?: unknown }).message === "string"
      ) {
        return String((nestedMessage as { message?: unknown }).message).trim();
      }
    } catch {
      // fall through to status-based normalization
    }
  }

  if (status === 403) {
    return `Acceso denegado para ${path}.`;
  }

  if (status === 404) {
    return `Recurso no encontrado en ${path}.`;
  }

  if (status === 409) {
    return `Conflicto de estado en ${path}.`;
  }

  if (trimmed.length > 0 && !trimmed.startsWith("{")) {
    return trimmed;
  }

  return `SEMSE API ${path} returned ${status}`;
}

function resolveRuntimeConfig(): RuntimeConfig | null {
  const apiBaseUrl = trimToUndefined(process.env.SEMSE_API_BASE_URL);
  const tenantId = trimToUndefined(process.env.SEMSE_TENANT_ID);
  const orgId = trimToUndefined(process.env.SEMSE_ORG_ID);
  const userId = trimToUndefined(process.env.SEMSE_USER_ID);

  if (!apiBaseUrl || !tenantId || !orgId || !userId) {
    return resolveLocalDevRuntimeConfig();
  }

  const env = validateWebServerEnv({
    SEMSE_API_BASE_URL: apiBaseUrl,
    SEMSE_TENANT_ID: tenantId,
    SEMSE_ORG_ID: orgId,
    SEMSE_USER_ID: userId,
    SEMSE_ROLES: process.env.SEMSE_ROLES,
    NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED: process.env.NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED
  });

  return {
    apiBaseUrl: env.SEMSE_API_BASE_URL.replace(/\/+$/, ""),
    tenantId: env.SEMSE_TENANT_ID,
    orgId: env.SEMSE_ORG_ID,
    userId: env.SEMSE_USER_ID,
    roles: env.SEMSE_ROLES
  };
}

function buildBootstrapHeaders(): Record<string, string> {
  const bootstrapToken = trimToUndefined(process.env.SEMSE_BOOTSTRAP_TOKEN);
  if (!bootstrapToken) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SEMSE_BOOTSTRAP_TOKEN is required in production");
    }
    return {};
  }

  return {
    [SEMSE_BOOTSTRAP_HEADER_NAME]: bootstrapToken
  };
}

/**
 * Resolves identity from request headers injected by the Edge middleware.
 * The middleware sets x-semse-user-id / x-semse-tenant-id / x-semse-org-id /
 * x-semse-roles on every authenticated request so that API route handlers can
 * build a per-user runtime config without relying on static env vars.
 */
function resolveConfigFromRequest(req: NextRequest): RuntimeConfig | null {
  const apiBaseUrl = trimToUndefined(process.env.SEMSE_API_BASE_URL);
  if (!apiBaseUrl) return null;

  const userId = req.headers.get(SEMSE_PROXY_HEADER_NAMES.userId)?.trim();
  const tenantId = req.headers.get(SEMSE_PROXY_HEADER_NAMES.tenantId)?.trim();
  const orgId = req.headers.get(SEMSE_PROXY_HEADER_NAMES.orgId)?.trim();
  const roles = req.headers.get(SEMSE_PROXY_HEADER_NAMES.roles)?.trim() ?? "CLIENT";

  if (!userId || !tenantId || !orgId) return null;

  return {
    apiBaseUrl: apiBaseUrl.replace(/\/+$/, ""),
    tenantId,
    orgId,
    userId,
    roles,
  };
}

async function resolveConfigFromCookie(req: NextRequest): Promise<RuntimeConfig | null> {
  const apiBaseUrl = trimToUndefined(process.env.SEMSE_API_BASE_URL);
  if (!apiBaseUrl) return null;

  const encoded = req.cookies.get(SESSION_COOKIE)?.value;
  if (!encoded) return null;

  const session = await decodeSession(encoded);
  if (!session) return null;

  return {
    apiBaseUrl: apiBaseUrl.replace(/\/+$/, ""),
    tenantId: session.tenantId,
    orgId: session.orgId,
    userId: session.userId,
    roles: session.roles.join(","),
  };
}

export async function resolveRuntimeConfigForRequest(req: NextRequest): Promise<RuntimeConfig | null> {
  return resolveConfigFromRequest(req) ?? await resolveConfigFromCookie(req) ?? resolveRuntimeConfig();
}

export function runtimeDisabledResponse(): NextResponse {
  return NextResponse.json(
    {
      error: {
        status: 503,
        message: "SEMSE server runtime is not configured"
      }
    },
    { status: 503 }
  );
}

async function doFetch<T>(config: RuntimeConfig, path: string, init?: RequestInit): Promise<T> {
  const identityHeaders = buildIdentityHeaders({
    tenantId: config.tenantId,
    orgId: config.orgId,
    userId: config.userId,
    roles: parseRoleList(config.roles)
  });

  const cacheKey = [
    config.apiBaseUrl,
    config.tenantId,
    config.orgId,
    config.userId,
    config.roles
  ].join("::");
  const shouldBootstrapAccessToken =
    process.env.NODE_ENV === "production" || process.env.SEMSE_ENABLE_ACCESS_TOKEN_BOOTSTRAP === "true";

  let authorizationHeader: string | undefined;
  if (shouldBootstrapAccessToken) {
    // Concurrent callers for the same identity share one in-flight bootstrap —
    // otherwise a page that mounts several components at once bursts past
    // POST /v1/auth/token's rate limit and the losers proceed unauthenticated.
    const accessToken = await accessTokenBootstrapper.getToken(cacheKey, {
      apiBaseUrl: config.apiBaseUrl,
      tenantId: config.tenantId,
      orgId: config.orgId,
      userId: config.userId,
      roles: parseRoleList(config.roles),
      bootstrapHeaders: buildBootstrapHeaders()
    });
    if (accessToken) authorizationHeader = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...identityHeaders,
      ...(authorizationHeader ? { authorization: authorizationHeader } : {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new SemseProxyError(response.status, path, normalizeErrorMessage(path, response.status, text));
  }

  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}

/** Original function — uses static env vars (backward-compatible). */
export async function fetchSemseData<T>(path: string, init?: RequestInit): Promise<T> {
  const config = resolveRuntimeConfig();
  if (!config) {
    throw new Error("SEMSE server runtime is not configured");
  }
  return doFetch<T>(config, path, init);
}

/**
 * Session-aware fetch — resolves identity from the incoming request's session
 * headers (set by middleware), then falls back to static env var config.
 * Prefer this in all API route handlers.
 */
export async function fetchSemseDataForRequest<T>(
  path: string,
  req: NextRequest,
  init?: RequestInit
): Promise<T> {
  const config = await resolveRuntimeConfigForRequest(req);
  if (!config) {
    throw new Error("SEMSE server runtime is not configured");
  }
  return doFetch<T>(config, path, init);
}

export function isSemseRuntimeEnabled(): boolean {
  return resolveRuntimeConfig() !== null;
}

/**
 * Returns true if the API base URL is reachable — either via env var or the
 * local-dev fallback. Use this as the gate in API route handlers.
 */
export function isApiBaseConfigured(): boolean {
  return resolveRuntimeConfig() !== null;
}

export function handleServerError(error: unknown): NextResponse {
  const status = error instanceof SemseProxyError ? error.status : 502;
  const message = error instanceof Error ? error.message : "Unknown SEMSE integration error";
  return NextResponse.json(
    {
      error: {
        status,
        message
      }
    },
    { status }
  );
}

export async function getServerConfig(req: NextRequest): Promise<RuntimeConfig> {
  const cfg = await resolveRuntimeConfigForRequest(req);
  if (!cfg) throw new Error("SEMSE server runtime is not configured");
  return cfg;
}

export function buildSemseRequestHeaders(cfg: RuntimeConfig): Record<string, string> {
  return buildIdentityHeaders({
    tenantId: cfg.tenantId,
    orgId: cfg.orgId,
    userId: cfg.userId,
    roles: parseRoleList(cfg.roles),
  }) as Record<string, string>;
}
