import { z } from "zod";

/**
 * Contratos del consentimiento OAuth delegado de S1/D7 — ver
 * `docs/specs/platform/semse-mcp-delegated-consent.spec.md` y
 * `docs/foundation/STATE_MACHINES.md` §McpDelegatedConsent.
 *
 * Fase B: solo servicio interno, sin ruta HTTP/MCP. El vínculo token↔grant
 * (`grantBindingDigest`) lo calcula la capa D2, todavía pendiente.
 */

export const MCP_GRANT_MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MCP_GRANT_RETENTION_DAYS = 90;

export const mcpConsentScopeSchema = z.enum(["projects:read"]);
export type McpConsentScope = z.infer<typeof mcpConsentScopeSchema>;

export const mcpDelegatedConsentStatusSchema = z.enum(["PENDING", "ACTIVE", "REVOKED", "EXPIRED"]);
export type McpDelegatedConsentStatus = z.infer<typeof mcpDelegatedConsentStatusSchema>;

export const mcpConsentRevocationReasonSchema = z.enum([
  "user_requested",
  "ops_incident",
  "subject_deleted",
  "policy_change",
]);
export type McpConsentRevocationReason = z.infer<typeof mcpConsentRevocationReasonSchema>;

export const acceptMcpConsentInputSchema = z.object({
  sessionId: z.string().min(1),
  oauthIssuer: z.string().url(),
  oauthClientId: z.string().min(1).max(256),
  resourceUri: z.string().url(),
  scopeSet: z.array(mcpConsentScopeSchema).min(1),
  grantBindingDigest: z.string().min(16).max(256),
  idempotencyKey: z.string().min(8).max(256).optional(),
  requestedExpiresAt: z.coerce.date().optional(),
  policyVersion: z.string().min(1).max(64),
  consentVersion: z.string().min(1).max(64),
});
export type AcceptMcpConsentInput = z.infer<typeof acceptMcpConsentInputSchema>;

export const mcpDelegatedConsentRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  orgId: z.string(),
  oauthClientId: z.string(),
  resourceUri: z.string(),
  scopeSet: z.array(mcpConsentScopeSchema),
  status: mcpDelegatedConsentStatusSchema,
  authorizedAt: z.date().nullable(),
  expiresAt: z.date(),
  revokedAt: z.date().nullable(),
  revocationReasonCode: mcpConsentRevocationReasonSchema.nullable(),
});
export type McpDelegatedConsentRecord = z.infer<typeof mcpDelegatedConsentRecordSchema>;
