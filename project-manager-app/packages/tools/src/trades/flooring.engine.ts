import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { applyLocation, buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";
import {
  buildProductionSchedule,
  assessHiddenDamageProbability,
  assessScheduleRisk,
  computeConfidenceScore, computeDisputeRisk, computeReadinessScore,
  computePriceBands, buildScope, buildExplainedOutput, buildWarranty,
  buildInspectionGate, buildAlgorithmTrace, computeSafeToProceed, ALGORITHM_VERSIONS,
} from "../core/extended-metrics.js";

export type FlooringType = "vinyl" | "laminate" | "tile" | "hardwood" | "engineered-wood" | "carpet";

export type FlooringInput = {
  lengthFt: number;
  widthFt: number;
  flooringType: FlooringType;
  pattern: "straight" | "diagonal" | "herringbone";
  includeUnderlayment: boolean;
  removeOldFloor: boolean;
  floorPrepLevel: "none" | "minor" | "major";
  moistureBarrier: boolean;
  transitionStrips: number;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const MATERIAL_COST_PER_SQFT: Record<FlooringType, number> = {
  vinyl: 3.60, laminate: 4.40, tile: 6.80, hardwood: 8.90, "engineered-wood": 6.50, carpet: 3.20,
};
const UNDERLAYMENT_COST: Record<FlooringType, number> = {
  vinyl: 0.65, laminate: 0.85, tile: 1.25, hardwood: 1.10, "engineered-wood": 0.90, carpet: 0.45,
};
const WASTE_BY_PATTERN = { straight: 0.08, diagonal: 0.12, herringbone: 0.18 };
const BOX_COVERAGE = 20; // sqft per box default

export function calculateFlooring(input: FlooringInput): SemseToolResult {
  const issues = collect(
    positive("lengthFt", input.lengthFt, "Length"),
    positive("widthFt", input.widthFt, "Width"),
    input.pattern === "herringbone" ? warn("pattern", "Herringbone: higher waste and longer install.") : null,
    input.flooringType === "hardwood" && !input.includeUnderlayment ? warn("includeUnderlayment", "Hardwood without underlayment: check moisture and acoustics.") : null,
    input.removeOldFloor && input.floorPrepLevel === "none" ? warn("floorPrepLevel", "Removal without prep: verify subfloor level.") : null,
    input.flooringType === "hardwood" && !input.moistureBarrier ? warn("moistureBarrier", "Hardwood without moisture barrier: recommend adding over concrete.") : null,
  );

  const areaSqFt = input.lengthFt * input.widthFt;
  const wasteFactor = WASTE_BY_PATTERN[input.pattern] + (input.removeOldFloor ? 0.03 : 0);
  const adjustedArea = areaSqFt * (1 + wasteFactor);
  const boxesNeeded = Math.max(1, Math.ceil(adjustedArea / BOX_COVERAGE));
  const underlaymentRolls = input.includeUnderlayment ? Math.max(1, Math.ceil(adjustedArea / 100)) : 0;
  const prepKits = input.floorPrepLevel === "major" ? Math.ceil(areaSqFt / 120) : input.floorPrepLevel === "minor" ? Math.ceil(areaSqFt / 200) : 0;

  const mats = [
    material(`${input.flooringType} flooring`, boxesNeeded, "box", MATERIAL_COST_PER_SQFT[input.flooringType] * BOX_COVERAGE, "Finish"),
    ...(input.includeUnderlayment ? [material("Underlayment", underlaymentRolls, "roll", UNDERLAYMENT_COST[input.flooringType] * 100, "Base")] : []),
    ...(input.moistureBarrier ? [material("Moisture barrier", Math.ceil(adjustedArea / 200), "roll", 48, "Protection")] : []),
    ...(input.removeOldFloor ? [material("Old floor removal / disposal", Math.max(1, Math.ceil(areaSqFt / 150)), "job", 38, "Demo")] : []),
    material("Adhesive / fasteners / spacers", Math.max(1, Math.ceil(areaSqFt / 250)), "kit", 24, "Install"),
    ...(prepKits > 0 ? [material("Subfloor prep materials", Math.max(1, prepKits), "kit", 32, "Prep")] : []),
    ...(input.transitionStrips > 0 ? [material("Transition strips", input.transitionStrips, "ea", 28, "Trim")] : []),
  ];

  const labor = estimateLabor({
    baseHours: 4 + adjustedArea / 120 + (input.removeOldFloor ? 2.5 : 0)
      + (input.floorPrepLevel === "minor" ? 1.5 : 0) + (input.floorPrepLevel === "major" ? 4 : 0)
      + (input.pattern === "diagonal" ? 1.75 : 0) + (input.pattern === "herringbone" ? 3.5 : 0)
      + (input.flooringType === "tile" ? 2.25 : 0) + (input.flooringType === "hardwood" ? 2 : 0)
      + (input.moistureBarrier ? 1 : 0),
    crewSize: adjustedArea > 1000 ? 3 : 2,
    ratePerHour: input.flooringType === "tile" || input.flooringType === "hardwood" ? 62 : 54,
    difficulty: input.flooringType === "tile" || input.flooringType === "hardwood" || input.pattern === "herringbone" || input.floorPrepLevel === "major" ? "complex" : "moderate",
    notes: [`${areaSqFt.toFixed(0)} sqft — ${adjustedArea.toFixed(0)} adjusted`, `${input.flooringType} — ${input.pattern} pattern`],
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost, input.location, "labor"),
    { overhead: input.pattern === "herringbone" || input.floorPrepLevel === "major" ? 0.16 : 0.14, profit: 0.20, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: areaSqFt || 1 },
  );

  const risk = computeRisk([
    factor("hardwood",     "Hardwood",          0.16, input.flooringType === "hardwood"),
    factor("tile",         "Tile flooring",     0.14, input.flooringType === "tile"),
    factor("herringbone",  "Herringbone",        0.18, input.pattern === "herringbone"),
    factor("remove_old",   "Remove old floor",  0.16, input.removeOldFloor),
    factor("major_prep",   "Major subfloor prep",0.20, input.floorPrepLevel === "major"),
  ], { requiresPermit: false, requiresLicense: false, requiresInspection: input.flooringType === "tile" || input.floorPrepLevel === "major", requiresEngineering: false });

  const milestones = buildMilestones(costs.total, risk.level,
    ["Measurement and layout", "Subfloor prep", "Install flooring", "Trim, cleanup and handoff"],
    [
      ["Photos of measurements", "Layout confirmation"],
      ["Photos of prep and underlayment", "Subfloor level check"],
      ["Photos of installed flooring", "Joint / alignment check"],
      ["Final photos", "Client sign-off"],
    ]
  );
  const evidence = buildEvidenceChecklist("flooring", risk, milestones, [
    { type: "photo",       description: "Pre-install room condition",          required: true, milestone: 1 },
    { type: "measurement", description: "Subfloor level / moisture check",     required: input.flooringType === "hardwood" || input.floorPrepLevel === "major", milestone: 2 },
    { type: "photo",       description: "Flooring installed",                  required: true, milestone: 3 },
    { type: "inspection",  description: "Final walkthrough and approval",      required: true, milestone: 4 },
  ]);

  // ── Extended metrics ──
  const confidence = computeConfidenceScore({
    hasMeasurements: true, hasPhotos: false, hasConditionData: input.floorPrepLevel !== "none",
    hasMaterialSelection: true, hasScopeConfirmed: true, hasUnknownConditions: input.floorPrepLevel === "none" && input.removeOldFloor,
    extraConfirmedFields: (input.moistureBarrier ? 1 : 0) + (input.includeUnderlayment ? 1 : 0) + (input.transitionStrips > 0 ? 1 : 0),
  });
  const readiness = computeReadinessScore({
    measurementsConfirmed: true, materialsAvailable: false, siteAccessConfirmed: true,
    permitsAddressed: true, scopeApproved: true, depositPaid: false, clientApproval: false,
  });
  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous: input.floorPrepLevel === "none" && input.removeOldFloor,
    clientProvidesMaterials: false, noPhotosRequired: false, hasChangeOrderPolicy: true,
    hasEvidenceRequired: true, hasMilestones: true, hasHighRiskConditions: input.floorPrepLevel === "major",
    priceIsFixed: true, clientExpectationMismatch: input.pattern === "herringbone",
  });
  const priceBands = computePriceBands(costs.total, 0.82, input.flooringType === "hardwood" || input.pattern === "herringbone" ? 1.35 : 1.22, {
    low:  "Vinyl/laminate, straight pattern, no removal, no prep",
    mid:  "Standard material, minor prep, removal",
    high: input.flooringType === "hardwood" ? "Hardwood, herringbone, major subfloor prep" : "Tile/hardwood, herringbone, major prep",
  });
  const scope = buildScope(
    [`${input.flooringType} installation (${areaSqFt.toFixed(0)} sqft)`, input.includeUnderlayment ? "Underlayment" : "", input.removeOldFloor ? "Old floor removal and disposal" : "", input.moistureBarrier ? "Moisture barrier" : "", input.transitionStrips > 0 ? `${input.transitionStrips} transition strips` : "", "Adhesive / fasteners", "Cleanup"].filter(Boolean),
    ["Subfloor structural replacement", "Baseboard installation or painting", !input.transitionStrips ? "Transition strips" : ""].filter(Boolean),
    ["Subfloor structurally sound — no replacement needed", "US market pricing"],
    ["Subfloor damage discovered after removal", "Moisture levels exceed install threshold"],
  );
  const warranty = buildWarranty(365, "1-year labor warranty on installation. Material manufacturer warranty varies.", ["Client-caused damage", "Moisture exposure beyond normal", "Furniture scraping"]);
  const inspectionGate = buildInspectionGate(
    "After subfloor prep — before flooring install", ["Subfloor level measurements", "Moisture reading"],
    "Subfloor damage or moisture issue requiring repair before installation",
    "Verify subfloor flatness (3/16\" in 10ft) and moisture (<12% for hardwood).",
  );
  const safeToProceed = computeSafeToProceed({
    hasMinimalData: isValid(issues), readinessScore: readiness.score, hasCriticalBlockers: false,
    hasMilestones: true, hasEvidencePlan: true, confidenceScore: confidence.score, noCriticalBlockers: true, scopeIsComplete: true,
  });
  const explained = buildExplainedOutput(
    `Your ${input.flooringType} installation covers ${areaSqFt.toFixed(0)} sqft in ${input.pattern} pattern.${input.removeOldFloor ? " Old floor removal included." : ""} Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
    [`Pattern waste: ${(WASTE_BY_PATTERN[input.pattern] * 100).toFixed(0)}% — ordered ${boxesNeeded} boxes`, `Subfloor prep: ${input.floorPrepLevel}`, `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`],
  );
  const algorithmTrace = buildAlgorithmTrace(ALGORITHM_VERSIONS.flooring, "flooring",
    ["lengthFt", "widthFt", "flooringType", "pattern", "removeOldFloor", "floorPrepLevel"],
    input.floorPrepLevel === "none" && input.removeOldFloor ? ["subfloor condition"] : [],
    ["Subfloor sound", "US market pricing"],
    [
      { ruleId: "HERRINGBONE_WASTE", label: "Herringbone waste", triggered: input.pattern === "herringbone", reason: "18% waste vs 8% straight", points: 18 },
      { ruleId: "MAJOR_PREP",        label: "Major subfloor prep", triggered: input.floorPrepLevel === "major", reason: "Leveling and patching add significant labor", points: 20 },
      { ruleId: "HARDWOOD_RATE",     label: "Hardwood labor rate", triggered: input.flooringType === "hardwood", reason: "Precision fastening, nailing, acclimation", points: 16 },
    ],
  );


  const productionSchedule = buildProductionSchedule([
    { name: 'Site measure and layout', daysMin: 0, daysMax: 1, crew: 2, description: 'Confirm dimensions, door swing clearances, subfloor level check' },
    { name: 'Old floor removal', daysMin: 1, daysMax: 2, crew: 2, description: 'Remove existing flooring, bag and stage debris' },
    { name: 'Subfloor prep', daysMin: 1, daysMax: 2, crew: 2, description: 'Level, patch, moisture treatment, install underlayment' },
    { name: 'Flooring installation', daysMin: 2, daysMax: 5, crew: 2, description: 'Install flooring panels, cut around obstacles' },
    { name: 'Trim and transitions', daysMin: 1, daysMax: 1, crew: 2, description: 'Install transitions, base shoe, final cleanup' },
  ]);

  const hiddenDamage = assessHiddenDamageProbability(undefined, false, false, false, false, false);

  const scheduleRisk = assessScheduleRisk({
    dependsOnOtherTrades: false,
    clientMustDecide: false,
    materialsOnSite: false,
    weatherDependent: false,
    scopeIsLarge: input.lengthFt * input.widthFt > 1000,
    hasComplexDetails: input.pattern === 'herringbone' || input.floorPrepLevel === 'major',
  });

  const upsells = [
      { service: 'Baseboard and base shoe replacement', reason: 'Crews are already on site — ideal time to replace trim.' },
      { service: 'Moisture barrier upgrade', reason: 'Prevents cupping in hardwood; adds ~10% to material cost.' },
      { service: 'Furniture removal and replacement', reason: 'Saves client coordination time and protects new floor.' }
  ];

  const roi = {
    investmentAmount:    costs.total,
    estimatedValueAdded: Math.round(costs.total * 0.8),
    roiPercent:          -20,
    notes:               'New flooring adds 80% of installation cost in perceived home value and resale appeal.',
  };
  return {
    toolId: `flooring-${Date.now()}`, trade: "flooring",
    projectType: input.removeOldFloor ? "floor-remodel" : "floor-install",
    mode: input.mode, inputs: { ...input }, validationIssues: issues, isValid: isValid(issues),
    materials: mats, labor, costs, risk, milestones, evidenceRequired: evidence.items,
    warnings: [
      ...(input.flooringType === "hardwood" ? ["Hardwood: allow 48–72h acclimation before install."] : []),
      ...(input.pattern === "herringbone" ? ["Herringbone: 18% waste and longer layout time."] : []),
      ...(input.removeOldFloor ? ["Remove old floor: verify subfloor condition after demo."] : []),
      ...(input.floorPrepLevel === "major" ? ["Major prep: plan extra labor for leveling and patching."] : []),
    ],
    recommendations: [
      "Confirm transitions, trim and baseboard finish before install.",
      "Check moisture and flatness of subfloor before closing.",
      ...(input.flooringType === "hardwood" ? ["Store hardwood onsite for acclimation before install."] : []),
    ],
    assumptions: ["US market pricing.", "Subfloor structurally sound.", "Box coverage ≈ 20 sqft/box."],
    productionSchedule,
    hiddenDamageAssessment: hiddenDamage,
    scheduleRisk,
    upsells,
    roi,
    createdAt: new Date().toISOString(),
    confidenceScore: confidence, readinessScore: readiness, disputeRisk, priceBands,
    safeToProceed, scope, explained, warranty, inspectionGate, algorithmTrace,
  } as SemseToolResult;
}

export const runFlooringEngine = calculateFlooring;
