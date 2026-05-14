import { BadRequestException, Injectable } from "@nestjs/common";
import {
  buildEvidenceChecklistFromResult,
  buildExportBundle,
  buildEscrowPlan,
  buildMilestonePlan,
  calculateConcrete,
  calculateElectrical,
  calculateDemolition,
  calculateMasonry,
  calculateDeck,
  calculateFencing,
  calculateLandscaping,
  calculateProjectManager,
  calculateLabor,
  calculateSolar,
  calculateHvac,
  calculatePlumbing,
  calculatePainting,
  calculateDrywall,
  calculateFlooring,
  calculateCarpentry,
  calculateTile,
  calculateWindowsDoors,
  calculateInsulation,
  calculateBathroomRemodel,
  calculateKitchenRemodel,
  calculateCleaning,
  calculateSiding,
  calculateQuoteFromToolResult,
  calculateRoofing,
  calculateChangeOrderImpact,
  calculateDisputeRisk,
  type ExportBundle,
  type MilestonePlan,
  type EvidenceChecklist,
  type QuoteSummary,
  type SemseToolResult,
  type ToolMode,
  type ChangeOrderImpact,
  type DisputeRiskSnapshot,
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
      case "demolition":
        return calculateDemolition(payload as Parameters<typeof calculateDemolition>[0]);
      case "masonry":
        return calculateMasonry(payload as Parameters<typeof calculateMasonry>[0]);
      case "deck":
        return calculateDeck(payload as Parameters<typeof calculateDeck>[0]);
      case "fencing":
        return calculateFencing(payload as Parameters<typeof calculateFencing>[0]);
      case "landscaping":
        return calculateLandscaping(payload as Parameters<typeof calculateLandscaping>[0]);
      case "project-manager":
      case "projectmanager":
      case "construction-manager":
      case "site-supervisor":
      case "daily-field-ops":
        return calculateProjectManager(payload as Parameters<typeof calculateProjectManager>[0]);
      case "labor":
        return calculateLabor(payload as Parameters<typeof calculateLabor>[0]);
      case "solar":
        return calculateSolar(payload as Parameters<typeof calculateSolar>[0]);
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
      case "tile":
        return calculateTile(payload as Parameters<typeof calculateTile>[0]);
      case "windowsdoors":
      case "windows-doors":
      case "windows_doors":
        return calculateWindowsDoors(payload as Parameters<typeof calculateWindowsDoors>[0]);
      case "insulation":
        return calculateInsulation(payload as Parameters<typeof calculateInsulation>[0]);
      case "bathroom":
      case "bathroom-remodel":
      case "bathroom_remodel":
        return calculateBathroomRemodel(payload as Parameters<typeof calculateBathroomRemodel>[0]);
      case "kitchen":
      case "kitchen-remodel":
      case "kitchen_remodel":
        return calculateKitchenRemodel(payload as Parameters<typeof calculateKitchenRemodel>[0]);
      case "cleaning":
      case "residential-cleaning":
        return calculateCleaning(payload as Parameters<typeof calculateCleaning>[0]);
      case "siding":
      case "exterior-siding":
      case "siding-installation":
        return calculateSiding(payload as Parameters<typeof calculateSiding>[0]);
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

  changeOrder(result: SemseToolResult, deltaPercent: number): ChangeOrderImpact {
    return calculateChangeOrderImpact(result, deltaPercent);
  }

  disputeRisk(result: SemseToolResult): DisputeRiskSnapshot {
    return calculateDisputeRisk(result);
  }
}
