import { Injectable, Logger } from "@nestjs/common";
import { AnalyzeEvidenceDto, VisionResultDto } from "../dto/index.js";

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
}
