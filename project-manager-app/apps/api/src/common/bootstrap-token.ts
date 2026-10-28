import crypto from "node:crypto";
import { SEMSE_BOOTSTRAP_HEADER_NAME } from "@semse/shared";

export function expectedBootstrapToken(): string | undefined {
  return process.env.SEMSE_BOOTSTRAP_TOKEN?.trim() || undefined;
}

/**
 * True when the request carries the server-held bootstrap token — i.e. it comes
 * from the web BFF. Always false when no token is configured: an unset token
 * must never make a caller trusted.
 */
export function hasValidBootstrapToken(headers: Record<string, unknown> | undefined): boolean {
  const expected = expectedBootstrapToken();
  if (!expected) return false;

  const provided = headers?.[SEMSE_BOOTSTRAP_HEADER_NAME];
  if (typeof provided !== "string") return false;

  // Hash both sides so timingSafeEqual always receives equal-length buffers,
  // preventing the length short-circuit from leaking information.
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  const providedHash = crypto.createHash("sha256").update(provided.trim()).digest();
  return crypto.timingSafeEqual(expectedHash, providedHash);
}
