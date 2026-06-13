import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { EvidenceGatewayRepository } from "./evidence-gateway.repository.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";
import { VisionService } from "../vision/vision.service.js";
import { StorageService } from "../../infrastructure/storage/storage.service.js";

export interface EvidenceUploadRequest {
  projectId: string;
  milestoneId?: string;
  uploadedById: string;
  kind: "PHOTO" | "VIDEO" | "DOCUMENT";
  bucketKey: string;
  metadataJson?: Record<string, unknown>;
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
    private readonly sseBus?: SseEventBusService,
  ) {}

  async uploadEvidence(
    request: EvidenceUploadRequest,
  ): Promise<{ evidenceId: string; status: string }> {
    try {
      if (!request.projectId || !request.uploadedById) {
        throw new BadRequestException("Missing required fields");
      }

      // Create evidence record
      const evidence = await this.repository.createEvidence({
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        uploadedById: request.uploadedById,
        kind: request.kind,
        bucketKey: request.bucketKey,
        metadataJson: request.metadataJson,
      });

      // Log event
      await this.repository.logValidationEvent(
        request.projectId,
        evidence.id,
        "evidence_uploaded",
        { kind: request.kind, bucketKey: request.bucketKey },
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

      // Determine validation status
      const status = score.overall >= 0.65 ? "passed" : "failed";

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
    projectId: string,
    milestoneId: string,
  ) {
    try {
      const status = await this.repository.getMilestoneEvidenceValidationStatus(
        projectId,
        milestoneId,
      );

      return {
        projectId,
        milestoneId,
        evidenceCount: status.total,
        passedCount: status.passed,
        failedCount: status.failed,
        pendingCount: status.pending,
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

  async getFailedEvidence(projectId: string) {
    return this.repository.getProjectEvidenceByStatus(projectId, "failed");
  }

  async getPendingEvidence(projectId: string) {
    return this.repository.getProjectEvidenceByStatus(projectId, "pending");
  }

  async getPassedEvidence(projectId: string) {
    return this.repository.getProjectEvidenceByStatus(projectId, "passed");
  }

  private async assessQuality(evidence: any): Promise<number> {
    try {
      if (evidence.kind !== "PHOTO" && evidence.kind !== "VIDEO") {
        return 0.70; // Non-image/video default
      }

      // Execute OpenCV real-time visual assessment through our Vision module
      const imageUrl = evidence.bucketKey
        ? this.storageService.publicUrl(evidence.bucketKey)
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

    // Apply penalty to overall score if image is duplicate (fraud protection)
    let overall = qualityScore * 0.5 + completenessScore * 0.3 + relevanceScore * 0.2;
    if (duplicateRisk >= 0.85) {
      overall = 0.0; // Fail validation entirely
    }

    const status = overall >= 0.65 ? "passed" : overall >= 0.5 ? "manual_review" : "failed";

    return {
      overall: Math.min(overall, 1.0),
      qualityScore,
      completenessScore,
      relevanceScore,
      status,
      feedback:
        duplicateRisk >= 0.85
          ? "CRITICAL: Suspected image duplication / fraud detected"
          : overall >= 0.75
            ? "Evidence quality is excellent"
            : overall >= 0.65
              ? "Evidence quality is acceptable"
              : "Evidence quality needs improvement",
    };
  }
}
