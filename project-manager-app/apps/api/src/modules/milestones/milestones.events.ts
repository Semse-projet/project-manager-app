type EventBase = {
  tenantId: string;
  milestoneId: string;
  actorId: string;
  occurredAt?: string;
};

function meta(input: EventBase, action: string) {
  return {
    tenantId: input.tenantId,
    correlationId: `milestone:${input.milestoneId}:${action}`,
    actorId: input.actorId,
    actorType: "user" as const,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    version: 1 as const,
  };
}

export function buildMilestoneCreatedEvent(input: EventBase & {
  projectId: string;
  jobId: string;
  sequence: number;
  title: string;
  amount: number;
}) {
  return {
    type: "milestone.created" as const,
    meta: meta(input, "created"),
    payload: {
      milestoneId: input.milestoneId,
      projectId: input.projectId,
      jobId: input.jobId,
      sequence: input.sequence,
      title: input.title,
      amount: input.amount,
      requiredEvidenceTypes: [],
    },
    triggers: ["notification", "audit"] as const,
  };
}

export function buildMilestoneApprovedEvent(input: EventBase & {
  projectId: string;
  jobId: string;
  amount: number;
}) {
  return {
    type: "milestone.approved" as const,
    meta: meta(input, "approved"),
    payload: {
      milestoneId: input.milestoneId,
      projectId: input.projectId,
      jobId: input.jobId,
      reviewerId: input.actorId,
      amount: input.amount,
    },
    triggers: ["notification", "audit"] as const,
  };
}

export function buildMilestoneRejectedEvent(input: EventBase & {
  projectId: string;
  jobId: string;
  reason: string;
}) {
  return {
    type: "milestone.rejected" as const,
    meta: meta(input, "rejected"),
    payload: {
      milestoneId: input.milestoneId,
      projectId: input.projectId,
      jobId: input.jobId,
      reviewerId: input.actorId,
      rejectionReason: input.reason,
    },
    triggers: ["risk", "notification", "audit"] as const,
  };
}

export function buildMilestoneRevisionRequestedEvent(input: EventBase & {
  projectId: string;
  jobId: string;
  reason: string;
}) {
  return {
    type: "milestone.revision_requested" as const,
    meta: meta(input, "revision_requested"),
    payload: {
      milestoneId: input.milestoneId,
      projectId: input.projectId,
      jobId: input.jobId,
      requestedById: input.actorId,
      instructions: input.reason,
    },
    triggers: ["notification", "audit"] as const,
  };
}
