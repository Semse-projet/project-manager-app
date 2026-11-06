import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { parseRoleList, SEMSE_IDENTITY_HEADER_NAMES, type RequestIdentity } from "@semse/shared";
import { verifyToken } from "./auth-token.js";

export type RequestLike = {
  headers?: Record<string, unknown>;
};

export type RequestContext = RequestIdentity;

function requireHeader(headers: Record<string, unknown>, headerName: string): string {
  const value = headers[headerName];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new UnauthorizedException({
      message: `Missing required header '${headerName}'`
    });
  }

  return value.trim();
}

function extractBearerToken(headers: Record<string, unknown>): string | null {
  const authorization = headers["authorization"];
  if (typeof authorization !== "string") {
    return null;
  }
  const parts = authorization.trim().split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }
  return parts[1];
}

/** Local opt-in for header-derived identity (core.header-identity-fail-closed). */
export const HEADER_IDENTITY_OPT_IN_ENV = "SEMSE_ALLOW_HEADER_IDENTITY";

const HEADER_IDENTITY_NODE_ENVS = new Set(["development", "test"]);

/**
 * Single policy deciding whether caller-supplied identity headers may be
 * trusted. Only true for local work: AUTH_SECRET unset AND the explicit
 * opt-in set to exactly "true" AND NODE_ENV development/test. Anything else
 * (staging, preview, unset NODE_ENV, production) must fail closed.
 */
export function headerIdentityAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.AUTH_SECRET) return false;
  if ((env[HEADER_IDENTITY_OPT_IN_ENV] ?? "").trim() !== "true") return false;
  const nodeEnv = (env.NODE_ENV ?? "").trim().toLowerCase();
  return HEADER_IDENTITY_NODE_ENVS.has(nodeEnv);
}

/** Thrown whenever identity cannot be verified and headers may not be trusted. */
export function authorityUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException("Authentication authority unavailable");
}

export function parseHeaderRequestContext(headers: Record<string, unknown>): RequestContext {
  return {
    userId: requireHeader(headers, SEMSE_IDENTITY_HEADER_NAMES.userId),
    tenantId: requireHeader(headers, SEMSE_IDENTITY_HEADER_NAMES.tenantId),
    orgId: requireHeader(headers, SEMSE_IDENTITY_HEADER_NAMES.orgId),
    roles: parseRoleList(headers[SEMSE_IDENTITY_HEADER_NAMES.roles])
  };
}

export function resolveRequestContext(req: RequestLike & { authContext?: RequestContext }): RequestContext {
  if (req.authContext) {
    return req.authContext;
  }

  const headers = req.headers ?? {};
  const secret = process.env.AUTH_SECRET;

  if (secret) {
    const token = extractBearerToken(headers);
    if (!token) {
      throw new UnauthorizedException({
        message: "Missing or malformed Authorization header — expected 'Bearer <token>'"
      });
    }

    let claims;
    try {
      claims = verifyToken(token, secret);
    } catch {
      throw new UnauthorizedException({ message: "Invalid or expired auth token" });
    }

    return {
      userId: claims.userId,
      tenantId: claims.tenantId,
      orgId: claims.orgId,
      roles: claims.roles
    };
  }

  // Header identity is an explicit local-development opt-in only. A missing
  // AUTH_SECRET must never turn any shared environment into header-trust mode.
  if (!headerIdentityAllowed()) {
    throw authorityUnavailable();
  }
  return parseHeaderRequestContext(headers);
}
