import type { ExportBundle, SemseToolResult } from "./types.js";
import { calculateQuoteFromToolResult } from "../business/quote-engine.js";
import { buildEscrowPlan } from "../business/escrow-engine.js";
import { buildMilestonePlan } from "../business/milestone-builder.js";
import { buildEvidenceChecklistFromResult } from "../business/evidence-builder.js";

export function buildExportBundle(result: SemseToolResult): ExportBundle {
  return {
    toolId: result.toolId,
    trade: result.trade,
    mode: result.mode,
    createdAt: result.createdAt,
    quote: calculateQuoteFromToolResult(result),
    evidence: buildEvidenceChecklistFromResult(result),
    milestonePlan: buildMilestonePlan(result),
    escrowPlan: buildEscrowPlan(result),
    warnings: [...result.warnings],
    recommendations: [...result.recommendations],
  };
}
