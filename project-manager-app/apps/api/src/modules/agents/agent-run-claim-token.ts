import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { headerIdentityAllowed } from "../../common/request-context.js";

// This process-only key is permitted solely in local/test header-identity mode.
const localTestKey = randomBytes(32);

export type AgentClaimBinding = {
  tenantId: string;
  orgId: string;
  userId: string;
  runId: string;
  workerId: string;
  attempts: number;
};

function signingKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 16) {
    return createHmac("sha256", secret).update("semse:agent-run:claim:v1:key").digest();
  }
  if (!secret && headerIdentityAllowed()) return localTestKey;
  throw new ServiceUnavailableException("agent run claim signing authority unavailable");
}

export function signAgentRunClaimToken(binding: AgentClaimBinding): string {
  if (!binding.tenantId || !binding.orgId || !binding.userId ||
      !binding.runId || !binding.workerId ||
      !Number.isSafeInteger(binding.attempts) || binding.attempts <= 0) {
    throw new ForbiddenException("invalid agent run claim binding");
  }
  return createHmac("sha256", signingKey())
    .update(JSON.stringify([
      "semse:agent-run:claim:v1",
      binding.tenantId, binding.orgId, binding.userId,
      binding.runId, binding.workerId, binding.attempts,
    ]))
    .digest("base64url");
}

export function verifyAgentRunClaimToken(binding: AgentClaimBinding, token: unknown): void {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new ForbiddenException("missing or invalid agent worker claim token");
  }
  const expected = Buffer.from(signAgentRunClaimToken(binding), "base64url");
  const received = Buffer.from(token, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new ForbiddenException("missing or invalid agent worker claim token");
  }
}
