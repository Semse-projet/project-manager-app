import { BadRequestException, Inject, Injectable, Optional } from "@nestjs/common";
import { type MilestoneRecord } from "../../common/domain-store.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import type { OperationalContextService } from "../ai-models/context/operational-context.service.js";
import { OPERATIONAL_CONTEXT_SERVICE } from "../ai-models/context/operational-context.token.js";
import { WorkspaceMemoryRepository } from "../knowledge/workspace-memory.repository.js";
import { buildMilestoneWorkspaceMemoryRecord } from "../knowledge/workspace-memory.business-records.js";
import { DomainEventBus } from "../domain-events/domain-event-bus.service.js";
import { MilestonesRepository } from "./milestones.repository.js";

@Injectable()
export class MilestonesService {
  constructor(
    private readonly milestonesRepository: MilestonesRepository,
    private readonly auditService: AuditService,
    private readonly domainEventBus: DomainEventBus,
    private readonly workspaceMemory: WorkspaceMemoryRepository,
    @Optional() @Inject(OPERATIONAL_CONTEXT_SERVICE)
    private readonly operationalContext?: OperationalContextService,
  ) {}

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
        submittedAt: new Date().toISOString()
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

    this.syncContext(input.tenantId, context.projectId, "milestone.changes_requested", "milestone changes requested");

    return milestone;
  }
}
