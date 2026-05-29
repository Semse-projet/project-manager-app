import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
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
  assessHiddenDamageProbability,
} from "../core/extended-metrics.js";

export type DemoType = "drywall" | "flooring" | "concrete" | "cabinets" | "full-interior" | "exterior" | "selective";
export type DemoDifficulty = "basic" | "standard" | "complex" | "critical";

export type DemolitionInput = {
  areaSqft: number;
  demolitionType: DemoType;
  difficulty: DemoDifficulty;
  hazardousMaterialSuspected: boolean;
  utilitiesPresent: boolean;
  structuralElementsPresent: boolean;
  asbestosTestRequired: boolean;
  crewSize: number;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const DEBRIS_PER_SQFT: Record<DemoType, number> = {
  drywall: 0.018, flooring: 0.012, concrete: 0.045, cabinets: 0.020,
  "full-interior": 0.060, exterior: 0.030, selective: 0.015,
};
const DIFFICULTY_MULT: Record<DemoDifficulty, number> = {
  basic: 1.00, standard: 1.12, complex: 1.30, critical: 1.55,
};
const LABOR_BONUS: Record<DemoType, number> = {
  drywall: 0, flooring: 0.75, concrete: 1.75, cabinets: 0.80,
  "full-interior": 2.80, exterior: 1.50, selective: 0.50,
};

export function calculateDemolition(input: DemolitionInput): SemseToolResult {
  const issues = collect(
    positive("areaSqft", input.areaSqft, "Area"),
    range("crewSize", input.crewSize, 1, 12, "Crew size"),
    input.hazardousMaterialSuspected ? warn("hazardousMaterialSuspected", "Hazardous material suspected: inspection and abatement plan required.") : null,
    input.utilitiesPresent ? warn("utilitiesPresent", "Utilities present: confirm shutoff and lockout/tagout before demolition.") : null,
    input.structuralElementsPresent ? warn("structuralElementsPresent", "Structural elements: engineering review required before removal.") : null,
    input.difficulty === "critical" ? warn("difficulty", "Critical difficulty: requires admin review and stronger evidence capture.") : null,
  );

  const crewSize     = Math.max(1, Math.round(input.crewSize));
  const debrisVol    = Math.max(0.5, input.areaSqft * DEBRIS_PER_SQFT[input.demolitionType] * DIFFICULTY_MULT[input.difficulty]);
  const disposalLoads = Math.max(1, Math.ceil(debrisVol / 8));
  const containKits  = Math.max(1, Math.ceil(input.areaSqft / 350));
  const ppeKits      = Math.max(1, Math.ceil(crewSize * (input.hazardousMaterialSuspected ? 1.5 : 1)));

  const mats = [
    material("Debris disposal / haul-off", debrisVol, "yd³", 55, "Disposal"),
    material("Containment / dust barrier", containKits, "kit", 28, "Protection"),
    material("PPE / respirator kits", ppeKits, "kit", input.hazardousMaterialSuspected ? 42 : 24, "Safety"),
    material("Demo blades / cutting discs", Math.max(1, Math.ceil(input.areaSqft / 500)), "kit", 18, "Tools"),
    ...(input.utilitiesPresent ? [material("Utility lockout / marking supplies", 1, "set", 22, "Safety")] : []),
    ...(input.demolitionType === "full-interior" ? [material("Dumpster reservation / staging", disposalLoads, "load", 135, "Disposal")] : []),
    ...(input.asbestosTestRequired ? [material("Asbestos test kit / lab", 1, "set", 285, "Testing")] : []),
  ];

  const labor = estimateLabor({
    baseHours: 4 + (input.areaSqft / 85) * DIFFICULTY_MULT[input.difficulty]
      + LABOR_BONUS[input.demolitionType] + (input.utilitiesPresent ? 1.5 : 0)
      + (input.hazardousMaterialSuspected ? 2.25 : 0) + (input.structuralElementsPresent ? 2 : 0)
      + (input.demolitionType === "full-interior" ? 3 : 0),
    crewSize,
    ratePerHour: 58,
    difficulty: input.difficulty === "critical" || input.hazardousMaterialSuspected || input.demolitionType === "full-interior" || input.demolitionType === "concrete" ? "complex" : "moderate",
    notes: [`${input.areaSqft} sqft — ${input.demolitionType} — ${input.difficulty}`, `Debris: ${debrisVol.toFixed(1)} yd³`, input.hazardousMaterialSuspected ? "⚠ Hazmat suspected" : ""],
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost, input.location, "labor"),
    { overhead: input.difficulty === "critical" || input.hazardousMaterialSuspected ? 0.18 : 0.15, profit: 0.20, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: input.areaSqft || 1 },
  );

  const risk = computeRisk([
    factor("hazardous",   "Hazardous material",     0.30, input.hazardousMaterialSuspected),
    factor("utilities",   "Utilities present",      0.20, input.utilitiesPresent),
    factor("structural",  "Structural elements",    0.22, input.structuralElementsPresent),
    factor("full_interior","Full interior demo",    0.22, input.demolitionType === "full-interior"),
    factor("critical",    "Critical difficulty",    0.18, input.difficulty === "critical"),
    factor("concrete",    "Concrete demolition",    0.12, input.demolitionType === "concrete"),
  ], {
    requiresPermit:  input.hazardousMaterialSuspected || input.demolitionType === "full-interior" || input.difficulty === "critical",
    requiresLicense: input.hazardousMaterialSuspected || input.difficulty === "critical",
    requiresInspection: true,
    requiresEngineering: input.demolitionType === "full-interior" || input.structuralElementsPresent,
  });

  const hiddenDamage = assessHiddenDamageProbability(undefined, false, false, false, input.demolitionType === "exterior", false);

  const milestones = buildMilestones(costs.total, risk.level,
    ["Site protection and shutoff", "Selective demolition", "Debris removal", "Final sweep and handoff"],
    [
      ["Photos of protected site", "Utility shutoff confirmed"],
      ["Demo progress photos", "Structural check"],
      ["Debris staged for haul-off", "Disposal ticket"],
      ["Final cleanup photos", "Client approval"],
    ]
  );
  const evidence = buildEvidenceChecklist("demolition", risk, milestones, [
    { type: "photo",       description: "Site protection and containment",   required: true, milestone: 1 },
    { type: "inspection",  description: "Utility shutoff / lockout",         required: input.utilitiesPresent, milestone: 1 },
    { type: "photo",       description: "Active demolition progress",        required: true, milestone: 2 },
    { type: "document",    description: "Dump / disposal receipt",           required: true, milestone: 3 },
    { type: "inspection",  description: "Hazardous material clearance",      required: input.hazardousMaterialSuspected, milestone: 3 },
    { type: "inspection",  description: "Final cleanup approval",            required: true, milestone: 4 },
  ]);

  const confidence = computeConfidenceScore({
    hasMeasurements: true, hasPhotos: false, hasConditionData: !input.hazardousMaterialSuspected,
    hasMaterialSelection: true, hasScopeConfirmed: !input.structuralElementsPresent,
    hasUnknownConditions: input.hazardousMaterialSuspected || input.structuralElementsPresent,
    extraConfirmedFields: (input.asbestosTestRequired ? 1 : 0),
  });
  const readiness = computeReadinessScore({
    measurementsConfirmed: true, materialsAvailable: false, siteAccessConfirmed: true,
    permitsAddressed: !(input.hazardousMaterialSuspected || input.demolitionType === "full-interior"),
    scopeApproved: !input.hazardousMaterialSuspected, depositPaid: false, clientApproval: false,
  });
  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous: input.structuralElementsPresent, clientProvidesMaterials: false,
    noPhotosRequired: false, hasChangeOrderPolicy: true, hasEvidenceRequired: true,
    hasMilestones: true, hasHighRiskConditions: input.hazardousMaterialSuspected || input.utilitiesPresent,
    priceIsFixed: true, clientExpectationMismatch: false,
  });
  const priceBands = computePriceBands(costs.total, 0.80, input.hazardousMaterialSuspected || input.demolitionType === "full-interior" ? 1.55 : input.demolitionType === "concrete" ? 1.40 : 1.25, {
    low:  "Drywall or flooring, basic difficulty, no hazmat",
    mid:  "Standard demo, utilities present, standard crew",
    high: input.hazardousMaterialSuspected ? "Hazmat abatement + full interior + critical difficulty" : "Full interior + structural + concrete + critical",
  });
  const scope = buildScope(
    [`${input.demolitionType} demolition (${input.areaSqft} sqft)`, `Difficulty: ${input.difficulty}`, `Crew: ${crewSize}`, `Debris disposal (${debrisVol.toFixed(1)} yd³)`, input.utilitiesPresent ? "Utility lockout/tagout" : "", input.asbestosTestRequired ? "Asbestos test" : ""].filter(Boolean),
    ["Hazardous material abatement (if found)", "Structural repair after demolition", "Adjacent surface patching", !input.asbestosTestRequired ? "Asbestos / lead-based paint testing" : ""].filter(Boolean),
    ["Non-structural demolition only", "US market pricing", "Hazmat abatement NOT included unless explicitly scoped"],
    ["Hazardous material discovered during demolition", "Structural element requiring engineering review", "Hidden utilities not flagged before work"],
  );
  const warranty = buildWarranty(90, "90-day warranty on demolition work completion and site cleanliness.", ["Damage caused by concealed utilities or hazmat", "Client-directed scope changes"]);
  const inspectionGate = buildInspectionGate(
    "Before starting if hazardous material suspected — and after all debris removed",
    ["Hazmat inspection report if applicable", "Photos of cleared site"],
    "Hazardous material discovered requiring abatement before continuation",
    input.hazardousMaterialSuspected ? "STOP WORK if hazmat found. Do not proceed without abatement clearance." : "Verify utility shutoff before starting demo.",
  );
  const safeToProceed = computeSafeToProceed({
    hasMinimalData: isValid(issues), readinessScore: readiness.score,
    hasCriticalBlockers: input.hazardousMaterialSuspected && !input.asbestosTestRequired,
    hasMilestones: true, hasEvidencePlan: true, confidenceScore: confidence.score,
    noCriticalBlockers: !(input.hazardousMaterialSuspected && !input.asbestosTestRequired),
    scopeIsComplete: !input.structuralElementsPresent,
  });
  const explained = buildExplainedOutput(
    `Your ${input.demolitionType} demolition covers ${input.areaSqft} sqft at ${input.difficulty} difficulty, generating ~${debrisVol.toFixed(1)} yd³ of debris.${input.hazardousMaterialSuspected ? " ⚠ Hazardous material suspected — abatement plan required before full demolition." : ""} Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
    [`Debris: ${debrisVol.toFixed(1)} yd³ — ${disposalLoads} disposal loads`, `Hidden damage risk: ${hiddenDamage.probability} (${hiddenDamage.score})`, `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`],
  );
  const algorithmTrace = buildAlgorithmTrace(ALGORITHM_VERSIONS.demolition, "demolition",
    ["areaSqft", "demolitionType", "difficulty", "hazardousMaterialSuspected", "utilitiesPresent"],
    input.structuralElementsPresent ? ["structural element scope"] : [], ["Non-structural demolition only", "US market pricing"],
    [
      { ruleId: "HAZMAT",      label: "Hazardous material",   triggered: input.hazardousMaterialSuspected, reason: "Stop work protocol + specialist abatement required", points: 30 },
      { ruleId: "UTILITIES",   label: "Utilities present",    triggered: input.utilitiesPresent,           reason: "Lockout/tagout, marking, extra coordination", points: 20 },
      { ruleId: "STRUCTURAL",  label: "Structural elements",  triggered: input.structuralElementsPresent,  reason: "Engineering review mandatory before removal", points: 22 },
      { ruleId: "CRITICAL",    label: "Critical difficulty",  triggered: input.difficulty === "critical",  reason: "1.55× labor/material multiplier", points: 18 },
    ],
  );

  return {
    toolId: `demolition-${Date.now()}`, trade: "demolition",
    projectType: input.demolitionType === "full-interior" ? "full-interior-demolition" : `${input.demolitionType}-demolition`,
    mode: input.mode, inputs: { ...input }, validationIssues: issues, isValid: isValid(issues),
    materials: mats, labor, costs, risk, milestones, evidenceRequired: evidence.items,
    warnings: [
      ...(input.hazardousMaterialSuspected ? ["⚠ STOP WORK if hazmat found — do not proceed without abatement clearance."] : []),
      ...(input.utilitiesPresent ? ["Utilities: verify shutoff and lockout/tagout before any demolition."] : []),
      ...(input.structuralElementsPresent ? ["Structural elements: engineering review required before removal."] : []),
    ],
    recommendations: [
      "Protect adjacent surfaces before any tear-out.",
      "Confirm utility shutoff and mark all active lines.",
      "Keep disposal tickets and haul-off receipts for closeout.",
      ...(input.hazardousMaterialSuspected ? ["Schedule hazmat inspection before full production demo."] : []),
    ],
    assumptions: ["Non-structural demolition only.", "Hazmat abatement NOT included unless scoped.", "US market pricing."],
    createdAt: new Date().toISOString(),
    confidenceScore: confidence, readinessScore: readiness, disputeRisk, priceBands,
    safeToProceed, scope, explained, warranty, inspectionGate, algorithmTrace,
  } as SemseToolResult;
}

export const runDemolitionEngine = calculateDemolition;
