export interface DomainEventListItemView {
  auditId: string;
  type: string;
  correlationId: string;
  actorUserId?: string;
  requestId: string;
  triggers: string[];
  payload?: Record<string, unknown>;
  meta?: {
    tenantId?: string;
    correlationId?: string;
    actorId?: string;
    actorType?: "user" | "system" | "agent";
    occurredAt?: string;
    version?: number;
  };
  timestamp: string;
}

export interface DomainEventListView {
  total: number;
  filters: {
    type?: string;
    correlationId?: string;
    limit: number;
  };
  items: DomainEventListItemView[];
}

export interface DomainEventTimelineItemView {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId: string;
  timestamp: string;
}

export interface DomainEventTraceView {
  correlationId: string;
  event?: DomainEventListItemView;
  runs: Array<{
    id: string;
    agentType: string;
    triggerType: string;
    status: string;
    workerId?: string;
    attempts: number;
    maxAttempts: number;
    deadLettered: boolean;
    requiresHumanReview: boolean;
    error?: string;
    createdAt: string;
    updatedAt: string;
    startedAt?: string;
    endedAt?: string;
  }>;
  timeline: DomainEventTimelineItemView[];
}
