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
import { DomainEventBus, type DomainEventEmitOptions } from "../domain-events/domain-event-bus.service.js";
import { OutboxRepository } from "../domain-events/outbox.repository.js";
import { BuildOpsIntelligenceAgent } from "../operational-intelligence/buildops-intelligence.agent.js";
import { MilestonesRepository, type MilestoneWriteHook } from "./milestones.repository.js";
import {
  buildMilestoneV2Event,
  MILESTONE_REASON_MAX_LENGTH,
  resolveMilestoneEventsV2Mode,
  type MilestoneEventsV2Mode,
} from "./milestone-events-v2.js";
import type { MilestoneV2EventType } from "@semse/schemas";
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

  /**
   * Event backbone F2, slice 2b (D1): per-tenant mode. Without Prisma or the outbox the v2 path cannot run, so the
   * service stays in `off` — the legacy bus and the SAT-007 best-effort write keep every effect.
   */
  private eventsV2Mode(tenantId: string): MilestoneEventsV2Mode {
    return this.prisma && this.outboxRepository ? resolveMilestoneEventsV2Mode(tenantId) : "off";
  }

  /**
   * In `shadow`/`on`, writes the v2 event inside the milestone write's own transaction. `ran()` tells whether the
   * repository actually executed it (the in-memory persistence mode never does): if not, the call is treated as `off`
   * so no effect is lost.
   */
  private v2Hook(
    mode: MilestoneEventsV2Mode,
    eventType: MilestoneV2EventType,
    input: { tenantId: string; orgId: string; userId: string; requestId: string },
    payload: (tx: Parameters<MilestoneWriteHook>[0], written: Parameters<MilestoneWriteHook>[1]) => Promise<Record<string, unknown>>,
  ): { hook?: MilestoneWriteHook; effective: () => MilestoneEventsV2Mode } {
    const outbox = this.outboxRepository;
    if (mode === "off" || !outbox) return { effective: () => "off" };
    let ran = false;
    return {
      hook: async (tx, written) => {
        await outbox.create(tx, buildMilestoneV2Event({
          eventType,
          tenantId: input.tenantId,
          orgId: input.orgId,
          actorUserId: input.userId,
          requestId: input.requestId,
          effectsMode: mode,
          milestoneId: written.milestoneId,
          payload: {
            milestoneId: written.milestoneId,
            projectId: written.projectId,
            jobId: written.jobId,
            ...(await payload(tx, written)),
          },
        }));
        ran = true;
      },
      effective: () => (ran ? mode : "off"),
    };
  }

  /** D3: once the consumer owns notifications and agent triggers (`on`), the legacy emit keeps only the audit side. */
  private legacyEmitOptions(mode: MilestoneEventsV2Mode): DomainEventEmitOptions | undefined {
    return mode === "on" ? { effects: "audit-only" } : undefined;
  }

  private assertReasonLength(reason: string): void {
    // The v2 payloads (and the SAT-007 rejected.v1 event) cap the reason at 2000 characters. Checked before the
    // write: an over-long reason used to commit the transition and then fail building the SAT-007 event.
    if (reason.trim().length > MILESTONE_REASON_MAX_LENGTH) {
      throw new BadRequestException(`reason must be at most ${MILESTONE_REASON_MAX_LENGTH} characters`);
    }
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

    const v2 = this.v2Hook(this.eventsV2Mode(input.tenantId), "milestone.created.v1", input, async () => ({
      sequence: input.sequence,
      amount: input.amount,
    }));
    const milestone = await this.milestonesRepository.create(input, v2.hook);
    const mode = v2.effective();

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
    }, this.legacyEmitOptions(mode));

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
    const v2 = this.v2Hook(this.eventsV2Mode(input.tenantId), "milestone.submitted.v1", input, async (tx, written) => ({
      professionalId: input.userId,
      evidenceCount: await tx.evidence.count({ where: { milestoneId: written.milestoneId } }),
    }));
    const milestone = await this.milestonesRepository.submit(input, v2.hook);
    const mode = v2.effective();
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
    }, this.legacyEmitOptions(mode));

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
    const v2 = this.v2Hook(this.eventsV2Mode(input.tenantId), "milestone.approved.v1", input, async (tx, written) => ({
      reviewerId: input.userId,
      // Same payload as the SAT-007 best-effort write: the committed milestone amount.
      amount: Number((await tx.milestone.findUniqueOrThrow({
        where: { id: written.milestoneId },
        select: { amount: true },
      })).amount),
    }));
    const milestone = await this.milestonesRepository.approve(input, v2.hook);
    const mode = v2.effective();
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
    }, this.legacyEmitOptions(mode));

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

    // shadow/on: approved.v1 was already written in the approval transaction (D4); off: SAT-007 best-effort write.
    if (mode === "off") {
      this.emitMilestoneOutboxEvent("approved", {
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        milestoneId: milestone.id,
        projectId: context.projectId,
        jobId: context.jobId,
        amount: milestone.amount,
      });
    }

    // In `on` the milestone-effects.v1 consumer sends this notification (re-reading the professional).
    if (context.proUserId && mode !== "on") {
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

    this.assertReasonLength(input.reason);
    const v2 = this.v2Hook(this.eventsV2Mode(input.tenantId), "milestone.rejected.v1", input, async () => ({
      reviewerId: input.userId,
      rejectionReason: input.reason,
    }));
    const milestone = await this.milestonesRepository.reject(input, v2.hook);
    const mode = v2.effective();
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
    }, this.legacyEmitOptions(mode));

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

    if (mode === "off") {
      this.emitMilestoneOutboxEvent("rejected", {
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        milestoneId: milestone.id,
        projectId: context.projectId,
        jobId: context.jobId,
        rejectionReason: input.reason,
      });
    }

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

    this.assertReasonLength(input.reason);
    const v2 = this.v2Hook(this.eventsV2Mode(input.tenantId), "milestone.revision_requested.v1", input, async () => ({
      requestedById: input.userId,
      instructions: input.reason,
    }));
    const milestone = await this.milestonesRepository.requestChanges(input, v2.hook);
    const mode = v2.effective();
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
    }, this.legacyEmitOptions(mode));

    this.syncContext(input.tenantId, context.projectId, "milestone.changes_requested", "milestone changes requested");

    void this.intelligenceAgent?.evaluateMilestone({
      tenantId: input.tenantId,
      milestoneId: milestone.id,
      triggerEvent: "milestone.changes_requested",
    }).catch(() => undefined);

    return milestone;
  }
}
