import type { EvidenceChecklist, SemseToolResult } from "../core/types.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";

export function buildEvidenceChecklistFromResult(result: SemseToolResult): EvidenceChecklist {
  return buildEvidenceChecklist(result.trade, result.risk, result.milestones, result.evidenceRequired);
}
