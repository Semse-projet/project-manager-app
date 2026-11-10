import { BadRequestException, Inject, Injectable, Optional } from "@nestjs/common";
import { type DisputeRecord } from "../../common/domain-store.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import type { OperationalContextService } from "../ai-models/context/operational-context.service.js";
import { OPERATIONAL_CONTEXT_SERVICE } from "../ai-models/context/operational-context.token.js";
import { DomainEventBus, type DomainEventEmitOptions } from "../domain-events/domain-event-bus.service.js";
import { OutboxRepository } from "../domain-events/outbox.repository.js";
import { ProjectLifecycleProjectionEventProducer } from "../domain-events/project-lifecycle-projection-event-producer.service.js";
import { buildDisputeWorkspaceMemoryRecord } from "../knowledge/workspace-memory.business-records.js";
import { WorkspaceMemoryRepository } from "../knowledge/workspace-memory.repository.js";
import { buildDisputeResolvedEvent, type DisputeResolutionType } from "./disputes.events.js";
import { DisputesRepository, type DisputeWriteHook } from "./disputes.repository.js";
import {
  buildDisputeV2Event,
  resolveDisputeEventsV2Mode,
  type DisputeEventsV2Mode,
} from "./dispute-events-v2.js";
import type { DisputeV2EventType } from "@semse/schemas";

type DisputeActorInput = { tenantId: string; orgId: string; userId: string; requestId: string };

@Injectable()
export class DisputesService {
  constructor(
    private readonly disputesRepository: DisputesRepository,
    private readonly auditService: AuditService,
    private readonly domainEventBus: DomainEventBus,
    private readonly workspaceMemoryRepository: WorkspaceMemoryRepository,
    @Optional() @Inject(OPERATIONAL_CONTEXT_SERVICE)
    private readonly operationalContext?: OperationalContextService,
    @Optional()
    private readonly lifecycleProjectionEvents?: ProjectLifecycleProjectionEventProducer,
    @Optional()
    private readonly outboxRepository?: OutboxRepository,
  ) {}

  /**
   * Event backbone F2 (D1): per-tenant mode. Without an outbox repository the v2 path cannot run, so the service
   * falls back to `off` — the legacy bus keeps every effect and nothing is lost.
   */
  private eventsV2Mode(tenantId: string): DisputeEventsV2Mode {
    return this.outboxRepository ? resolveDisputeEventsV2Mode(tenantId) : "off";
  }

  /** In `shadow`/`on`, writes the v2 event to the outbox inside the dispute write's own transaction. */
  private v2Hook(
    mode: DisputeEventsV2Mode,
    eventType: DisputeV2EventType,
    input: DisputeActorInput,
    payload: (written: Parameters<DisputeWriteHook>[1]) => Record<string, unknown>,
  ): DisputeWriteHook | undefined {
    const outbox = this.outboxRepository;
    if (mode === "off" || !outbox) return undefined;
    return async (tx, written) => {
      await outbox.create(tx, buildDisputeV2Event({
        eventType,
        tenantId: input.tenantId,
        orgId: input.orgId,
        actorUserId: input.userId,
        requestId: input.requestId,
        effectsMode: mode,
        disputeId: written.record.id,
        payload: {
          disputeId: written.record.id,
          projectId: written.projectId,
          jobId: written.jobId,
          ...payload(written),
        },
      }));
    };
  }

  /** D3: once the consumer owns notifications and agent triggers (`on`), the legacy emit keeps only the audit side. */
  private legacyEmitOptions(mode: DisputeEventsV2Mode): DomainEventEmitOptions | undefined {
    return mode === "on" ? { effects: "audit-only" } : undefined;
  }

  private syncContext(tenantId: string, projectId: string | undefined, source: string, reason: string): void {
    this.operationalContext?.invalidateScope({
      tenantId,
      projectId,
      source,
      reason,
    });
  }

  async list(input: { tenantId: string; orgId: string; userId: string; roles: string[] }): Promise<DisputeRecord[]> {
    return this.disputesRepository.list(input);
  }

  async create(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    projectId?: string;
    jobId?: string;
    reason: string;
    requestId: string;
  }): Promise<DisputeRecord> {
    const mode = this.eventsV2Mode(input.tenantId);
    const dispute = await this.disputesRepository.create(
      input,
      this.v2Hook(mode, "dispute.opened.v1", input, () => ({ raisedById: input.userId })),
    );
    const context = await this.disputesRepository.getEventContext({
      tenantId: input.tenantId,
      disputeId: dispute.id
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "dispute.create",
      entityType: "Dispute",
      entityId: dispute.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    const event = {
      type: "dispute.opened",
      meta: {
        tenantId: input.tenantId,
        correlationId: `dispute:${dispute.id}:opened`,
        actorId: input.userId,
        actorType: "user",
        occurredAt: new Date().toISOString(),
        version: 1
      },
      payload: {
        disputeId: dispute.id,
        jobId: context.jobId,
        projectId: context.projectId,
        raisedById: context.raisedById ?? input.userId,
        reasonCode: "manual_open",
        reason: context.reason
      },
      triggers: ["dispute", "risk", "notification", "audit"]
    };

    await this.domainEventBus.emit(event, {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      requestId: input.requestId
    }, this.legacyEmitOptions(mode));

    await this.workspaceMemoryRepository.append(
      buildDisputeWorkspaceMemoryRecord({
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        disputeId: dispute.id,
        projectId: context.projectId,
        jobId: context.jobId,
        status: dispute.status,
        reason: context.reason,
        action: "opened"
      })
    );

    return dispute;
  }

  async assign(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    disputeId: string;
    assigneeUserId: string;
    requestId: string;
  }): Promise<DisputeRecord> {
    if (!input.assigneeUserId) {
      throw new BadRequestException("assigneeUserId is required");
    }

    const mode = this.eventsV2Mode(input.tenantId);
    const dispute = await this.disputesRepository.assign(
      input,
      this.v2Hook(mode, "dispute.assigned.v1", input, () => ({ assigneeUserId: input.assigneeUserId })),
    );

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "dispute.assign",
      entityType: "Dispute",
      entityId: dispute.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    const context = await this.disputesRepository.getEventContext({
      tenantId: input.tenantId,
      disputeId: dispute.id
    });

    await this.workspaceMemoryRepository.append(
      buildDisputeWorkspaceMemoryRecord({
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        disputeId: dispute.id,
        projectId: context.projectId,
        jobId: context.jobId,
        status: dispute.status,
        reason: context.reason,
        action: "assigned",
        assigneeUserId: dispute.assigneeUserId
      })
    );

    this.syncContext(input.tenantId, context.projectId, "dispute.assigned", "dispute assigned");

    await this.domainEventBus.emit({
      type: "dispute.assigned",
      meta: {
        tenantId: input.tenantId,
        correlationId: `dispute:${dispute.id}:assigned`,
        actorId: input.userId,
        actorType: "user",
        occurredAt: new Date().toISOString(),
        version: 1
      },
      payload: {
        disputeId: dispute.id,
        assigneeId: input.assigneeUserId,
        jobId: context.jobId,
        projectId: context.projectId
      },
      triggers: ["notification", "audit"]
    }, {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      requestId: input.requestId
    }, this.legacyEmitOptions(mode));

    return dispute;
  }

  async submitEvidence(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    disputeId: string;
    evidenceIds: string[];
    requestId: string;
  }): Promise<DisputeRecord> {
    const mode = this.eventsV2Mode(input.tenantId);
    const dispute = await this.disputesRepository.submitEvidence(
      input,
      this.v2Hook(mode, "dispute.evidence_submitted.v1", input, ({ record }) => ({
        submittedById: input.userId,
        evidenceIds: input.evidenceIds,
        totalEvidenceCount: record.evidenceBundleIds.length,
      })),
    );

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "dispute.submit_evidence",
      entityType: "Dispute",
      entityId: dispute.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: { evidenceIds: input.evidenceIds }
    });

    const context = await this.disputesRepository.getEventContext({
      tenantId: input.tenantId,
      disputeId: dispute.id
    });

    await this.domainEventBus.emit({
      type: "dispute.evidence_submitted",
      meta: {
        tenantId: input.tenantId,
        correlationId: `dispute:${dispute.id}:evidence_submitted`,
        actorId: input.userId,
        actorType: "user",
        occurredAt: new Date().toISOString(),
        version: 1
      },
      payload: {
        disputeId: dispute.id,
        jobId: context.jobId,
        projectId: context.projectId,
        submittedById: input.userId,
        evidenceIds: input.evidenceIds,
        totalEvidenceCount: dispute.evidenceBundleIds.length
      },
      triggers: []
    }, {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      requestId: input.requestId
    }, this.legacyEmitOptions(mode));

    return dispute;
  }

  async markUnderReview(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    disputeId: string;
    requestId: string;
  }): Promise<DisputeRecord> {
    const mode = this.eventsV2Mode(input.tenantId);
    const dispute = await this.disputesRepository.markUnderReview(
      input,
      this.v2Hook(mode, "dispute.under_review.v1", input, ({ record }) => ({
        assigneeUserId: record.assigneeUserId ?? null,
        evidenceCount: record.evidenceBundleIds.length,
      })),
    );

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "dispute.under_review",
      entityType: "Dispute",
      entityId: dispute.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    const context = await this.disputesRepository.getEventContext({
      tenantId: input.tenantId,
      disputeId: dispute.id
    });

    await this.workspaceMemoryRepository.append(
      buildDisputeWorkspaceMemoryRecord({
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        disputeId: dispute.id,
        projectId: context.projectId,
        jobId: context.jobId,
        status: dispute.status,
        reason: context.reason,
        action: "under_review"
      })
    );

    await this.domainEventBus.emit({
      type: "dispute.under_review",
      meta: {
        tenantId: input.tenantId,
        correlationId: `dispute:${dispute.id}:under_review`,
        actorId: input.userId,
        actorType: "user",
        occurredAt: new Date().toISOString(),
        version: 1
      },
      payload: {
        disputeId: dispute.id,
        jobId: context.jobId,
        projectId: context.projectId,
        assigneeUserId: dispute.assigneeUserId,
        evidenceCount: dispute.evidenceBundleIds.length
      },
      triggers: []
    }, {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      requestId: input.requestId
    }, this.legacyEmitOptions(mode));

    return dispute;
  }

  async resolve(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    disputeId: string;
    resolution: string;
    resolutionType: DisputeResolutionType;
    requestId: string;
  }): Promise<DisputeRecord> {
    if (!input.resolution) {
      throw new BadRequestException("resolution is required");
    }

    const mode = this.eventsV2Mode(input.tenantId);
    const dispute = await this.disputesRepository.resolve(
      input,
      this.v2Hook(mode, "dispute.resolved.v1", input, () => ({
        resolvedById: input.userId,
        resolutionType: input.resolutionType,
      })),
    );

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "dispute.resolve",
      entityType: "Dispute",
      entityId: dispute.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    const context = await this.disputesRepository.getEventContext({
      tenantId: input.tenantId,
      disputeId: dispute.id
    });

    await this.domainEventBus.emit(buildDisputeResolvedEvent({
      tenantId: input.tenantId,
      disputeId: dispute.id,
      jobId: context.jobId,
      resolvedById: input.userId,
      resolutionType: input.resolutionType,
      resolution: input.resolution
    }), {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      requestId: input.requestId
    }, this.legacyEmitOptions(mode));
    await this.lifecycleProjectionEvents?.emit({
      tenantId: input.tenantId,
      orgId: input.orgId,
      projectId: context.projectId,
      sourceEventType: "dispute.resolved",
      sourceEntityType: "Dispute",
      sourceEntityId: dispute.id,
      actorType: "user",
      actorId: input.userId,
      correlationId: input.requestId,
    });

    await this.workspaceMemoryRepository.append(
      buildDisputeWorkspaceMemoryRecord({
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        disputeId: dispute.id,
        projectId: context.projectId,
        jobId: context.jobId,
        status: dispute.status,
        reason: context.reason,
        action: "resolved",
        resolution: dispute.resolution
      })
    );

    this.syncContext(input.tenantId, context.projectId, "dispute.resolved", "dispute resolved");

    return dispute;
  }

  async archive(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    disputeId: string;
    requestId: string;
  }): Promise<{ id: string; archivedAt: string }> {
    const context = await this.disputesRepository.getEventContext({
      tenantId: input.tenantId,
      disputeId: input.disputeId
    });
    const archived = await this.disputesRepository.archive(input);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "dispute.archive",
      entityType: "Dispute",
      entityId: archived.id,
      requestId: input.requestId,
      timestamp: archived.archivedAt
    });

    this.syncContext(input.tenantId, context.projectId, "dispute.archived", "dispute archived");
    await this.lifecycleProjectionEvents?.emit({
      tenantId: input.tenantId,
      orgId: input.orgId,
      projectId: context.projectId,
      sourceEventType: "dispute.archived",
      sourceEntityType: "Dispute",
      sourceEntityId: archived.id,
      actorType: "user",
      actorId: input.userId,
      correlationId: input.requestId,
    });

    return archived;
  }

  async restore(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    disputeId: string;
    requestId: string;
  }): Promise<{ id: string; restored: true }> {
    const context = await this.disputesRepository.getEventContext({
      tenantId: input.tenantId,
      disputeId: input.disputeId
    });
    const restored = await this.disputesRepository.restore(input);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "dispute.restore",
      entityType: "Dispute",
      entityId: restored.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    this.syncContext(input.tenantId, context.projectId, "dispute.restored", "dispute restored");
    await this.lifecycleProjectionEvents?.emit({
      tenantId: input.tenantId,
      orgId: input.orgId,
      projectId: context.projectId,
      sourceEventType: "dispute.restored",
      sourceEntityType: "Dispute",
      sourceEntityId: restored.id,
      actorType: "user",
      actorId: input.userId,
      correlationId: input.requestId,
    });

    return restored;
  }
}
