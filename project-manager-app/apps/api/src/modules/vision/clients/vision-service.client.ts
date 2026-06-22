import { Injectable, Logger } from "@nestjs/common";
import {
  AnalyzeEvidenceDto,
  VisionResultDto,
  BlueprintDto,
  BlueprintResultDto,
  PerspectiveCorrectionDto,
  PerspectiveCorrectionResultDto,
  BinarizeDto,
  BinarizeResultDto,
  AreaEstimateDto,
  AreaEstimateResultDto,
  ConsistencyCheckDto,
  ConsistencyCheckResultDto,
  TimelineDto,
  TimelineResultDto,
  SafetyCheckDto,
  SafetyCheckResultDto,
  ReferenceMatchDto,
  ReferenceMatchResultDto,
  TradeDetectionDto,
  TradeDetectionResultDto,
  BatchAnalyzeDto,
  BatchAnalyzeResultDto,
} from "../dto/index.js";

@Injectable()
export class VisionServiceClient {
  private readonly logger = new Logger(VisionServiceClient.name);

  async analyzeEvidence(payload: AnalyzeEvidenceDto): Promise<VisionResultDto> {
    const baseUrl = process.env.VISION_SERVICE_URL || "http://localhost:8080";
    const url = `${baseUrl}/v1/evidence/analyze`;
    const timeoutMs = parseInt(process.env.VISION_ANALYSIS_TIMEOUT_MS || "30000", 10);

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      this.logger.log(`Requesting visual analysis to Vision Service for Evidence: ${payload.evidenceId}`);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(id);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Vision Service returned status ${response.status}: ${errText}`);
      }

      return (await response.json()) as VisionResultDto;
    } catch (error: any) {
      clearTimeout(id);
      this.logger.error(`Failed to analyze evidence ${payload.evidenceId}: ${error.message}`);
      throw error;
    }
  }

  async analyzeBlueprint(payload: BlueprintDto): Promise<BlueprintResultDto> {
    return this.post<BlueprintResultDto>("/v1/evidence/blueprint", payload);
  }

  async correctPerspective(payload: PerspectiveCorrectionDto): Promise<PerspectiveCorrectionResultDto> {
    return this.post<PerspectiveCorrectionResultDto>("/v1/evidence/perspective-correct", payload);
  }

  async binarizeDocument(payload: BinarizeDto): Promise<BinarizeResultDto> {
    return this.post<BinarizeResultDto>("/v1/evidence/document-binarize", payload);
  }

  async estimateArea(payload: AreaEstimateDto): Promise<AreaEstimateResultDto> {
    return this.post<AreaEstimateResultDto>("/v1/evidence/estimate-area", payload);
  }

  async checkConsistency(payload: ConsistencyCheckDto): Promise<ConsistencyCheckResultDto> {
    return this.post<ConsistencyCheckResultDto>("/v1/evidence/check-consistency", payload);
  }

  async buildTimeline(payload: TimelineDto): Promise<TimelineResultDto> {
    return this.post<TimelineResultDto>("/v1/evidence/progress-timeline", payload);
  }

  async checkSafety(payload: SafetyCheckDto): Promise<SafetyCheckResultDto> {
    return this.post<SafetyCheckResultDto>("/v1/evidence/safety-check", payload);
  }

  async matchReference(payload: ReferenceMatchDto): Promise<ReferenceMatchResultDto> {
    return this.post<ReferenceMatchResultDto>("/v1/evidence/match-reference", payload);
  }

  async detectTrade(payload: TradeDetectionDto): Promise<TradeDetectionResultDto> {
    return this.post<TradeDetectionResultDto>("/v1/evidence/detect-trade", payload);
  }

  async batchAnalyze(payload: BatchAnalyzeDto): Promise<BatchAnalyzeResultDto> {
    return this.post<BatchAnalyzeResultDto>("/v1/evidence/batch-analyze", payload);
  }

  async detectMaterial(payload: { imageUrl: string; expectedMaterial?: string }): Promise<any> {
    return this.post<any>("/v1/evidence/detect-material", payload);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const baseUrl = process.env.VISION_SERVICE_URL || "http://localhost:8080";
    const timeoutMs = parseInt(process.env.VISION_ANALYSIS_TIMEOUT_MS || "30000", 10);
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(id);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Vision Service ${path} returned ${response.status}: ${errText}`);
      }
      return (await response.json()) as T;
    } catch (error: any) {
      clearTimeout(id);
      this.logger.error(`Vision Service ${path} failed: ${error.message}`);
      throw error;
    }
  }
}
