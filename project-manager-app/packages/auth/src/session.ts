import crypto from "node:crypto";

export interface SessionPayload {
  /** Unique session ID (maps to jti in signed tokens) */
  sid: string;
  userId: string;
  tenantId: string;
  orgId: string;
  roles: string[];
  /** ISO-8601 expiry timestamp */
  expiresAt: string;
}

/** Generate a cryptographically random session ID. */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Encode a SessionPayload as a base64url string for cookie / header transport.
 * NOT signed — pair with auth-token.ts signToken for tamper-proof tokens.
 */
export function encodeSession(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

/**
 * Decode a base64url-encoded session back into a SessionPayload.
 * Returns `null` on parse failure or missing required fields.
 */
export function decodeSession(encoded: string): SessionPayload | null {
  try {
    const raw = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as SessionPayload;
    if (
      !parsed.sid ||
      !parsed.userId ||
      !parsed.tenantId ||
      !parsed.orgId ||
      !Array.isArray(parsed.roles)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Returns true if the session has not yet expired. */
export function isSessionValid(session: SessionPayload, now?: Date): boolean {
  return new Date(session.expiresAt) > (now ?? new Date());
}
