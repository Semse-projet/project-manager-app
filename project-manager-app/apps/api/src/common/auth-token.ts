import crypto from "node:crypto";

/**
 * SEMSE Signed Token — format: `<encodedPayload>.<sig>`
 *
 * NOT a standard JWT. Has 2 parts (not 3):
 *   encodedPayload = base64url(JSON.stringify(claims))
 *   sig            = HMAC-SHA256(encodedPayload, AUTH_SECRET) encoded as base64url
 *
 * This format is intentional: SEMSE has no external integrations that require
 * standard 3-part JWT. Standard claim names (jti, iat, exp, sub equivalents)
 * are used for familiarity, but no JWT library should be used to verify these tokens.
 */

export type TokenClaims = {
  userId: string;
  tenantId: string;
  orgId: string;
  roles: string[];
  sid?: string;
  typ?: "access";
  jti: string;
  iat: number;
  exp: number;
};

function b64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function fromb64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function signToken(
  claims: Omit<TokenClaims, "iat" | "exp" | "jti">,
  secret: string,
  ttlSeconds = 3600
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenClaims = { ...claims, jti: crypto.randomUUID(), iat: now, exp: now + ttlSeconds };
  const encodedPayload = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${sig}`;
}

export function verifyToken(token: string, secret: string): TokenClaims {
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) {
    throw new Error("Invalid token format");
  }

  const encodedPayload = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error("Invalid token signature");
  }

  const claims = JSON.parse(fromb64url(encodedPayload)) as TokenClaims;
  const now = Math.floor(Date.now() / 1000);

  if (claims.exp < now) {
    throw new Error("Token expired");
  }

  return claims;
}
