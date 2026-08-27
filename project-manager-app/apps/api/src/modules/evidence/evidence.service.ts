import { BadRequestException, Inject, Injectable, Optional } from "@nestjs/common";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { StorageService } from "../../infrastructure/storage/storage.service.js";
import type { OperationalContextService } from "../ai-models/context/operational-context.service.js";
import { OPERATIONAL_CONTEXT_SERVICE } from "../ai-models/context/operational-context.token.js";
import { EvidenceRepository } from "./evidence.repository.js";
import { parsePhotoExif } from "./evidence-exif.js";

@Injectable()
export class EvidenceService {
  constructor(
    private readonly evidenceRepository: EvidenceRepository,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
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
    geoLat?: number;
    geoLng?: number;
    capturedAt?: Date;
    category?: string;
    description?: string;
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

  /**
   * m2.2-dispute-docs Bloque 2.2.A — register a photo whose timestamp and
   * GPS location come from the file's own EXIF data, not from the request
   * body. `key` must reference a file already uploaded via the existing
   * presign flow (POST /v1/evidence/presign → direct upload → this call).
   * Fails closed with 400 if the photo has no DateTimeOriginal or GPS —
   * the whole point of this endpoint is a timestamp/location a contractor
   * can't just type in, so a photo that lacks them isn't useful evidence
   * for the anti-dispute bundle this spec describes.
   */
  async registerPhotoWithExif(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    requestId: string;
    projectId?: string;
    jobId?: string;
    milestoneId?: string;
    key: string;
    filename?: string;
    category?: string;
    description?: string;
  }) {
    const buffer = await this.storageService.readBuffer(input.key);
    const exif = parsePhotoExif(buffer);
    if (!exif) {
      throw new BadRequestException(
        "EXIF_INVALID: photo is missing a readable timestamp (DateTimeOriginal) and/or GPS coordinates"
      );
    }

    return this.register({
      ...input,
      kind: "PHOTO",
      geoLat: exif.latitude,
      geoLng: exif.longitude,
      capturedAt: exif.timestamp,
    });
  }
}
