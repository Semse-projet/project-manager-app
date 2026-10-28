import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import { ThrottlerGuard, normalizeIp } from "@nestjs/throttler";
import { SEMSE_CLIENT_IP_HEADER_NAME } from "@semse/shared";
import { verifyToken } from "./auth-token.js";
import { hasValidBootstrapToken } from "./bootstrap-token.js";

type ThrottledRequest = {
  ip?: string;
  url?: string;
  headers?: Record<string, unknown>;
  body?: unknown;
};

// The only endpoint whose body identity the BFF chooses itself. Every other BFF
// call (login, register, password reset) forwards a body the visitor wrote.
const TOKEN_ISSUANCE_PATH = "/v1/auth/token";

function requestPath(req: ThrottledRequest): string {
  return (req.url ?? "").split("?")[0].replace(/\/+$/, "");
}

function bearerToken(headers: Record<string, unknown>): string | undefined {
  const authorization = headers.authorization;
  if (typeof authorization !== "string") return undefined;
  const [scheme, token] = authorization.trim().split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Who a request is counted against. The stock tracker is the socket IP, but
 * every web user reaches the API through the BFF, so they all shared one
 * bucket per handler (KIT-F3-04, docs/semse-kit/test-matrix.md):
 *
 * 1. The BFF, proven by the bootstrap token → on POST /v1/auth/token only, the
 *    identity it asks a token for; else the client IP it forwards (login,
 *    register, password reset…). Those other bodies are written by the visitor,
 *    so a tenantId/userId in them must never pick the bucket. Checked first
 *    because those BFF calls may also carry the server's static Bearer
 *    identity, which would put every caller back in one bucket.
 * 2. A correctly signed access token → its user. Signature and expiry only, no
 *    DB lookup, so this stays as cheap as the IP path; revoked sessions are still
 *    rejected afterwards by AuthGuard.
 * 3. Anything else → the socket IP, as before. Forwarded IPs from untrusted
 *    callers are ignored, so they cannot pick their own bucket.
 */
export function resolveThrottleTracker(req: ThrottledRequest, ipv6SubnetPrefix?: number): string {
  const headers = req.headers ?? {};

  if (hasValidBootstrapToken(headers)) {
    if (requestPath(req) === TOKEN_ISSUANCE_PATH) {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const tenantId = nonEmptyString(body.tenantId);
      const userId = nonEmptyString(body.userId);
      if (tenantId && userId) return `identity:${tenantId}:${userId}`;
    }

    const clientIp = nonEmptyString(headers[SEMSE_CLIENT_IP_HEADER_NAME]);
    if (clientIp && isIP(clientIp)) return `ip:${normalizeIp(clientIp, ipv6SubnetPrefix)}`;
  }

  const token = bearerToken(headers);
  const secret = process.env.AUTH_SECRET;
  if (token && secret) {
    try {
      const claims = verifyToken(token, secret);
      return `user:${claims.tenantId}:${claims.userId}`;
    } catch {
      // Invalid or expired token: counted by IP below.
    }
  }

  return `ip:${normalizeIp(req.ip ?? "", ipv6SubnetPrefix)}`;
}

@Injectable()
export class SemseThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    return resolveThrottleTracker(req as ThrottledRequest, this.ipv6SubnetPrefix);
  }
}
