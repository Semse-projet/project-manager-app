import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { assertEvidenceReadable, assertEvidenceWritable, type EvidenceActor } from "../evidence/evidence.policy.js";
import { normalizeEvidenceBucketKey } from "../evidence/evidence.repository.js";
import { EvidenceService } from "../evidence/evidence.service.js";
import { randomUUID } from "node:crypto";
import { EvidenceGatewayRepository } from "./evidence-gateway.repository.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";
import { VisionService } from "../vision/vision.service.js";
import { StorageService } from "../../infrastructure/storage/storage.service.js";

export interface EvidenceUploadRequest {
  tenantId: string;
  orgId: string;
  roles: string[];
  projectId: string;
  milestoneId?: string;
  uploadedById: string;
  kind: "PHOTO" | "VIDEO" | "DOCUMENT";
  bucketKey: string;
  metadataJson?: Record<string, unknown>;
  /**
   * Correlacion/idempotencia del registro canonico (EvidenceService.register).
   * Si falta se genera uno: cada llamada sin requestId es un registro nuevo.
   */
  requestId?: string;
}

export interface ValidationScore {
  overall: number;
  qualityScore: number;
  completenessScore: number;
  relevanceScore: number;
  status: "passed" | "failed" | "manual_review";
  feedback: string;
}

@Injectable()
export class EvidenceGatewayService {
  private readonly logger = new Logger(EvidenceGatewayService.name);

  constructor(
    private readonly repository: EvidenceGatewayRepository,
    private readonly visionService: VisionService,
    private readonly storageService: StorageService,
    private readonly evidenceService: EvidenceService,
    private readonly sseBus?: SseEventBusService,
  ) {}

  /**
   * Tenant + organization + resource scoping (C10/C67). The canonical
   * evidence policy (`evidence/evidence.policy.ts`, ADR-028) decides; this
   * gateway is only an adapter and must not widen it. A project outside the
   * caller's tenant is reported as not found (no existence oracle).
   */
  async assertProjectAccess(actor: EvidenceActor, projectId: string, mode: "read" | "write"): Promise<void> {
    const ownership = projectId
      ? await this.repository.getProjectOwnership(projectId, actor.tenantId)
      : null;
    if (!ownership) {
      throw new NotFoundException("Project not found");
    }
    if (mode === "write") assertEvidenceWritable(actor, ownership);
    else assertEvidenceReadable(actor, ownership);
  }

  async uploadEvidence(
    request: EvidenceUploadRequest,
  ): Promise<{ evidenceId: string; status: string }> {
    try {
      if (!request.projectId || !request.uploadedById) {
        throw new BadRequestException("Missing required fields");
      }

      await this.assertProjectAccess(
        { tenantId: request.tenantId, orgId: request.orgId, userId: request.uploadedById, roles: request.roles },
        request.projectId,
        "write",
      );
      if (
        request.milestoneId &&
        !(await this.repository.milestoneBelongsToProject(request.milestoneId, request.projectId, request.tenantId))
      ) {
        throw new NotFoundException("Milestone not found for this project");
      }

      // C67: el gateway es un ADAPTADOR del propietario canonico de Evidence.
      // La escritura (clave tenant-scoped, idempotencia, outbox
      // evidence.uploaded.v1, audit, invalidacion de contexto, contrato de
      // metadataJson) la hace EvidenceService.register; aqui solo se adapta la
      // forma de la peticion. La clave se valida tambien antes de delegar
      // (defensa en profundidad y fallo temprano con 400).
      const bucketKey = normalizeEvidenceBucketKey(request.bucketKey, request.tenantId);
      const evidence = await this.evidenceService.register({
        tenantId: request.tenantId,
        orgId: request.orgId,
        userId: request.uploadedById,
        roles: request.roles,
        requestId: request.requestId ?? `evidence-gateway-${randomUUID()}`,
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        key: bucketKey,
        kind: request.kind,
        metadata: request.metadataJson,
      });

      // Log event
      await this.repository.logValidationEvent(
        request.projectId,
        evidence.id,
        "evidence_uploaded",
        { kind: request.kind, bucketKey },
      );

      // Emit initial SSE event
      if (this.sseBus) {
        this.sseBus.emit("evidence", "uploaded", {
          evidenceId: evidence.id,
          projectId: request.projectId,
          status: "pending_validation",
          timestamp: new Date().toISOString(),
        });
      }

      return {
        evidenceId: evidence.id,
        status: "pending_validation",
      };
    } catch (error) {
      this.logger.error(
        `Upload failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async validateEvidenceAsync(
    evidenceId: string,
    projectId: string,
  ): Promise<void> {
    try {
      // Emit validation started
      if (this.sseBus) {
        this.sseBus.emit("evidence", "validating", {
          evidenceId,
          projectId,
          progress: 10,
          message: "Starting validation...",
        });
      }

      // Get evidence
      const evidence = await this.repository.getEvidence(evidenceId);
      if (!evidence) {
        throw new Error(`Evidence ${evidenceId} not found`);
      }

      // Simulate quality assessment
      const qualityScore = await this.assessQuality(evidence);

      // Update validation progress
      if (this.sseBus) {
        this.sseBus.emit("evidence", "validating", {
          evidenceId,
          projectId,
          progress: 50,
          message: "Assessing quality...",
          qualityScore,
        });
      }

      // Score against requirements
      const score = await this.scoreAgainstRequirements(evidence);

      // Update validation progress
      if (this.sseBus) {
        this.sseBus.emit("evidence", "validating", {
          evidenceId,
          projectId,
          progress: 80,
          message: "Scoring against requirements...",
          score,
        });
      }

      // Determine validation status — use the 3-band status already computed by
      // scoreAgainstRequirements (passed/manual_review/failed) instead of recomputing
      // a hard binary cutoff here, which used to silently collapse the "manual review"
      // band into "failed".
      const status = score.status;

      // Update evidence with validation result
      await this.repository.updateEvidenceValidation(evidenceId, {
        evidenceId,
        projectId,
        validationStatus: status,
        aiQualityScore: score.overall,
        validatedAt: new Date(),
        feedback: score.feedback,
      });

      // Log validation result
      await this.repository.logValidationEvent(
        projectId,
        evidenceId,
        `evidence_${status}`,
        { score: score.overall, feedback: score.feedback },
      );

      // Emit completion
      if (this.sseBus) {
        this.sseBus.emit("evidence", "validated", {
          evidenceId,
          projectId,
          status,
          score: score.overall,
          feedback: score.feedback,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error(
        `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Emit error
      if (this.sseBus) {
        this.sseBus.emit("evidence", "validation_error", {
          evidenceId,
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    }
  }

  async getMilestoneValidationStatus(
    actor: EvidenceActor,
    projectId: string,
    milestoneId: string,
  ) {
    try {
      await this.assertProjectAccess(actor, projectId, "read");
      if (!(await this.repository.milestoneBelongsToProject(milestoneId, projectId, actor.tenantId))) {
        throw new NotFoundException("Milestone not found for this project");
      }
      const status = await this.repository.getMilestoneEvidenceValidationStatus(
        projectId,
        milestoneId,
        actor.tenantId,
      );

      return {
        projectId,
        milestoneId,
        evidenceCount: status.total,
        passedCount: status.passed,
        failedCount: status.failed,
        pendingCount: status.pending,
        manualReviewCount: status.manualReview,
        averageScore: status.avgScore,
        isValidationComplete: status.isComplete,
        isReadyForPayment: status.isReady,
        readinessPercentage: Math.round(
          (status.passed / Math.max(status.total, 1)) * 100,
        ),
      };
    } catch (error) {
      this.logger.error(
        `Status check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async getFailedEvidence(actor: EvidenceActor, projectId: string) {
    await this.assertProjectAccess(actor, projectId, "read");
    return this.repository.getProjectEvidenceByStatus(projectId, "failed", actor.tenantId);
  }

  async getPendingEvidence(actor: EvidenceActor, projectId: string) {
    await this.assertProjectAccess(actor, projectId, "read");
    return this.repository.getProjectEvidenceByStatus(projectId, "pending", actor.tenantId);
  }

  async getPassedEvidence(actor: EvidenceActor, projectId: string) {
    await this.assertProjectAccess(actor, projectId, "read");
    return this.repository.getProjectEvidenceByStatus(projectId, "passed", actor.tenantId);
  }

  private async assessQuality(evidence: any): Promise<number> {
    try {
      if (evidence.kind !== "PHOTO" && evidence.kind !== "VIDEO") {
        return 0.70; // Non-image/video default
      }

      // Execute OpenCV real-time visual assessment through our Vision module
      const imageUrl = evidence.bucketKey
        ? this.storageService.publicUrl(evidence.bucketKey, { ttl: "vision" })
        : `mock://evidence/${evidence.id}`;
      const analysis = await this.visionService.runAnalysis({
        evidenceId: evidence.id,
        imageUrl,
        jobId: evidence.metadataJson?.jobId as string || undefined,
        milestoneId: evidence.milestoneId || undefined,
      });

      return analysis.qualityScore ?? 0.5;
    } catch (error) {
      this.logger.error(`Vision analysis failed inside gateway: ${error instanceof Error ? error.message : String(error)}`);
      return 0.5; // Fallback to basic score on failure
    }
  }

  private async scoreAgainstRequirements(evidence: any): Promise<ValidationScore> {
    const qualityScore = await this.assessQuality(evidence);

    // Check if there is a suspected duplicate or critical warning from OpenCV
    let duplicateRisk = 0.0;
    try {
      const analysis = await this.visionService.getAnalysis(evidence.id);
      duplicateRisk = analysis.duplicateRisk ?? 0.0;
    } catch {
      // Ignore if not analyzed yet
    }

    const completenessScore = 0.8;
    const relevanceScore = evidence.milestoneId ? 0.85 : 0.65;

    // Reference similarity: if the milestone has a referenceImageUrl in its checklistSchema,
    // compare the delivered photo against it and blend the score (×0.3 weight).
    let referenceSimilarity: number | null = null;
    const checklistSchema = evidence.milestone?.checklistSchema as Record<string, unknown> | null | undefined;
    const referenceImageUrl = typeof checklistSchema?.referenceImageUrl === "string" ? checklistSchema.referenceImageUrl : null;
    if (referenceImageUrl && (evidence.kind === "PHOTO" || evidence.kind === "VIDEO")) {
      try {
        const imageUrl = evidence.bucketKey
          ? this.storageService.publicUrl(evidence.bucketKey, { ttl: "vision" })
          : `mock://evidence/${evidence.id}`;
        const matchResult = await this.visionService.matchReference(imageUrl, referenceImageUrl);
        referenceSimilarity = typeof matchResult?.similarityScore === "number" ? matchResult.similarityScore : null;
      } catch (err) {
        this.logger.warn(`Reference match failed for evidence ${evidence.id as string}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Compute overall score — weights shift when reference similarity is available
    let overall: number;
    if (duplicateRisk >= 0.85) {
      overall = 0.0;
    } else if (referenceSimilarity !== null) {
      overall = qualityScore * 0.4 + completenessScore * 0.2 + relevanceScore * 0.1 + referenceSimilarity * 0.3;
    } else {
      overall = qualityScore * 0.5 + completenessScore * 0.3 + relevanceScore * 0.2;
    }

    const status = overall >= 0.65 ? "passed" : overall >= 0.5 ? "manual_review" : "failed";

    const feedbackParts: string[] = [];
    if (duplicateRisk >= 0.85) feedbackParts.push("CRITICAL: Suspected image duplication / fraud detected");
    else if (referenceSimilarity !== null) feedbackParts.push(`Reference similarity: ${Math.round(referenceSimilarity * 100)}%`);
    if (feedbackParts.length === 0) {
      feedbackParts.push(overall >= 0.75 ? "Evidence quality is excellent" : overall >= 0.65 ? "Evidence quality is acceptable" : "Evidence quality needs improvement");
    }

    return {
      overall: Math.min(overall, 1.0),
      qualityScore,
      completenessScore,
      relevanceScore,
      status,
      feedback: feedbackParts.join(" | "),
    };
  }
}
