import { z } from "zod";

export const opsDashboardSchema = z.object({
  jobs: z.object({
    total: z.number().int().nonnegative(),
    published: z.number().int().nonnegative(),
    awarded: z.number().int().nonnegative(),
    posted: z.number().int().nonnegative(),
    reserved: z.number().int().nonnegative(),
    accepted: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    review: z.number().int().nonnegative(),
    dispute: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative()
  }),
  projects: z.object({
    total: z.number().int().nonnegative(),
    open: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative()
  }),
  disputes: z.object({
    total: z.number().int().nonnegative(),
    open: z.number().int().nonnegative(),
    assigned: z.number().int().nonnegative(),
    resolved: z.number().int().nonnegative()
  }),
  agents: z.object({
    totalRuns: z.number().int().nonnegative(),
    queued: z.number().int().nonnegative(),
    running: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    deadLettered: z.number().int().nonnegative(),
    maxAttemptsReached: z.number().int().nonnegative()
  })
});

export const opsMutationResultSchema = z.object({
  status: z.string().min(1)
});

export const agentRunSummarySchema = z.object({
  id: z.string().min(1),
  agentType: z.string().min(1),
  status: z.string().min(1),
  deadLettered: z.boolean()
});

export const auditEntrySchema = z.object({
  id: z.string().min(1),
  actorUserId: z.string().min(1),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  requestId: z.string().min(1),
  timestamp: z.string().min(1)
});

export const riskScoreSchema = z.object({
  id: z.string().min(1),
  subjectType: z.string().min(1),
  subjectId: z.string().min(1),
  score: z.number(),
  modelVersion: z.string().min(1),
  factors: z.unknown(),
  computedAt: z.string().min(1)
});

export const trustOverviewItemSchema = z.object({
  scopeType: z.enum(["job", "project"]),
  scopeId: z.string().min(1),
  jobId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  score: z.number().int().min(0).max(100),
  level: z.enum(["low", "medium", "high"]),
  flags: z.array(z.string().min(1)),
  primaryReason: z.string().min(1),
  lastUpdatedAt: z.string().min(1)
});

export const trustOverviewSchema = z.object({
  total: z.number().int().nonnegative(),
  highRisk: z.number().int().nonnegative(),
  mediumRisk: z.number().int().nonnegative(),
  lowRisk: z.number().int().nonnegative(),
  items: z.array(trustOverviewItemSchema)
});

export const agentRuntimeItemSchema = z.object({
  id: z.string().min(1),
  correlationId: z.string().min(1),
  eventType: z.string().min(1).optional(),
  agentType: z.string().min(1),
  triggerType: z.string().min(1),
  status: z.string().min(1),
  workerId: z.string().min(1).optional(),
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().nonnegative(),
  deadLettered: z.boolean(),
  inputSummary: z.string().min(1).optional(),
  outputSummary: z.string().min(1).optional(),
  operatorContext: z.object({
    source: z.string().min(1),
    scope: z.string().min(1),
    operatorId: z.string().min(1),
    workspaceId: z.string().min(1).optional(),
    repoId: z.string().min(1).optional(),
    taskId: z.string().min(1).optional()
  }).optional(),
  requiresHumanReview: z.boolean(),
  error: z.string().min(1).optional(),
  startedAt: z.string().min(1).optional(),
  heartbeatAt: z.string().min(1).optional(),
  endedAt: z.string().min(1).optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const agentRuntimeListSchema = z.object({
  total: z.number().int().nonnegative(),
  filters: z.object({
    correlationId: z.string().min(1).optional(),
    eventType: z.string().min(1).optional(),
    agentType: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    triggerType: z.string().min(1).optional(),
    workspaceId: z.string().min(1).optional(),
    operatorId: z.string().min(1).optional(),
    memoryTag: z.string().min(1).optional(),
    limit: z.number().int().positive()
  }),
  items: z.array(agentRuntimeItemSchema)
});

export const agentRuntimeTraceSchema = z.object({
  correlationId: z.string().min(1),
  summary: z.object({
    eventType: z.string().min(1).optional(),
    triggerCount: z.number().int().nonnegative(),
    queued: z.number().int().nonnegative(),
    running: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative()
  }),
  event: z.object({
    auditId: z.string().min(1),
    action: z.string().min(1),
    entityId: z.string().min(1),
    eventType: z.string().min(1).optional(),
    triggers: z.array(z.string().min(1)),
    payload: z.record(z.string(), z.unknown()).optional(),
    requestId: z.string().min(1),
    timestamp: z.string().min(1)
  }).optional(),
  runs: z.array(
    z.object({
      id: z.string().min(1),
      agentType: z.string().min(1),
      triggerType: z.string().min(1),
      eventType: z.string().min(1).optional(),
      status: z.string().min(1),
      workerId: z.string().min(1).optional(),
      attempts: z.number().int().nonnegative(),
      maxAttempts: z.number().int().nonnegative(),
      deadLettered: z.boolean(),
      inputSummary: z.string().min(1).optional(),
      outputSummary: z.string().min(1).optional(),
      operatorContext: z.object({
        source: z.string().min(1),
        scope: z.string().min(1),
        operatorId: z.string().min(1),
        workspaceId: z.string().min(1).optional(),
        repoId: z.string().min(1).optional(),
        taskId: z.string().min(1).optional()
      }).optional(),
      requiresHumanReview: z.boolean(),
      error: z.string().min(1).optional(),
      startedAt: z.string().min(1).optional(),
      heartbeatAt: z.string().min(1).optional(),
      endedAt: z.string().min(1).optional(),
      createdAt: z.string().min(1),
      updatedAt: z.string().min(1)
    })
  ),
  workspaceMemory: z.array(
    z.object({
      id: z.string().min(1),
      runId: z.string().min(1).optional(),
      kind: z.string().min(1),
      scope: z.string().min(1),
      title: z.string().min(1),
      summary: z.string().min(1),
      tags: z.array(z.string().min(1)),
      updatedAtIso: z.string().min(1)
    })
  ),
  timeline: z.array(
    z.object({
      id: z.string().min(1),
      action: z.string().min(1),
      entityType: z.string().min(1),
      entityId: z.string().min(1),
      requestId: z.string().min(1),
      timestamp: z.string().min(1)
    })
  )
});

export const controlSurfaceSnapshotSchema = z.object({
  dashboard: opsDashboardSchema,
  runs: z.array(agentRunSummarySchema),
  projects: z.array(
    z.object({
      id: z.string().min(1),
      status: z.string().min(1)
    })
  ),
  warnings: z.array(z.string())
});

export const cortexSnapshotSchema = z.object({
  dashboard: opsDashboardSchema,
  runs: z.array(agentRunSummarySchema),
  riskScores: z.array(riskScoreSchema),
  audit: z.array(auditEntrySchema),
  agentRuntime: agentRuntimeListSchema,
  warnings: z.array(z.string())
});

export type OpsDashboard = z.infer<typeof opsDashboardSchema>;
export type OpsMutationResult = z.infer<typeof opsMutationResultSchema>;
export type AgentRunSummary = z.infer<typeof agentRunSummarySchema>;
export type AuditEntry = z.infer<typeof auditEntrySchema>;
export type RiskScore = z.infer<typeof riskScoreSchema>;
export type TrustOverviewItem = z.infer<typeof trustOverviewItemSchema>;
export type TrustOverview = z.infer<typeof trustOverviewSchema>;
export type AgentRuntimeItem = z.infer<typeof agentRuntimeItemSchema>;
export type AgentRuntimeList = z.infer<typeof agentRuntimeListSchema>;
export type AgentRuntimeTrace = z.infer<typeof agentRuntimeTraceSchema>;
export type ControlSurfaceSnapshot = z.infer<typeof controlSurfaceSnapshotSchema>;
export type CortexSnapshot = z.infer<typeof cortexSnapshotSchema>;
