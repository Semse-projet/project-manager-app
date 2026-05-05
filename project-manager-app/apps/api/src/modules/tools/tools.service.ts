import { BadRequestException, Injectable } from "@nestjs/common";
import {
  buildEvidenceChecklistFromResult,
  buildExportBundle,
  buildEscrowPlan,
  buildMilestonePlan,
  calculateConcrete,
  calculateElectrical,
  calculateHvac,
  calculatePlumbing,
  calculatePainting,
  calculateDrywall,
  calculateFlooring,
  calculateCarpentry,
  calculateQuoteFromToolResult,
  calculateRoofing,
  type ExportBundle,
  type MilestonePlan,
  type EvidenceChecklist,
  type QuoteSummary,
  type SemseToolResult,
  type ToolMode,
} from "../../../../../packages/tools/dist/index.js";

export type ToolCalculateInput = {
  tool: string;
  mode?: ToolMode;
  input: Record<string, unknown>;
};

export type ToolCalcPayload = {
  result: SemseToolResult;
};

@Injectable()
export class ToolsService {
  calculate(input: ToolCalculateInput): SemseToolResult {
    const mode = input.mode ?? "professional";
    const tool = input.tool.toLowerCase().trim();
    const payload = { ...input.input, mode } as Record<string, unknown> & { mode: ToolMode };

    switch (tool) {
      case "concrete":
        return calculateConcrete(payload as Parameters<typeof calculateConcrete>[0]);
      case "electrical":
        return calculateElectrical(payload as Parameters<typeof calculateElectrical>[0]);
      case "roofing":
        return calculateRoofing(payload as Parameters<typeof calculateRoofing>[0]);
      case "plumbing":
        return calculatePlumbing(payload as Parameters<typeof calculatePlumbing>[0]);
      case "hvac":
        return calculateHvac(payload as Parameters<typeof calculateHvac>[0]);
      case "painting":
        return calculatePainting(payload as Parameters<typeof calculatePainting>[0]);
      case "drywall":
        return calculateDrywall(payload as Parameters<typeof calculateDrywall>[0]);
      case "flooring":
        return calculateFlooring(payload as Parameters<typeof calculateFlooring>[0]);
      case "carpentry":
        return calculateCarpentry(payload as Parameters<typeof calculateCarpentry>[0]);
      default:
        throw new BadRequestException(`Unsupported SEMSE tool: ${input.tool}`);
    }
  }

  quote(result: SemseToolResult): QuoteSummary {
    return calculateQuoteFromToolResult(result);
  }

  milestones(result: SemseToolResult): MilestonePlan {
    return buildMilestonePlan(result);
  }

  evidence(result: SemseToolResult): EvidenceChecklist {
    return buildEvidenceChecklistFromResult(result);
  }

  export(result: SemseToolResult): ExportBundle {
    return buildExportBundle(result);
  }

  escrow(result: SemseToolResult) {
    return buildEscrowPlan(result);
  }
}
