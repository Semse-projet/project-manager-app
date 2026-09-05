import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, Logger, Optional } from "@nestjs/common";
import {
  MILESTONE_APPROVED_V1_SCHEMA_REF,
  MILESTONE_REJECTED_V1_SCHEMA_REF,
  milestoneApprovedV1EventSchema,
  milestoneRejectedV1EventSchema,
} from "@semse/schemas";
import { type MilestoneRecord } from "../../common/domain-store.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { OperationalContextService } from "../ai-models/context/operational-context.service.js";
import { OPERATIONAL_CONTEXT_SERVICE } from "../ai-models/context/operational-context.token.js";
import { WorkspaceMemoryRepository } from "../knowledge/workspace-memory.repository.js";
import { buildMilestoneWorkspaceMemoryRecord } from "../knowledge/workspace-memory.business-records.js";
import { DomainEventBus } from "../domain-events/domain-event-bus.service.js";
import { OutboxRepository } from "../domain-events/outbox.repository.js";
import { BuildOpsIntelligenceAgent } from "../operational-intelligence/buildops-intelligence.agent.js";
import { MilestonesRepository } from "./milestones.repository.js";
import type { EscrowReleaseService } from "../payments/escrow-release.service.js";
import type { NotificationsService } from "../notifications/notifications.service.js";
import type { JobsService } from "../jobs/jobs.service.js";
import {
  buildMilestoneApprovedEvent,
  buildMilestoneCreatedEvent,
  buildMilestoneRejectedEvent,
  buildMilestoneRevisionRequestedEvent,
} from "./milestones.events.js";

@Injectable()
export class MilestonesService {
  private readonly logger = new Logger(MilestonesService.name);

  constructor(
    private readonly milestonesRepository: MilestonesRepository,
    private readonly auditService: AuditService,
    private readonly domainEventBus: DomainEventBus,
    private readonly workspaceMemory: WorkspaceMemoryRepository,
    @Optional() private readonly intelligenceAgent?: BuildOpsIntelligenceAgent,
    @Optional() @Inject(OPERATIONAL_CONTEXT_SERVICE)
    private readonly operationalContext?: OperationalContextService,
    @Optional() private readonly escrowRelease?: EscrowReleaseService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly jobsService?: JobsService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly outboxRepository?: OutboxRepository,
  ) {}

  /**
   * docs/specs/satellites/SAT-007-outbound-webhooks.spec.md — best-effort
   * durable outbox write (plan.md §1.1): milestonesRepository.approve/reject
   * already committed the state change before this runs; there is no
   * transaction left open to join, and this call site is already
   * fire-and-forget today via domainEventBus.emit() right above each call.
   */
  private emitMilestoneOutboxEvent(
    kind: "approved" | "rejected",
    input: {
      tenantId: string;
      orgId: string;
      userId: string;
      milestoneId: string;
      projectId: string;
      jobId: string;
      amount?: number;
      rejectionReason?: string;
    },
  ): void {
    if (!this.prisma || !this.outboxRepository) {
      return;
    }
    const recordedAt = new Date();
    const eventId = randomUUID();
    const base = {
      eventId,
      version: 1 as const,
      envelopeVersion: 2 as const,
      occurredAt: recordedAt.toISOString(),
      recordedAt: recordedAt.toISOString(),
      tenantId: input.tenantId,
      orgId: input.orgId,
      module: "milestones" as const,
      entityType: "Milestone" as const,
      entityId: input.milestoneId,
      actor: { type: "user" as const, id: input.userId },
    };

    const event =
      kind === "approved"
        ? milestoneApprovedV1EventSchema.parse({
            ...base,
            eventType: "milestone.approved.v1",
            correlationId: `milestone.approved.v1:${input.milestoneId}`,
            idempotencyKey: `milestone.approved.v1:${input.milestoneId}:${eventId}`,
            schemaRef: MILESTONE_APPROVED_V1_SCHEMA_REF,
            payload: {
              milestoneId: input.milestoneId,
              projectId: input.projectId,
              jobId: input.jobId,
              reviewerId: input.userId,
              amount: input.amount ?? 0,
            },
          })
        : milestoneRejectedV1EventSchema.parse({
            ...base,
            eventType: "milestone.rejected.v1",
            correlationId: `milestone.rejected.v1:${input.milestoneId}`,
            idempotencyKey: `milestone.rejected.v1:${input.milestoneId}:${eventId}`,
            schemaRef: MILESTONE_REJECTED_V1_SCHEMA_REF,
            payload: {
              milestoneId: input.milestoneId,
              projectId: input.projectId,
              jobId: input.jobId,
              reviewerId: input.userId,
              rejectionReason: input.rejectionReason ?? "",
            },
          });

    void this.outboxRepository.create(this.prisma, event).catch((err: unknown) =>
      this.logger.warn(`[Milestones] milestone.${kind}.v1 outbox write failed: ${String((err as Error)?.message ?? err)}`),
    );
  }

  private syncContext(tenantId: string, projectId: string, source: string, reason: string): void {
    this.operationalContext?.invalidateScope({
      tenantId,
      projectId,
      source,
      reason,
    });
  }

  async create(input: {
    tenantId: string;
    projectId: string;
    title: string;
    amount: number;
    sequence: number;
    userId: string;
    orgId: string;
    roles: string[];
    requestId: string;
  }): Promise<MilestoneRecord> {
    if (!input.title.trim()) {
      throw new BadRequestException("title is required");
    }

    const milestone = await this.milestonesRepository.create(input);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "milestone.create",
      entityType: "Milestone",
      entityId: milestone.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    const context = await this.milestonesRepository.getEventContext({
      tenantId: input.tenantId,
      milestoneId: milestone.id
    });
    await this.domainEventBus.emit(buildMilestoneCreatedEvent({
      tenantId: input.tenantId,
      milestoneId: milestone.id,
      actorId: input.userId,
      projectId: input.projectId,
      jobId: context.jobId,
      sequence: milestone.sequence,
      title: milestone.title,
      amount: milestone.amount
    }), {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      requestId: input.requestId
    });

    this.syncContext(input.tenantId, input.projectId, "milestone.created", "milestone created");

    return milestone;
  }

  async createByJob(input: {
    tenantId: string;
    jobId: string;
    title: string;
    amount: number;
    sequence: number;
    userId: string;
    orgId: string;
    roles: string[];
    requestId: string;
  }): Promise<MilestoneRecord> {
    const projectId = await this.milestonesRepository.resolveProjectIdByJob({
      tenantId: input.tenantId,
      jobId: input.jobId
    });

    return this.create({
      tenantId: input.tenantId,
      projectId,
      title: input.title,
      amount: input.amount,
      sequence: input.sequence,
      userId: input.userId,
      orgId: input.orgId,
      roles: input.roles,
      requestId: input.requestId
    });
  }

  async listByJob(input: {
    tenantId: string;
    jobId: string;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<MilestoneRecord[]> {
    return this.milestonesRepository.listByJob(input);
  }

  async submit(input: {
    tenantId: string;
    milestoneId: string;
    userId: string;
    orgId: string;
    roles: string[];
    requestId: string;
  }): Promise<MilestoneRecord> {
    const milestone = await this.milestonesRepository.submit(input);
    const context = await this.milestonesRepository.getEventContext({
      tenantId: input.tenantId,
      milestoneId: input.milestoneId
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "milestone.submit",
      entityType: "Milestone",
      entityId: milestone.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    const event = {
      type: "milestone.submitted",
      meta: {
        tenantId: input.tenantId,
        correlationId: `milestone:${milestone.id}:submitted`,
        actorId: input.userId,
        actorType: "user",
        occurredAt: new Date().toISOString(),
        version: 1
      },
      payload: {
        milestoneId: milestone.id,
        projectId: context.projectId,
        jobId: context.jobId,
        professionalId: input.userId,
        evidenceCount: context.evidenceCount,
        checklistComplete: context.evidenceCount > 0,
        submittedAt: new Date().toISOString(),
        clientUserId: context.clientUserId,
      },
      triggers: ["evidence-coach", "notification", "audit"]
    };

    await this.domainEventBus.emit(event, {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      requestId: input.requestId
    });

    void this.workspaceMemory.append(buildMilestoneWorkspaceMemoryRecord({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      milestoneId: milestone.id,
      projectId: context.projectId,
      jobId: context.jobId,
      title: milestone.title,
      amount: milestone.amount,
      status: milestone.status,
      action: "submitted",
      evidenceCount: context.evidenceCount,
    }));

    void this.intelligenceAgent?.evaluateMilestone({
      tenantId: input.tenantId,
      milestoneId: milestone.id,
      triggerEvent: "milestone.submitted",
    }).catch(() => undefined);

    return milestone;
  }

  async approve(input: {
    tenantId: string;
    milestoneId: string;
    userId: string;
    orgId: string;
    roles: string[];
    requestId: string;
  }): Promise<MilestoneRecord> {
    const milestone = await this.milestonesRepository.approve(input);
    const context = await this.milestonesRepository.getEventContext({
      tenantId: input.tenantId,
      milestoneId: input.milestoneId
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "milestone.approve",
      entityType: "Milestone",
      entityId: milestone.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    await this.domainEventBus.emit(buildMilestoneApprovedEvent({
      tenantId: input.tenantId,
      milestoneId: milestone.id,
      actorId: input.userId,
      projectId: context.projectId,
      jobId: context.jobId,
      amount: milestone.amount
    }), {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      requestId: input.requestId
    });

    void this.workspaceMemory.append(buildMilestoneWorkspaceMemoryRecord({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      milestoneId: milestone.id,
      projectId: context.projectId,
      jobId: context.jobId,
      title: milestone.title,
      amount: milestone.amount,
      status: milestone.status,
      action: "approved",
    }));

    this.syncContext(input.tenantId, context.projectId, "milestone.approved", "milestone approved");

    this.emitMilestoneOutboxEvent("approved", {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      milestoneId: milestone.id,
      projectId: context.projectId,
      jobId: context.jobId,
      amount: milestone.amount,
    });

    if (context.proUserId) {
      void this.notifications?.handleEvent({
        tenantId: input.tenantId,
        eventType: "milestone.approved",
        payload: {
          proUserId: context.proUserId,
          milestoneId: milestone.id,
          projectId: context.projectId,
          jobId: context.jobId,
        },
      }).catch(() => undefined);
    }

    void this.intelligenceAgent?.evaluateMilestone({
      tenantId: input.tenantId,
      milestoneId: milestone.id,
      triggerEvent: "milestone.approved",
    }).catch(() => undefined);

    // 1.3.B/C: Try automatic escrow release after approval (non-blocking).
    // Never swallow this silently — tryAutoRelease can return released:true
    // with a reconciliation blocker (money moved, DB write failed) or throw
    // after a real Stripe transfer already happened. Both must be logged
    // loudly, not discarded (0.15 in docs/AUDIT_REMEDIATION_PLAN.md).
    void this.escrowRelease?.tryAutoRelease(milestone.id, input.tenantId)
      .then((result) => {
        if (!result.released && result.blockers.length > 0) {
          this.logger.warn(`[MilestonesService] Auto-release blocked for ${milestone.id}: ${result.blockers.join(", ")}`);
        } else if (result.released && result.blockers.length > 0) {
          this.logger.error(`[MilestonesService] Auto-release for ${milestone.id} needs manual reconciliation: ${result.blockers.join(", ")}`);
        }
      })
      .catch((err) => {
        this.logger.error(`[MilestonesService] Auto-release threw for ${milestone.id}: ${(err as Error).message}`);
      });

    // Auto-complete job when all milestones are approved (non-blocking)
    if (context.jobId) {
      void this.milestonesRepository.checkAllMilestonesApproved({
        tenantId: input.tenantId,
        projectId: context.projectId,
      }).then((allApproved) => {
        if (allApproved) {
          return this.jobsService?.systemCompleteJob({
            tenantId: input.tenantId,
            jobId: context.jobId,
            requestId: input.requestId,
          });
        }
      }).catch(() => undefined);
    }

    return milestone;
  }

  async reject(input: {
    tenantId: string;
    milestoneId: string;
    reason: string;
    userId: string;
    orgId: string;
    roles: string[];
    requestId: string;
  }): Promise<MilestoneRecord> {
    if (!input.reason.trim()) {
      throw new BadRequestException("reason is required");
    }

    const milestone = await this.milestonesRepository.reject(input);
    const context = await this.milestonesRepository.getEventContext({
      tenantId: input.tenantId,
      milestoneId: input.milestoneId
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "milestone.reject",
      entityType: "Milestone",
      entityId: milestone.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    await this.domainEventBus.emit(buildMilestoneRejectedEvent({
      tenantId: input.tenantId,
      milestoneId: milestone.id,
      actorId: input.userId,
      projectId: context.projectId,
      jobId: context.jobId,
      reason: input.reason
    }), {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      requestId: input.requestId
    });

    void this.workspaceMemory.append(buildMilestoneWorkspaceMemoryRecord({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      milestoneId: milestone.id,
      projectId: context.projectId,
      jobId: context.jobId,
      title: milestone.title,
      amount: milestone.amount,
      status: milestone.status,
      action: "rejected",
      reason: input.reason,
    }));

    this.syncContext(input.tenantId, context.projectId, "milestone.rejected", "milestone rejected");

    this.emitMilestoneOutboxEvent("rejected", {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      milestoneId: milestone.id,
      projectId: context.projectId,
      jobId: context.jobId,
      rejectionReason: input.reason,
    });

    void this.intelligenceAgent?.evaluateMilestone({
      tenantId: input.tenantId,
      milestoneId: milestone.id,
      triggerEvent: "milestone.rejected",
    }).catch(() => undefined);

    return milestone;
  }

  async requestChanges(input: {
    tenantId: string;
    milestoneId: string;
    reason: string;
    userId: string;
    orgId: string;
    roles: string[];
    requestId: string;
  }): Promise<MilestoneRecord> {
    if (!input.reason.trim()) {
      throw new BadRequestException("reason is required");
    }

    const milestone = await this.milestonesRepository.requestChanges(input);
    const context = await this.milestonesRepository.getEventContext({
      tenantId: input.tenantId,
      milestoneId: input.milestoneId
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "milestone.request_changes",
      entityType: "Milestone",
      entityId: milestone.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: {
        reviewDecision: "request_changes",
        reason: input.reason
      }
    });

    await this.domainEventBus.emit(buildMilestoneRevisionRequestedEvent({
      tenantId: input.tenantId,
      milestoneId: milestone.id,
      actorId: input.userId,
      projectId: context.projectId,
      jobId: context.jobId,
      reason: input.reason
    }), {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      requestId: input.requestId
    });

    this.syncContext(input.tenantId, context.projectId, "milestone.changes_requested", "milestone changes requested");

    void this.intelligenceAgent?.evaluateMilestone({
      tenantId: input.tenantId,
      milestoneId: milestone.id,
      triggerEvent: "milestone.changes_requested",
    }).catch(() => undefined);

    return milestone;
  }
}
