export type DisputeResolutionType =
  | "client_favor"
  | "pro_favor"
  | "partial_50_50"
  | "escalated_legal";

export function buildDisputeResolvedEvent(input: {
  tenantId: string;
  disputeId: string;
  jobId: string;
  resolvedById: string;
  resolutionType: DisputeResolutionType;
  resolution: string;
  occurredAt?: string;
}) {
  return {
    type: "dispute.resolved" as const,
    meta: {
      tenantId: input.tenantId,
      correlationId: `dispute:${input.disputeId}:resolved`,
      actorId: input.resolvedById,
      actorType: "user" as const,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      version: 1 as const,
    },
    payload: {
      disputeId: input.disputeId,
      jobId: input.jobId,
      resolvedById: input.resolvedById,
      resolutionType: input.resolutionType,
      resolution: input.resolution,
    },
    triggers: ["trust-match", "risk", "notification", "audit"] as const,
  };
}
