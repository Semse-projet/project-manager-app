import { Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { type PaymentTxnRecord, type ProjectRecord } from "../../common/domain-store.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import type { OperationalContextService } from "../ai-models/context/operational-context.service.js";
import { OPERATIONAL_CONTEXT_SERVICE } from "../ai-models/context/operational-context.token.js";
import { buildProjectWorkspaceMemoryRecord } from "../knowledge/workspace-memory.business-records.js";
import { WorkspaceMemoryRepository } from "../knowledge/workspace-memory.repository.js";
import { MilestonesRepository } from "../milestones/milestones.repository.js";
import { ProjectLifecycleProjectionEventProducer } from "../domain-events/project-lifecycle-projection-event-producer.service.js";
import { isProjectLifecycleProjectionEnabled } from "./project-lifecycle-projection.js";
import { ProjectsRepository } from "./projects.repository.js";
import {
  assertProjectLifecycleTransition,
  assertProjectStatusUpdatable,
  type ProjectActor
} from "./projects.policy.js";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly projectsRepository: ProjectsRepository,
    private readonly milestonesRepository: MilestonesRepository,
    private readonly auditService: AuditService,
    private readonly workspaceMemoryRepository: WorkspaceMemoryRepository,
    @Optional() @Inject(OPERATIONAL_CONTEXT_SERVICE)
    private readonly operationalContext?: OperationalContextService,
    @Optional()
    private readonly lifecycleProjectionEvents?: ProjectLifecycleProjectionEventProducer,
  ) {}

  async list(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    status?: ProjectRecord["status"];
    jobId?: string;
  }): Promise<ProjectRecord[]> {
    return this.projectsRepository.list(input);
  }

  async detail(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    projectId: string;
  }): Promise<ProjectRecord> {
    return this.projectsRepository.findById(input);
  }

  async milestones(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    projectId: string;
  }) {
    await this.projectsRepository.findById(input);
    return this.milestonesRepository.listByProject(input);
  }

  async payments(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    projectId: string;
  }): Promise<PaymentTxnRecord[]> {
    return this.projectsRepository.listPayments(input);
  }

  async escrow(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    projectId: string;
  }) {
    return this.projectsRepository.getEscrowSummary(input);
  }

  async lifecycleProjection(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    projectId: string;
  }) {
    if (!isProjectLifecycleProjectionEnabled(input.tenantId)) {
      throw new NotFoundException("Project lifecycle projection is not available");
    }

    return this.projectsRepository.getLifecycleProjection(input);
  }

  async updateStatus(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    projectId: string;
    status: ProjectRecord["status"];
    requestId: string;
  }): Promise<ProjectRecord> {
    const actor: ProjectActor = {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles
    };
    const snapshot = await this.projectsRepository.getStatusChangeContext(input);
    const previousStatus = snapshot.project.status;

    assertProjectStatusUpdatable(actor, snapshot.ownership, input.status);
    assertProjectLifecycleTransition(snapshot, input.status);

    const project =
      previousStatus === input.status
        ? snapshot.project
        : await this.projectsRepository.updateStatus({
            tenantId: input.tenantId,
            projectId: input.projectId,
            status: input.status
          });

    if (previousStatus === project.status) {
      return project;
    }

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "project.status.update",
      entityType: "Project",
      entityId: project.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      beforeJson: {
        status: previousStatus
      },
      afterJson: {
        status: project.status
      }
    });

    await this.workspaceMemoryRepository.append(
      buildProjectWorkspaceMemoryRecord({
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        projectId: project.id,
        jobId: project.jobId,
        previousStatus,
        status: project.status
      })
    );

    this.operationalContext?.invalidateScope({
      tenantId: input.tenantId,
      projectId: project.id,
      source: "project.status.update",
      reason: `project status changed to ${project.status}`,
    });
    await this.lifecycleProjectionEvents?.emit({
      tenantId: input.tenantId,
      orgId: input.orgId,
      projectId: project.id,
      sourceEventType: "project.status.updated",
      sourceEntityType: "Project",
      sourceEntityId: project.id,
      actorType: "user",
      actorId: input.userId,
      correlationId: input.requestId,
    });

    return project;
  }
}
