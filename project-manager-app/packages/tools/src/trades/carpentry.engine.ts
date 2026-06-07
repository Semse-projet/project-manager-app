import { collect, isValid, oneOf, positive, range, warn } from "../core/validation-engine.js";
import { applyLocation, buildCostSummary, material, materialTotal, priceOf } from "../core/cost-engine.js";
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

export type CarpentryProjectType = "cabinet" | "door" | "closet" | "shelf" | "trim" | "table" | "repair" | "custom" | "built-in" | "stair-trim";
export type WoodMaterial = "pine" | "plywood" | "mdf" | "oak" | "maple" | "treated" | "poplar";
export type FinishType   = "none" | "paint" | "stain" | "polyurethane" | "lacquer";
export type Complexity   = "basic" | "medium" | "complex";

export type CarpentryInput = {
  projectType: CarpentryProjectType;
  material: WoodMaterial;
  lengthIn: number;
  widthIn: number;
  thicknessIn: number;
  quantity: number;
  finishType: FinishType;
  complexity: Complexity;
  hardwareCount: number;
  paintedCabinets: boolean;
  softClose: boolean;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const PROJECT_TYPES = ["cabinet", "door", "closet", "shelf", "trim", "table", "repair", "custom", "built-in", "stair-trim"] as const;
const WOOD_MATERIALS = ["pine", "plywood", "mdf", "oak", "maple", "treated", "poplar"] as const;
const FINISH_TYPES = ["none", "paint", "stain", "polyurethane", "lacquer"] as const;
const COMPLEXITIES = ["basic", "medium", "complex"] as const;
const TOOL_MODES = ["client", "professional", "admin"] as const;

const MATERIAL_PRICE: Record<WoodMaterial, number> = {
  pine: 4.20, plywood: 7.40, mdf: 5.60, oak: 11.50, maple: 12.80, treated: 8.80, poplar: 7.20,
};
const FINISH_PRICE: Record<FinishType, number> = {
  none: 0, paint: 1.90, stain: 2.40, polyurethane: 2.80, lacquer: 3.50,
};
const LABOR_RATE: Record<CarpentryProjectType, number> = {
  cabinet: 72, door: 64, closet: 62, shelf: 52, trim: 56, table: 68,
  repair: 58, custom: 78, "built-in": 74, "stair-trim": 70,
};

function normalizeRange(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function normalizeOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

export function calculateCarpentry(input: CarpentryInput): SemseToolResult {
  const issues = collect(
    oneOf("projectType", input.projectType, PROJECT_TYPES, "Project type"),
    oneOf("material", input.material, WOOD_MATERIALS, "Material"),
    oneOf("finishType", input.finishType, FINISH_TYPES, "Finish type"),
    oneOf("complexity", input.complexity, COMPLEXITIES, "Complexity"),
    oneOf("mode", input.mode, TOOL_MODES, "Mode"),
    positive("lengthIn", input.lengthIn, "Length"),
    positive("widthIn", input.widthIn, "Width"),
    positive("thicknessIn", input.thicknessIn, "Thickness"),
    positive("quantity", input.quantity, "Quantity"),
    range("hardwareCount", input.hardwareCount, 0, 500, "Hardware count"),
    input.material === "mdf" && input.projectType === "door" ? warn("material", "MDF for doors: seal edges, avoid moisture, interior use only.") : null,
    input.complexity === "complex" && input.hardwareCount < 4 ? warn("hardwareCount", "Complex project with few hardware pieces: verify assembly and fasteners.") : null,
    input.paintedCabinets && input.finishType === "none" ? warn("finishType", "Painted cabinets with no finish selected: verify scope.") : null,
  );

  const projectType = normalizeOneOf(input.projectType, PROJECT_TYPES, "custom");
  const woodMaterial = normalizeOneOf(input.material, WOOD_MATERIALS, "pine");
  const finishType = normalizeOneOf(input.finishType, FINISH_TYPES, "none");
  const complexity = normalizeOneOf(input.complexity, COMPLEXITIES, "basic");
  const mode = normalizeOneOf(input.mode, TOOL_MODES, "professional");
  const lengthIn = normalizeRange(input.lengthIn, 0.01, 10_000, 96);
  const widthIn = normalizeRange(input.widthIn, 0.01, 10_000, 12);
  const thicknessIn = normalizeRange(input.thicknessIn, 0.01, 120, 0.75);
  const quantity = normalizeRange(input.quantity, 0.01, 10_000, 1);
  const hardwareCount = normalizeRange(input.hardwareCount, 0, 500, 0);

  const boardFeet     = (lengthIn * widthIn * thicknessIn * quantity) / 144;
  const surfaceSqFt   = (lengthIn * widthIn * quantity) / 144;
  const waste         = complexity === "complex" ? 0.18 : complexity === "medium" ? 0.12 : 0.08;
  const adjBoardFeet  = boardFeet * (1 + waste);
  const matUnits      = Math.max(1, Math.ceil(adjBoardFeet / 2));
  const matPrice      = priceOf(input.prices, "lumber-framing", MATERIAL_PRICE[woodMaterial]);
  const hardwarePacks = Math.max(1, Math.ceil(hardwareCount / 4));
  const softCloseKits = input.softClose ? Math.max(1, Math.ceil(hardwareCount / 6)) : 0;

  const mats = [
    material(`${woodMaterial} stock`, matUnits, "board-ft", matPrice, "Wood"),
    material("Hardware pack", hardwarePacks, "pack", 14.50, "Hardware"),
    ...(finishType !== "none" ? [material(`${finishType} finish`, Math.max(1, Math.ceil(surfaceSqFt / 25)), "qt", FINISH_PRICE[finishType] * 12, "Finish")] : []),
    ...(softCloseKits > 0 ? [material("Soft-close hinges / slides", softCloseKits, "kit", 65, "Hardware")] : []),
    ...(projectType === "trim" || projectType === "stair-trim" ? [material("Trim fasteners / adhesive", Math.max(1, Math.ceil(surfaceSqFt / 30)), "kit", 11, "Finish")] : []),
    ...(projectType === "repair" ? [material("Patch / filler / sanding kit", Math.max(1, Math.ceil(surfaceSqFt / 20)), "kit", 18, "Repair")] : []),
    ...(input.paintedCabinets ? [material("Cabinet primer / paint", Math.max(1, Math.ceil(surfaceSqFt / 30)), "qt", 28, "Paint")] : []),
  ];

  const labor = estimateLabor({
    baseHours: 3 + adjBoardFeet / 12 + quantity * 0.6 + hardwareCount * 0.08
      + (complexity === "medium" ? 2 : 0) + (complexity === "complex" ? 4 : 0)
      + (projectType === "repair" ? 1.5 : 0) + (projectType === "door" ? 1.25 : 0)
      + (["cabinet", "built-in"].includes(projectType) ? 2 : 0)
      + (input.paintedCabinets ? adjBoardFeet / 20 : 0) + (input.softClose ? 1 : 0),
    crewSize: adjBoardFeet > 180 ? 3 : 2,
    ratePerHour: LABOR_RATE[projectType],
    difficulty: complexity === "complex" || ["cabinet", "built-in", "door", "custom"].includes(projectType) ? "complex" : "moderate",
    notes: [`${adjBoardFeet.toFixed(1)} board-ft — ${woodMaterial}`, `${quantity} pcs — ${projectType}`, finishType !== "none" ? `Finish: ${finishType}` : "No finish"],
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost, input.location, "labor"),
    { overhead: complexity === "complex" ? 0.17 : 0.14, profit: 0.20, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: quantity || 1 },
  );

  const risk = computeRisk([
    factor("mdf",      "MDF material",          0.14, woodMaterial === "mdf"),
    factor("cabinet",  "Cabinet / built-in",    0.16, ["cabinet", "built-in"].includes(projectType)),
    factor("door",     "Door / stair trim fit", 0.14, ["door", "stair-trim"].includes(projectType)),
    factor("complex",  "Complex project",       0.20, complexity === "complex"),
    factor("painted",  "Painted cabinets",      0.12, input.paintedCabinets),
    factor("no_finish","No finish",             0.10, finishType === "none"),
  ], { requiresPermit: false, requiresLicense: false, requiresInspection: ["door", "cabinet"].includes(projectType) || complexity === "complex", requiresEngineering: false });

  const milestones = buildMilestones(costs.total, risk.level,
    ["Cutting and layout", "Joinery and assembly", "Finish application", "Install / handoff"],
    [
      ["Photos of material and cut layout", "Dimension confirmation"],
      ["Photos of assembled pieces", "Hardware verification"],
      ["Photos of finish / paint coat", "Surface quality check"],
      ["Photos of installed piece", "Client approval"],
    ]
  );
  const evidence = buildEvidenceChecklist("carpentry", risk, milestones, [
    { type: "photo",      description: "Material and cut layout",        required: true, milestone: 1 },
    { type: "photo",      description: "Joinery and assembly",           required: true, milestone: 2 },
    { type: "photo",      description: "Finish or surface treatment",    required: finishType !== "none", milestone: 3 },
    { type: "inspection", description: "Final fit and client sign-off",  required: true, milestone: 4 },
  ]);

  const confidence = computeConfidenceScore({
    hasMeasurements: true, hasPhotos: false, hasConditionData: true,
    hasMaterialSelection: true, hasScopeConfirmed: true, hasUnknownConditions: false,
    extraConfirmedFields: (input.softClose ? 1 : 0) + (input.paintedCabinets ? 1 : 0) + (finishType !== "none" ? 1 : 0),
  });
  const readiness = computeReadinessScore({
    measurementsConfirmed: true, materialsAvailable: false, siteAccessConfirmed: true,
    permitsAddressed: true, scopeApproved: true, depositPaid: false, clientApproval: false,
  });
  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous: false, clientProvidesMaterials: false, noPhotosRequired: false,
    hasChangeOrderPolicy: true, hasEvidenceRequired: true, hasMilestones: true,
    hasHighRiskConditions: complexity === "complex" || input.paintedCabinets,
    priceIsFixed: true, clientExpectationMismatch: input.paintedCabinets,
  });
  const priceBands = computePriceBands(costs.total, 0.82, complexity === "complex" || woodMaterial === "oak" || woodMaterial === "maple" ? 1.40 : 1.25, {
    low:  "Pine / MDF, basic complexity, no finish",
    mid:  "Oak / plywood, medium complexity, stain or paint",
    high: woodMaterial === "maple" || complexity === "complex" ? "Maple/oak, complex, soft-close, painted cabinets" : "Custom built-in, complex, premium material",
  });
  const scope = buildScope(
    [`${projectType} — ${quantity} pcs (${woodMaterial})`, `Dimensions: ${lengthIn}" × ${widthIn}" × ${thicknessIn}"`, finishType !== "none" ? `Finish: ${finishType}` : "", input.softClose ? "Soft-close hardware" : "", input.paintedCabinets ? "Cabinet painting" : ""].filter(Boolean),
    [finishType === "none" ? "Surface finish / sealing" : "", "On-site painting touch-up beyond scope", "Countertop or hardware supply (client-provided unless noted)"].filter(Boolean),
    ["Dimensions are finished dimensions", "US market pricing"],
    ["Site conditions require field modifications", "Material defect found on delivery"],
  );
  const warranty = buildWarranty(365, "1-year labor warranty on installation. Material per manufacturer.", ["Normal wood movement", "Client-caused damage", "Paint touch-up from daily use"]);
  const inspectionGate = buildInspectionGate(
    "After assembly — before finish or paint application",
    ["Assembly photos", "Hardware operation check"],
    "Fit or alignment issue requiring rework before finishing",
    "Verify all joints, hardware, and fit before applying finish.",
  );
  const safeToProceed = computeSafeToProceed({
    hasMinimalData: isValid(issues), readinessScore: readiness.score, hasCriticalBlockers: false,
    hasMilestones: true, hasEvidencePlan: true, confidenceScore: confidence.score, noCriticalBlockers: true, scopeIsComplete: true,
  });
  const explained = buildExplainedOutput(
    `Your ${projectType} in ${woodMaterial} (${quantity} pcs, ${complexity} complexity) with ${finishType !== "none" ? finishType + " finish" : "no finish"}.${input.softClose ? " Soft-close hardware included." : ""} Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
    [`Board feet: ${adjBoardFeet.toFixed(1)} (${(waste * 100).toFixed(0)}% waste)`, `Labor rate: $${LABOR_RATE[projectType]}/hr`, `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`],
  );
  const algorithmTrace = buildAlgorithmTrace(ALGORITHM_VERSIONS.carpentry, "carpentry",
    ["projectType", "material", "lengthIn", "widthIn", "quantity", "complexity", "finishType"],
    [], ["Finished dimensions", "US market pricing"],
    [
      { ruleId: "COMPLEX_MULT",     label: "Complex project",      triggered: complexity === "complex",  reason: "18% waste + 4 extra labor hours + premium rate", points: 20 },
      { ruleId: "PAINTED_CABINETS", label: "Painted cabinets",     triggered: input.paintedCabinets,           reason: "Primer, paint, and extra labor for fine finish", points: 12 },
      { ruleId: "SOFT_CLOSE",       label: "Soft-close hardware",  triggered: input.softClose,                 reason: "Premium hardware kits + installation time", points: 0 },
      { ruleId: "OAK_MAPLE",        label: "Hardwood premium",     triggered: woodMaterial === "oak" || woodMaterial === "maple", reason: "Higher material cost and precision machining", points: 12 },
    ],
  );


  const productionSchedule = buildProductionSchedule([
    { name: 'Material selection and shop drawings', daysMin: 1, daysMax: 2, crew: 1, description: 'Confirm dimensions, grain direction, hardware specs' },
    { name: 'Cutting and milling', daysMin: 1, daysMax: 2, crew: 1, description: 'Mill stock to size, cut joints, sand rough' },
    { name: 'Assembly and dry-fit', daysMin: 1, daysMax: 2, crew: 2, description: 'Assemble joints, verify square and fit, make adjustments' },
    { name: 'Finish application', daysMin: 1, daysMax: 3, crew: 1, description: 'Apply stain, paint, or clear finish in coats' },
    { name: 'Installation and hardware', daysMin: 1, daysMax: 2, crew: 2, description: 'Install piece in place, mount hardware, adjust fit' },
  ]);

  const hiddenDamage = assessHiddenDamageProbability(undefined, false, false, false, false, false);

  const scheduleRisk = assessScheduleRisk({
    dependsOnOtherTrades: true,
    clientMustDecide: finishType === 'none' || !woodMaterial,
    materialsOnSite: false,
    weatherDependent: false,
    scopeIsLarge: quantity > 10,
    hasComplexDetails: complexity === 'complex' || ['cabinet','built-in','stair-trim'].includes(projectType),
  });

  const upsells = [
      { service: 'Soft-close hinge and slide upgrade', reason: 'Add while cabinets are open — lifetime benefit for minimal cost.' },
      { service: 'Under-cabinet LED lighting', reason: 'Wire channels easiest to add before cabinet installation.' },
      { service: 'Interior cabinet accessories (pullouts, organizers)', reason: 'Measure for organizers during the same site visit.' }
  ];

  const roi = {
    investmentAmount:    costs.total,
    estimatedValueAdded: Math.round(costs.total * 0.75),
    roiPercent:          -25,
    notes:               'Custom carpentry returns 75% in home value and significantly upgrades kitchen and bath perception.',
  };
  return {
    toolId: `carpentry-${Date.now()}`, trade: "carpentry", projectType,
    mode, inputs: { ...input }, validationIssues: issues, isValid: isValid(issues),
    materials: mats, labor, costs, risk, milestones, evidenceRequired: evidence.items,
    warnings: [
      ...(woodMaterial === "mdf" ? ["MDF: seal edges and avoid moisture exposure."] : []),
      ...(projectType === "door" ? ["Doors require tight tolerances and hinge alignment."] : []),
      ...(complexity === "complex" ? ["Complex project: expect more setup and alignment time."] : []),
      ...(finishType === "none" ? ["No finish: consider sealing for durability."] : []),
    ],
    recommendations: [
      "Confirm final dimensions and reveals before cutting.",
      "Check grain direction and finish compatibility.",
      ...(input.paintedCabinets ? ["Sand between coats for smooth painted cabinet finish."] : []),
    ],
    assumptions: ["Dimensions are finished dimensions.", "US market pricing."],
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

export const runCarpentryEngine = calculateCarpentry;
