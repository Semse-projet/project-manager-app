import { UnauthorizedException } from "@nestjs/common";
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

  // Dev/bootstrap mode: identity from plain headers
  return parseHeaderRequestContext(headers);
}
