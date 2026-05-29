import { collect, isValid, positive, warn } from "../core/validation-engine.js";
import { applyLocation, buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";
import {
  computeConfidenceScore, computeDisputeRisk, computeReadinessScore,
  computePriceBands, buildScope, buildExplainedOutput, buildWarranty,
  buildInspectionGate, buildAlgorithmTrace, computeSafeToProceed, ALGORITHM_VERSIONS,
} from "../core/extended-metrics.js";

export type InsulationType = "batts" | "blown-in" | "spray-foam" | "rigid-board";
export type InsulationAccess = "attic" | "walls" | "crawlspace" | "garage" | "exterior" | "basement";

export type InsulationInput = {
  areaSqft: number;
  insulationType: InsulationType;
  targetRValue: number;
  accessType: InsulationAccess;
  existingInsulation: boolean;
  removeExisting: boolean;
  airSealing: boolean;
  vaporBarrier: boolean;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const ACCESS_MULT: Record<InsulationAccess, number> = {
  attic: 1.00, walls: 1.15, crawlspace: 1.35, garage: 1.05, exterior: 1.25, basement: 1.10,
};
const COVERAGE_PER_BAG: Record<InsulationType, number> = {
  batts: 40, "blown-in": 90, "spray-foam": 20, "rigid-board": 32,
};
const MATERIAL_PER_SQFT: Record<InsulationType, number> = {
  batts: 0.38, "blown-in": 0.28, "spray-foam": 2.20, "rigid-board": 0.90,
};

export function calculateInsulation(input: InsulationInput): SemseToolResult {
  const issues = collect(
    positive("areaSqft", input.areaSqft, "Area"),
    positive("targetRValue", input.targetRValue, "Target R-value"),
    input.targetRValue >= 30 ? warn("targetRValue", "High R-value: verify thickness, cavity depth, and ventilation.") : null,
    input.insulationType === "spray-foam" && input.accessType === "crawlspace" ? warn("accessType", "Spray foam in crawlspace: ventilation, PPE, and moisture control required.") : null,
    input.accessType === "walls" && !input.airSealing ? warn("airSealing", "Wall insulation without air sealing: reduced efficiency.") : null,
    input.removeExisting && !input.existingInsulation ? warn("removeExisting", "Remove flagged but no existing insulation noted — verify scope.") : null,
  );

  const adjustedArea = input.areaSqft * ACCESS_MULT[input.accessType];
  const coverage = COVERAGE_PER_BAG[input.insulationType];
  const unitCount = Math.max(1, Math.ceil(adjustedArea / coverage));
  const airSealKits = input.airSealing ? Math.max(1, Math.ceil(input.areaSqft / 180)) : 0;
  const vaporRolls  = input.vaporBarrier ? Math.max(1, Math.ceil(adjustedArea / 200)) : 0;
  const removeKits  = input.removeExisting && input.existingInsulation ? Math.max(1, Math.ceil(input.areaSqft / 150)) : 0;

  const mats = [
    material(`${input.insulationType} insulation`, unitCount, input.insulationType === "spray-foam" ? "kit" : "bag", MATERIAL_PER_SQFT[input.insulationType] * coverage, "Insulation"),
    ...(input.airSealing ? [material("Air sealing kit", airSealKits, "kit", 34, "Air sealing")] : []),
    ...(input.vaporBarrier ? [material("Vapor barrier", vaporRolls, "roll", 58, "Protection")] : []),
    ...(removeKits > 0 ? [material("Existing insulation removal", removeKits, "kit", 18, "Prep")] : []),
    material("Fasteners / staples / backing", Math.max(1, Math.ceil(input.areaSqft / 200)), "kit", 14, "Install"),
  ];

  const labor = estimateLabor({
    baseHours: 3 + adjustedArea / 100 + (input.airSealing ? 1.5 : 0)
      + (input.removeExisting ? 2.5 : 0) + (input.accessType === "crawlspace" ? 2.5 : 0)
      + (input.accessType === "exterior" ? 2 : 0) + (input.accessType === "walls" ? 1.5 : 0)
      + (input.vaporBarrier ? 1 : 0),
    crewSize: adjustedArea > 1200 ? 3 : 2,
    ratePerHour: input.accessType === "crawlspace" || input.insulationType === "spray-foam" ? 62 : 54,
    difficulty: input.insulationType === "spray-foam" || input.accessType === "crawlspace" || input.accessType === "exterior" ? "complex" : "moderate",
    notes: [`${input.areaSqft} sqft — ${adjustedArea.toFixed(0)} adjusted (${input.accessType})`, `${input.insulationType} — R${input.targetRValue} target`],
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost, input.location, "labor"),
    { overhead: input.insulationType === "spray-foam" ? 0.17 : 0.14, profit: 0.20, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: input.areaSqft || 1 },
  );

  const risk = computeRisk([
    factor("spray_foam",  "Spray foam",          0.16, input.insulationType === "spray-foam"),
    factor("crawlspace",  "Crawlspace access",   0.18, input.accessType === "crawlspace"),
    factor("exterior",    "Exterior access",     0.12, input.accessType === "exterior"),
    factor("air_sealing", "Air sealing",         0.12, input.airSealing),
    factor("high_r",      "High R-value (30+)",  0.14, input.targetRValue >= 30),
  ], { requiresPermit: input.accessType === "exterior" || input.insulationType === "spray-foam", requiresLicense: false, requiresInspection: input.accessType === "crawlspace" || input.accessType === "exterior", requiresEngineering: false });

  const milestones = buildMilestones(costs.total, risk.level,
    ["Prep / air seal", "Install insulation", "Verify coverage", "Cleanup and handoff"],
    [
      ["Photos before work", "Cavity condition check"],
      ["Photos during install", "Material label / R-value"],
      ["Photos of coverage", "Depth / R-value confirmation"],
      ["Final photos", "Client sign-off"],
    ]
  );
  const evidence = buildEvidenceChecklist("insulation", risk, milestones, [
    { type: "photo",       description: "Pre-work cavity / attic / crawlspace",  required: true, milestone: 1 },
    { type: "photo",       description: "Air sealing completed before cover",     required: input.airSealing, milestone: 1 },
    { type: "photo",       description: "Insulation installed with label",        required: true, milestone: 2 },
    { type: "measurement", description: "R-value / depth confirmation",           required: true, milestone: 3 },
  ]);

  const confidence = computeConfidenceScore({
    hasMeasurements: true, hasPhotos: false, hasConditionData: !input.existingInsulation || input.removeExisting,
    hasMaterialSelection: true, hasScopeConfirmed: true, hasUnknownConditions: input.existingInsulation && !input.removeExisting,
    extraConfirmedFields: (input.airSealing ? 1 : 0) + (input.vaporBarrier ? 1 : 0),
  });
  const readiness = computeReadinessScore({
    measurementsConfirmed: true, materialsAvailable: false, siteAccessConfirmed: true,
    permitsAddressed: !(input.accessType === "exterior" || input.insulationType === "spray-foam"),
    scopeApproved: true, depositPaid: false, clientApproval: false,
  });
  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous: input.existingInsulation && !input.removeExisting, clientProvidesMaterials: false,
    noPhotosRequired: false, hasChangeOrderPolicy: true, hasEvidenceRequired: true,
    hasMilestones: true, hasHighRiskConditions: input.insulationType === "spray-foam" || input.accessType === "crawlspace",
    priceIsFixed: true, clientExpectationMismatch: false,
  });
  const priceBands = computePriceBands(costs.total, 0.82, input.insulationType === "spray-foam" ? 1.45 : input.accessType === "crawlspace" ? 1.35 : 1.22, {
    low:  "Batts, attic, no air sealing, no existing removal",
    mid:  "Blown-in or batts, standard access, air sealing",
    high: input.insulationType === "spray-foam" ? "Spray foam, crawlspace/exterior, air sealing + vapor barrier" : "Spray foam or exterior walls, high R-value",
  });
  const scope = buildScope(
    [`${input.insulationType} insulation (${input.areaSqft} sqft — R${input.targetRValue})`, `Access: ${input.accessType}`, input.airSealing ? "Air sealing" : "", input.vaporBarrier ? "Vapor barrier" : "", input.removeExisting ? "Existing insulation removal" : ""].filter(Boolean),
    [!input.airSealing ? "Air sealing (not included)" : "", !input.vaporBarrier ? "Vapor barrier (not included)" : "", "Mold remediation", "Structural repairs"].filter(Boolean),
    ["Adequate cavity depth for target R-value", "No mold or moisture damage present", "US market pricing"],
    ["Hidden moisture or mold requiring remediation", "Cavity depth insufficient for target R-value"],
  );
  const warranty = buildWarranty(365, "1-year labor warranty. Material settling is normal for blown-in.", ["Client-caused damage", "Moisture infiltration from unrelated leaks"]);
  const inspectionGate = buildInspectionGate(
    "After air sealing — before closing cavities", ["Air sealing photos", "Blower door test if available"],
    "Hidden moisture or mold found requiring remediation before install",
    "Verify air sealing continuity before covering. Check moisture readings.",
  );
  const safeToProceed = computeSafeToProceed({
    hasMinimalData: isValid(issues), readinessScore: readiness.score, hasCriticalBlockers: false,
    hasMilestones: true, hasEvidencePlan: true, confidenceScore: confidence.score, noCriticalBlockers: true, scopeIsComplete: true,
  });
  const explained = buildExplainedOutput(
    `Your ${input.insulationType} insulation covers ${input.areaSqft} sqft in the ${input.accessType} to achieve R${input.targetRValue}.${input.airSealing ? " Air sealing included." : ""} Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
    [`Access: ${input.accessType} — ${(ACCESS_MULT[input.accessType] * 100 - 100).toFixed(0)}% complexity premium`, `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`],
  );
  const algorithmTrace = buildAlgorithmTrace(ALGORITHM_VERSIONS.insulation, "insulation",
    ["areaSqft", "insulationType", "targetRValue", "accessType", "airSealing"],
    [], ["Adequate cavity depth", "No moisture damage"],
    [
      { ruleId: "SPRAY_FOAM_PREMIUM", label: "Spray foam premium",   triggered: input.insulationType === "spray-foam", reason: "Specialist application, PPE, ventilation required", points: 16 },
      { ruleId: "CRAWLSPACE",         label: "Crawlspace access",    triggered: input.accessType === "crawlspace",     reason: "Confined space, moisture risk, extra labor", points: 18 },
      { ruleId: "HIGH_R",             label: "High R-value",         triggered: input.targetRValue >= 30,              reason: "May require multiple passes or thicker product", points: 14 },
    ],
  );

  return {
    toolId: `insulation-${Date.now()}`, trade: "insulation", projectType: input.accessType,
    mode: input.mode, inputs: { ...input }, validationIssues: issues, isValid: isValid(issues),
    materials: mats, labor, costs, risk, milestones, evidenceRequired: evidence.items,
    warnings: [
      ...(input.insulationType === "spray-foam" ? ["Spray foam: PPE, ventilation, and cure-time controls required."] : []),
      ...(input.accessType === "crawlspace" ? ["Crawlspace: monitor moisture and confined-space conditions."] : []),
      ...(!input.airSealing ? ["Without air sealing, thermal performance will be reduced."] : []),
    ],
    recommendations: [
      "Document insulation type, depth, and label before closeout.",
      "Perform air sealing before closing cavities.",
      ...(input.insulationType === "spray-foam" ? ["Confirm ventilation and re-entry timing after spray."] : []),
    ],
    assumptions: ["Adequate cavity depth for R-value target.", "No mold or moisture damage present.", "US market pricing."],
    createdAt: new Date().toISOString(),
    confidenceScore: confidence, readinessScore: readiness, disputeRisk, priceBands,
    safeToProceed, scope, explained, warranty, inspectionGate, algorithmTrace,
  } as SemseToolResult;
}

export const runInsulationEngine = calculateInsulation;
