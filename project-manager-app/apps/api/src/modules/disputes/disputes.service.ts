import { BadRequestException, Inject, Injectable, Optional } from "@nestjs/common";
import { type DisputeRecord } from "../../common/domain-store.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import type { OperationalContextService } from "../ai-models/context/operational-context.service.js";
import { OPERATIONAL_CONTEXT_SERVICE } from "../ai-models/context/operational-context.token.js";
import { DomainEventBus } from "../domain-events/domain-event-bus.service.js";
import { buildDisputeWorkspaceMemoryRecord } from "../knowledge/workspace-memory.business-records.js";
import { WorkspaceMemoryRepository } from "../knowledge/workspace-memory.repository.js";
import { buildDisputeResolvedEvent, type DisputeResolutionType } from "./disputes.events.js";
import { DisputesRepository } from "./disputes.repository.js";

@Injectable()
export class DisputesService {
  constructor(
    private readonly disputesRepository: DisputesRepository,
    private readonly auditService: AuditService,
    private readonly domainEventBus: DomainEventBus,
    private readonly workspaceMemoryRepository: WorkspaceMemoryRepository,
    @Optional() @Inject(OPERATIONAL_CONTEXT_SERVICE)
    private readonly operationalContext?: OperationalContextService,
  ) {}

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
    const dispute = await this.disputesRepository.create(input);
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

    const dispute = await this.disputesRepository.assign(input);

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
    });

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
    const dispute = await this.disputesRepository.submitEvidence(input);

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
    });

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
    const dispute = await this.disputesRepository.markUnderReview(input);

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
    });

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

    const dispute = await this.disputesRepository.resolve(input);

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

    return restored;
  }
}
