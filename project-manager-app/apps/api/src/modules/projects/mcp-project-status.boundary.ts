import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { z } from "zod";

/**
 * Internal preparation for MCP S1 / D5-D6, NOT an HTTP endpoint or security
 * principal. A future OAuth resource server must authenticate the actor,
 * recheck consent / membership and enforce projects:read BEFORE any read.
 *
 * This file NEVER consumes tool-supplied tenantId, orgId, roles or claims.
 */
const domainStatusSchema = z.object({
  projectId: z.string().min(1).max(256),
  status: z.enum(["open", "in_progress", "blocked", "completed", "cancelled"]),
});

const outputSchema = domainStatusSchema.extend({
  // Must be the real ID supplied by the trusted HTTP request boundary.
  // Reject an absent, blank or excessive value; do not fabricate audit refs.
  correlationId: z.string().trim().min(1).max(128),
}).strict();

export type McpProjectStatusProjection = Readonly<z.infer<typeof outputSchema>>;

/**
 * Explicit output allowlist: strips every field except projectId/status,
 * then includes a real correlation ID provided by the future trusted adapter.
 * This is a PURE operation; it neither authenticates nor accesses storage.
 */
export function projectStatusMcpProjection(
  domainRead: unknown,
  trustedRequestCorrelationId: unknown,
): McpProjectStatusProjection {
  const minimal = domainStatusSchema.parse(domainRead);
  return Object.freeze(outputSchema.parse({
    projectId: minimal.projectId,
    status: minimal.status,
    correlationId: trustedRequestCorrelationId,
  }));
}

/**
 * Uniform resource exception for the future MCP tool adapter. Both absent
 * and unauthorized Project reads must produce an indistinguishable outward
 * response. The original exception is never copied into this error/cause.
 */
export class McpProjectUnavailableError extends Error {
  readonly code = "RESOURCE_UNAVAILABLE" as const;

  constructor() {
    super("Project unavailable");
    this.name = "McpProjectUnavailableError";
  }
}

/**
 * Call ONLY when handling an error from the canonical Project domain read.
 * HTTP authentication (401), OAuth scope denial (403) and infrastructure
 * errors must be handled separately by the future resource-server boundary.
 */
export function rethrowSafeMcpProjectReadError(error: unknown): never {
  if (error instanceof NotFoundException || error instanceof ForbiddenException) {
    throw new McpProjectUnavailableError();
  }
  throw error;
}
