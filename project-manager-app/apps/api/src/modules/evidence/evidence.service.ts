import { Inject, Injectable, Optional } from "@nestjs/common";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import type { OperationalContextService } from "../ai-models/context/operational-context.service.js";
import { OPERATIONAL_CONTEXT_SERVICE } from "../ai-models/context/operational-context.token.js";
import { EvidenceRepository } from "./evidence.repository.js";

@Injectable()
export class EvidenceService {
  constructor(
    private readonly evidenceRepository: EvidenceRepository,
    private readonly auditService: AuditService,
    @Optional() @Inject(OPERATIONAL_CONTEXT_SERVICE)
    private readonly operationalContext?: OperationalContextService,
  ) {}

  async register(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    requestId: string;
    projectId?: string;
    jobId?: string;
    milestoneId?: string;
    key: string;
    kind: "PHOTO" | "VIDEO" | "DOCUMENT";
    filename?: string;
  }) {
    const evidence = await this.evidenceRepository.create(input);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "evidence.register",
      entityType: "Evidence",
      entityId: evidence.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: {
        jobId: evidence.jobId,
        projectId: evidence.projectId,
        milestoneId: evidence.milestoneId,
        kind: evidence.kind,
        canonicalScope: evidence.milestoneId ? "milestone" : "job"
      }
    });

    this.operationalContext?.invalidateScope({
      tenantId: input.tenantId,
      projectId: evidence.projectId,
      source: "evidence.registered",
      reason: "evidence registered",
    });

    return evidence;
  }

  async listByProject(input: { tenantId: string; orgId: string; userId: string; roles: string[]; projectId: string }) {
    return this.evidenceRepository.listByProject(input);
  }

  async listByJob(input: { tenantId: string; orgId: string; userId: string; roles: string[]; jobId: string }) {
    return this.evidenceRepository.listByJob(input);
  }

  async detail(input: { tenantId: string; orgId: string; userId: string; roles: string[]; evidenceId: string }) {
    return this.evidenceRepository.findById(input);
  }
}
