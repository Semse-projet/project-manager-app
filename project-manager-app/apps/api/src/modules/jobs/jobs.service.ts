import { BadRequestException, Inject, Injectable, Logger, Optional, UnprocessableEntityException } from "@nestjs/common";
import { type JobRecord } from "../../common/domain-store.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { OperationalContextService } from "../ai-models/context/operational-context.service.js";
import { OPERATIONAL_CONTEXT_SERVICE } from "../ai-models/context/operational-context.token.js";
import { DomainEventBus } from "../domain-events/domain-event-bus.service.js";
import {
  buildJobPreferredProfessionalWorkspaceMemoryRecord,
  buildJobWorkspaceMemoryRecord,
} from "../knowledge/workspace-memory.business-records.js";
import { WorkspaceMemoryRepository } from "../knowledge/workspace-memory.repository.js";
import { JobsRepository } from "./jobs.repository.js";
import type { SemseAgentsService } from "../semse-agents/semse-agents.service.js";
import type { NotificationsService } from "../notifications/notifications.service.js";

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly jobsRepository: JobsRepository,
    private readonly auditService: AuditService,
    private readonly domainEventBus: DomainEventBus,
    private readonly workspaceMemoryRepository: WorkspaceMemoryRepository,
    private readonly prisma: PrismaService,
    @Optional() @Inject(OPERATIONAL_CONTEXT_SERVICE)
    private readonly operationalContext?: OperationalContextService,
    @Optional() private readonly semseAgents?: SemseAgentsService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  private syncContext(tenantId: string, source: string, reason: string): void {
    this.operationalContext?.invalidateScope({
      tenantId,
      source,
      reason,
    });
  }

  private buildStoredLocation(input: {
    locationType?: "remote" | "on_site" | "hybrid";
    city?: string;
  }): string | undefined {
    const city = input.city?.trim();
    if (input.locationType === "remote") {
      return city ? `Remote · ${city}` : "Remote";
    }
    if (input.locationType === "hybrid") {
      return city ? `Hybrid · ${city}` : "Hybrid";
    }
    return city || undefined;
  }

  private parsePreferredProfessionalBody(body: string | null | undefined): JobRecord["preferredProfessional"] | undefined {
    if (typeof body !== "string" || body.trim().length === 0) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      const userId = typeof parsed.userId === "string" && parsed.userId.trim().length > 0
        ? parsed.userId.trim()
        : null;
      const displayName = typeof parsed.displayName === "string" && parsed.displayName.trim().length > 0
        ? parsed.displayName.trim()
        : null;
      const publicSlug = typeof parsed.publicSlug === "string" && parsed.publicSlug.trim().length > 0
        ? parsed.publicSlug.trim()
        : undefined;

      if (!userId || !displayName) {
        return undefined;
      }

      return {
        userId,
        displayName,
        publicSlug,
      };
    } catch {
      return undefined;
    }
  }

  private async loadPreferredProfessionalMap(input: {
    tenantId: string;
    jobIds: string[];
  }): Promise<Map<string, NonNullable<JobRecord["preferredProfessional"]>>> {
    if (input.jobIds.length === 0) {
      return new Map();
    }

    const entries = await this.prisma.workspaceMemoryEntry.findMany({
      where: {
        tenantId: input.tenantId,
        workspaceId: {
          in: input.jobIds.map((jobId) => `job:${jobId}`),
        },
        kind: "decision",
        tags: {
          has: "preferred-professional",
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        workspaceId: true,
        body: true,
      },
    });

    const preferredByJobId = new Map<string, NonNullable<JobRecord["preferredProfessional"]>>();
    for (const entry of entries) {
      const jobId = entry.workspaceId.startsWith("job:") ? entry.workspaceId.slice(4) : entry.workspaceId;
      if (preferredByJobId.has(jobId)) {
        continue;
      }

      const preferredProfessional = this.parsePreferredProfessionalBody(entry.body);
      if (!preferredProfessional) {
        continue;
      }

      preferredByJobId.set(jobId, preferredProfessional);
    }

    return preferredByJobId;
  }

  private async enrichJobsWithPreferredProfessional(input: {
    tenantId: string;
    jobs: JobRecord[];
  }): Promise<JobRecord[]> {
    if (input.jobs.length === 0) {
      return input.jobs;
    }

    const preferredByJobId = await this.loadPreferredProfessionalMap({
      tenantId: input.tenantId,
      jobIds: input.jobs.map((job) => job.id),
    });

    return input.jobs.map((job) => {
      const preferredProfessional = preferredByJobId.get(job.id);
      return preferredProfessional ? { ...job, preferredProfessional } : job;
    });
  }

  private async enrichJobWithPreferredProfessional(input: {
    tenantId: string;
    job: JobRecord;
  }): Promise<JobRecord> {
    const [enriched] = await this.enrichJobsWithPreferredProfessional({
      tenantId: input.tenantId,
      jobs: [input.job],
    });
    return enriched;
  }

  private async enrichJobsWithClientUser(jobs: JobRecord[]): Promise<JobRecord[]> {
    if (jobs.length === 0) return jobs;
    const orgIds = [...new Set(jobs.map((j) => j.clientOrgId).filter((id): id is string => Boolean(id)))];
    if (orgIds.length === 0) return jobs;
    const memberships = await this.prisma.membership.findMany({
      where: { orgId: { in: orgIds } },
      select: { orgId: true, userId: true },
      distinct: ["orgId"],
    });
    const clientUserByOrgId = new Map(memberships.map((m) => [m.orgId, m.userId]));
    return jobs.map((j) => {
      const userId = j.clientOrgId ? clientUserByOrgId.get(j.clientOrgId) : undefined;
      return userId ? { ...j, clientUserId: userId } : j;
    });
  }

  async update(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    jobId: string;
    patch: Partial<{
      title: string;
      scope: string;
      category: string;
      budgetType: string;
      budgetMin: number;
      budgetMax: number;
      locationType: string;
      city: string;
      urgency: string;
      deadline: string;
    }>;
    requestId: string;
  }): Promise<JobRecord> {
    if (
      input.patch.budgetMin !== undefined &&
      input.patch.budgetMax !== undefined &&
      input.patch.budgetMin > input.patch.budgetMax
    ) {
      throw new BadRequestException("budgetMin cannot be greater than budgetMax");
    }

    const storedLocation = input.patch.locationType || input.patch.city
      ? this.buildStoredLocation({
          locationType: input.patch.locationType as "remote" | "on_site" | "hybrid" | undefined,
          city: input.patch.city,
        })
      : undefined;

    const job = await this.jobsRepository.updateFields({
      tenantId: input.tenantId,
      jobId: input.jobId,
      fields: {
        ...(input.patch.title !== undefined && { title: input.patch.title }),
        ...(input.patch.scope !== undefined && { scope: input.patch.scope }),
        ...(input.patch.category !== undefined && { category: input.patch.category }),
        ...(input.patch.budgetType !== undefined && { budgetType: input.patch.budgetType }),
        ...(input.patch.budgetMin !== undefined && { budgetMin: input.patch.budgetMin }),
        ...(input.patch.budgetMax !== undefined && { budgetMax: input.patch.budgetMax }),
        ...(input.patch.urgency !== undefined && { urgency: input.patch.urgency }),
        ...(input.patch.deadline !== undefined && { deadline: input.patch.deadline }),
        ...(storedLocation !== undefined && { location: storedLocation }),
      },
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "job.update",
      entityType: "Job",
      entityId: input.jobId,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: input.patch,
    });

    this.syncContext(input.tenantId, "job.updated", "job fields updated");

    return this.enrichJobWithPreferredProfessional({
      tenantId: input.tenantId,
      job,
    });
  }

  async list(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    status?: JobRecord["status"];
  }): Promise<JobRecord[]> {
    const jobs = await this.jobsRepository.listByTenant(input);
    const enriched = await this.enrichJobsWithPreferredProfessional({ tenantId: input.tenantId, jobs });
    return this.enrichJobsWithClientUser(enriched);
  }

  async detail(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    jobId: string;
  }): Promise<JobRecord> {
    const job = await this.jobsRepository.findById(input);
    const [withClientUser] = await this.enrichJobsWithClientUser([job]);
    return this.enrichJobWithPreferredProfessional({
      tenantId: input.tenantId,
      job: withClientUser ?? job,
    });
  }

  async create(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    title: string;
    category?: string;
    scope: string;
    budgetType?: string;
    budgetMin?: number;
    budgetMax?: number;
    locationType?: "remote" | "on_site" | "hybrid";
    city?: string;
    urgency?: string;
    deadline?: string;
    preferredProfessional?: {
      userId: string;
      displayName: string;
      publicSlug?: string;
    };
    requestId: string;
  }): Promise<JobRecord> {
    if (input.budgetMin !== undefined && input.budgetMax !== undefined && input.budgetMin > input.budgetMax) {
      throw new BadRequestException("budgetMin cannot be greater than budgetMax");
    }

    const storedLocation = this.buildStoredLocation({
      locationType: input.locationType,
      city: input.city,
    });
    const storedDeadline = input.deadline ? new Date(input.deadline) : undefined;
    if (storedDeadline && Number.isNaN(storedDeadline.getTime())) {
      throw new BadRequestException("deadline is invalid");
    }

    this.logger.log(`[POST /v1/jobs] creating job tenantId=${input.tenantId} userId=${input.userId} category=${input.category ?? "none"}`);

    const job = await this.jobsRepository.create({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      title: input.title,
      category: input.category,
      scope: input.scope,
      budgetType: input.budgetType,
      budgetMin: input.budgetMin,
      budgetMax: input.budgetMax,
      location: storedLocation,
      urgency: input.urgency,
      deadline: storedDeadline,
    });

    this.logger.log(`[POST /v1/jobs] Job created: jobId=${job.id} — firing background tasks`);

    // ── Audit + events + workspace memory are non-critical background tasks.
    // Run fire-and-forget so they never block or time-out the HTTP response.
    void this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "job.create",
      entityType: "Job",
      entityId: job.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    }).catch((err) => this.logger.warn(`[POST /v1/jobs] audit append failed: ${String(err?.message ?? err)}`));

    const event = {
      type: "job.created",
      meta: {
        tenantId: input.tenantId,
        correlationId: `job:${job.id}:created`,
        actorId: input.userId,
        actorType: "user",
        occurredAt: new Date().toISOString(),
        version: 1
      },
      payload: {
        jobId: job.id,
        clientOrgId: input.orgId,
        title: job.title,
        category: job.category,
        scope: job.scope,
        budgetType: job.budgetType,
        budgetMin: job.budgetMin,
        budgetMax: job.budgetMax,
        location: job.location,
        urgency: job.urgency,
        deadline: job.deadline,
      },
      triggers: ["pricing", "risk", "audit"]
    };

    void this.domainEventBus.emit(event, {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      requestId: input.requestId
    }).catch((err) => this.logger.warn(`[POST /v1/jobs] domain event failed: ${String(err?.message ?? err)}`));

    // Dispatch to SEMSE Agents bus: MarketplaceAgent classifies and routes the job
    if (this.semseAgents) {
      const msg = this.semseAgents.makeMessage({
        from: "marketplace", to: "marketplace", event: "PROJECT_PUBLISHED",
        payload: {
          jobId: job.id, title: job.title, scope: job.scope,
          category: job.category, budgetMin: job.budgetMin, budgetMax: job.budgetMax,
          location: job.location, urgency: job.urgency,
        },
        projectId: job.id,
      });
      this.semseAgents.dispatch(msg);
    }

    void this.workspaceMemoryRepository.append(
      buildJobWorkspaceMemoryRecord({
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        jobId: job.id,
        title: job.title,
        status: job.status,
        category: job.category,
        scope: job.scope,
        budgetType: job.budgetType,
        budgetMin: job.budgetMin,
        budgetMax: job.budgetMax,
        location: job.location,
        urgency: job.urgency,
        deadline: job.deadline,
        action: "created"
      })
    ).catch((err) => this.logger.warn(`[POST /v1/jobs] workspace memory failed: ${String(err?.message ?? err)}`));

    if (input.preferredProfessional) {
      void this.workspaceMemoryRepository.append(
        buildJobPreferredProfessionalWorkspaceMemoryRecord({
          tenantId: input.tenantId,
          orgId: input.orgId,
          userId: input.userId,
          jobId: job.id,
          targetUserId: input.preferredProfessional.userId,
          targetDisplayName: input.preferredProfessional.displayName,
          targetPublicSlug: input.preferredProfessional.publicSlug,
        }),
      ).catch((err) => this.logger.warn(`[POST /v1/jobs] preferred pro memory failed: ${String(err?.message ?? err)}`));

      void this.domainEventBus.emit(
        {
          type: "job.preferred_professional_selected",
          meta: {
            tenantId: input.tenantId,
            correlationId: `job:${job.id}:preferred-professional`,
            actorId: input.userId,
            actorType: "user",
            occurredAt: new Date().toISOString(),
            version: 1,
          },
          payload: {
            jobId: job.id,
            preferredProfessionalUserId: input.preferredProfessional.userId,
            preferredProfessionalDisplayName: input.preferredProfessional.displayName,
            preferredProfessionalPublicSlug: input.preferredProfessional.publicSlug ?? null,
          },
          triggers: ["trust-match", "audit"],
        },
        {
          tenantId: input.tenantId,
          orgId: input.orgId,
          userId: input.userId,
          requestId: input.requestId,
        },
      ).catch((err) => this.logger.warn(`[POST /v1/jobs] preferred-pro event failed: ${String(err?.message ?? err)}`));
    }

    // Return immediately — background tasks run async
    return this.enrichJobWithPreferredProfessional({
      tenantId: input.tenantId,
      job,
    });
  }

  async archive(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    jobId: string;
    requestId: string;
  }): Promise<{ id: string; archivedAt: string }> {
    const archived = await this.jobsRepository.archive(input);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "job.archive",
      entityType: "Job",
      entityId: archived.id,
      requestId: input.requestId,
      timestamp: archived.archivedAt
    });

    const job = await this.jobsRepository.findById({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      jobId: archived.id
    });

    await this.workspaceMemoryRepository.append(
      buildJobWorkspaceMemoryRecord({
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        jobId: archived.id,
        title: job.title,
        status: "cancelled",
        scope: job.scope,
        budgetMin: job.budgetMin,
        budgetMax: job.budgetMax,
        action: "archived"
      })
    );

    this.syncContext(input.tenantId, "job.archived", "job archived");

    return archived;
  }

  async restore(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    jobId: string;
    requestId: string;
  }): Promise<{ id: string; restored: true }> {
    const restored = await this.jobsRepository.restore(input);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "job.restore",
      entityType: "Job",
      entityId: restored.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    const job = await this.jobsRepository.findById({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      jobId: restored.id
    });

    await this.workspaceMemoryRepository.append(
      buildJobWorkspaceMemoryRecord({
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        jobId: restored.id,
        title: job.title,
        status: job.status,
        scope: job.scope,
        budgetMin: job.budgetMin,
        budgetMax: job.budgetMax,
        action: "restored"
      })
    );

    this.syncContext(input.tenantId, "job.restored", "job restored");

    return restored;
  }

  async transitionJob(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    jobId: string;
    targetStatus: JobRecord["status"];
    requestId: string;
  }): Promise<JobRecord> {
    const job = await this.jobsRepository.findById(input);
    const ownership = await this.jobsRepository.getTransitionAccess({
      tenantId: input.tenantId,
      jobId: input.jobId
    });
    const allowed = JOB_TRANSITIONS[job.status];

    if (!allowed || !allowed.includes(input.targetStatus)) {
      throw new UnprocessableEntityException(
        `Job cannot transition from '${job.status}' to '${input.targetStatus}'. Allowed: ${allowed?.join(", ") ?? "none"}`
      );
    }

    assertTransitionAuthorized(input.targetStatus, input.orgId, input.roles, ownership);

    const updated = await this.jobsRepository.updateStatus({
      tenantId: input.tenantId,
      jobId: input.jobId,
      status: input.targetStatus
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "job.transition",
      entityType: "Job",
      entityId: input.jobId,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: { from: job.status, to: input.targetStatus }
    });

    await this.domainEventBus.emit(
      {
        type: "job.status_changed",
        meta: {
          tenantId: input.tenantId,
          correlationId: `job:${input.jobId}:${job.status}:${input.targetStatus}`,
          actorId: input.userId,
          actorType: "user",
          occurredAt: new Date().toISOString(),
          version: 1
        },
        payload: {
          jobId: input.jobId,
          fromStatus: job.status,
          toStatus: input.targetStatus
        },
        triggers: ["risk", "audit"]
      },
      { tenantId: input.tenantId, orgId: input.orgId, userId: input.userId, requestId: input.requestId }
    );

    return this.enrichJobWithPreferredProfessional({
      tenantId: input.tenantId,
      job: updated,
    });
  }

  async agentSignals(input: { tenantId: string; jobId: string }) {
    const correlationPrefix = `job:${input.jobId}:`;
    const runs = await this.prisma.agentRun.findMany({
      where: {
        tenantId: input.tenantId,
        correlationId: { startsWith: correlationPrefix }
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        agentType: true,
        status: true,
        outputSummary: true,
        actionType: true,
        confidence: true,
        requiresHumanReview: true,
        correlationId: true,
        createdAt: true
      }
    });
    return runs;
  }

  /**
   * Internal system-level job completion triggered when all milestones are approved.
   * Bypasses FSM role checks — only callable by trusted internal services.
   */
  async systemCompleteJob(input: {
    tenantId: string;
    jobId: string;
    requestId: string;
  }): Promise<void> {
    const job = await this.prisma.job.findFirst({
      where: { id: input.jobId, tenantId: input.tenantId, deletedAt: null },
      select: {
        id: true,
        status: true,
        clientOrgId: true,
        reservations: {
          where: { status: "ACCEPTED" },
          select: { professionalId: true },
          take: 1,
        },
      },
    });

    if (!job) return;
    if (job.status === "COMPLETED" || job.status === "CANCELLED") return;

    await this.jobsRepository.updateStatus({
      tenantId: input.tenantId,
      jobId: input.jobId,
      status: "completed",
    });

    const membership = await this.prisma.membership.findFirst({
      where: { orgId: job.clientOrgId },
      select: { userId: true },
    });
    const clientUserId = membership?.userId ?? null;
    const proUserId = job.reservations?.[0]?.professionalId ?? null;

    await this.domainEventBus.emit(
      {
        type: "job.status_changed",
        meta: {
          tenantId: input.tenantId,
          correlationId: `job:${input.jobId}:auto_complete`,
          actorId: "SYSTEM",
          actorType: "system",
          occurredAt: new Date().toISOString(),
          version: 1,
        },
        payload: { jobId: input.jobId, fromStatus: job.status, toStatus: "completed" },
        triggers: ["audit"],
      },
      { tenantId: input.tenantId, orgId: job.clientOrgId, userId: "SYSTEM", requestId: input.requestId }
    );

    void this.notifications?.handleEvent({
      tenantId: input.tenantId,
      eventType: "job.completed",
      payload: { jobId: input.jobId, proUserId, clientUserId },
    }).catch(() => undefined);

    void this.notifications?.handleEvent({
      tenantId: input.tenantId,
      eventType: "rating.requested",
      payload: { jobId: input.jobId, proUserId, clientUserId },
    }).catch(() => undefined);

    this.logger.log(`[Jobs] systemCompleteJob: job ${input.jobId} auto-completed (all milestones approved)`);
  }
}

type JobStatus = JobRecord["status"];

const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  draft:       ["posted", "cancelled"],
  posted:      ["reserved", "cancelled"],
  published:   ["reserved", "cancelled"],
  reserved:    ["accepted", "posted"],
  accepted:    ["in_progress", "cancelled"],
  in_progress: ["review", "dispute"],
  review:      ["completed", "in_progress"],
  dispute:     ["completed", "cancelled"],
  awarded:     ["in_progress"],
  completed:   [],
  cancelled:   []
};

// Transitions that require specific org role — key is targetStatus
const CLIENT_ONLY_TRANSITIONS: JobStatus[] = ["completed", "cancelled"];
const PRO_ONLY_TRANSITIONS: JobStatus[] = ["review", "dispute"];

function assertTransitionAuthorized(
  targetStatus: JobStatus,
  actorOrgId: string,
  roles: string[],
  ownership: { clientOrgId: string; professionalOrgId: string | null }
): void {
  if (roles.includes("OPS_ADMIN") || roles.includes("SYSTEM")) return;

  if (CLIENT_ONLY_TRANSITIONS.includes(targetStatus)) {
    if (actorOrgId !== ownership.clientOrgId) {
      throw new UnprocessableEntityException("actor cannot perform client-only job transition");
    }
    return;
  }

  if (PRO_ONLY_TRANSITIONS.includes(targetStatus)) {
    if (!ownership.professionalOrgId || actorOrgId !== ownership.professionalOrgId) {
      throw new UnprocessableEntityException("actor cannot perform professional-only job transition");
    }
    return;
  }

  // Default: allow either client or the assigned professional to transition
  if (actorOrgId !== ownership.clientOrgId && actorOrgId !== (ownership.professionalOrgId ?? "")) {
    throw new UnprocessableEntityException("actor cannot transition this job");
  }
}

export { JOB_TRANSITIONS };
