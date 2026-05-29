import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { applyLocation, buildCostSummary, material, materialTotal, priceOf } from "../core/cost-engine.js";
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

export function calculateCarpentry(input: CarpentryInput): SemseToolResult {
  const issues = collect(
    positive("lengthIn", input.lengthIn, "Length"),
    positive("widthIn", input.widthIn, "Width"),
    positive("thicknessIn", input.thicknessIn, "Thickness"),
    positive("quantity", input.quantity, "Quantity"),
    range("hardwareCount", input.hardwareCount, 0, 500, "Hardware count"),
    input.material === "mdf" && input.projectType === "door" ? warn("material", "MDF for doors: seal edges, avoid moisture, interior use only.") : null,
    input.complexity === "complex" && input.hardwareCount < 4 ? warn("hardwareCount", "Complex project with few hardware pieces: verify assembly and fasteners.") : null,
    input.paintedCabinets && input.finishType === "none" ? warn("finishType", "Painted cabinets with no finish selected: verify scope.") : null,
  );

  const boardFeet     = (input.lengthIn * input.widthIn * input.thicknessIn * input.quantity) / 144;
  const surfaceSqFt   = (input.lengthIn * input.widthIn * input.quantity) / 144;
  const waste         = input.complexity === "complex" ? 0.18 : input.complexity === "medium" ? 0.12 : 0.08;
  const adjBoardFeet  = boardFeet * (1 + waste);
  const matUnits      = Math.max(1, Math.ceil(adjBoardFeet / 2));
  const matPrice      = priceOf(input.prices, "lumber-framing", MATERIAL_PRICE[input.material]);
  const hardwarePacks = Math.max(1, Math.ceil(input.hardwareCount / 4));
  const softCloseKits = input.softClose ? Math.max(1, Math.ceil(input.hardwareCount / 6)) : 0;

  const mats = [
    material(`${input.material} stock`, matUnits, "board-ft", matPrice, "Wood"),
    material("Hardware pack", hardwarePacks, "pack", 14.50, "Hardware"),
    ...(input.finishType !== "none" ? [material(`${input.finishType} finish`, Math.max(1, Math.ceil(surfaceSqFt / 25)), "qt", FINISH_PRICE[input.finishType] * 12, "Finish")] : []),
    ...(softCloseKits > 0 ? [material("Soft-close hinges / slides", softCloseKits, "kit", 65, "Hardware")] : []),
    ...(input.projectType === "trim" || input.projectType === "stair-trim" ? [material("Trim fasteners / adhesive", Math.max(1, Math.ceil(surfaceSqFt / 30)), "kit", 11, "Finish")] : []),
    ...(input.projectType === "repair" ? [material("Patch / filler / sanding kit", Math.max(1, Math.ceil(surfaceSqFt / 20)), "kit", 18, "Repair")] : []),
    ...(input.paintedCabinets ? [material("Cabinet primer / paint", Math.max(1, Math.ceil(surfaceSqFt / 30)), "qt", 28, "Paint")] : []),
  ];

  const labor = estimateLabor({
    baseHours: 3 + adjBoardFeet / 12 + input.quantity * 0.6 + input.hardwareCount * 0.08
      + (input.complexity === "medium" ? 2 : 0) + (input.complexity === "complex" ? 4 : 0)
      + (input.projectType === "repair" ? 1.5 : 0) + (input.projectType === "door" ? 1.25 : 0)
      + (["cabinet", "built-in"].includes(input.projectType) ? 2 : 0)
      + (input.paintedCabinets ? adjBoardFeet / 20 : 0) + (input.softClose ? 1 : 0),
    crewSize: adjBoardFeet > 180 ? 3 : 2,
    ratePerHour: LABOR_RATE[input.projectType],
    difficulty: input.complexity === "complex" || ["cabinet", "built-in", "door", "custom"].includes(input.projectType) ? "complex" : "moderate",
    notes: [`${adjBoardFeet.toFixed(1)} board-ft — ${input.material}`, `${input.quantity} pcs — ${input.projectType}`, input.finishType !== "none" ? `Finish: ${input.finishType}` : "No finish"],
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost, input.location, "labor"),
    { overhead: input.complexity === "complex" ? 0.17 : 0.14, profit: 0.20, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: input.quantity || 1 },
  );

  const risk = computeRisk([
    factor("mdf",      "MDF material",          0.14, input.material === "mdf"),
    factor("cabinet",  "Cabinet / built-in",    0.16, ["cabinet", "built-in"].includes(input.projectType)),
    factor("door",     "Door / stair trim fit", 0.14, ["door", "stair-trim"].includes(input.projectType)),
    factor("complex",  "Complex project",       0.20, input.complexity === "complex"),
    factor("painted",  "Painted cabinets",      0.12, input.paintedCabinets),
    factor("no_finish","No finish",             0.10, input.finishType === "none"),
  ], { requiresPermit: false, requiresLicense: false, requiresInspection: ["door", "cabinet"].includes(input.projectType) || input.complexity === "complex", requiresEngineering: false });

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
    { type: "photo",      description: "Finish or surface treatment",    required: input.finishType !== "none", milestone: 3 },
    { type: "inspection", description: "Final fit and client sign-off",  required: true, milestone: 4 },
  ]);

  const confidence = computeConfidenceScore({
    hasMeasurements: true, hasPhotos: false, hasConditionData: true,
    hasMaterialSelection: true, hasScopeConfirmed: true, hasUnknownConditions: false,
    extraConfirmedFields: (input.softClose ? 1 : 0) + (input.paintedCabinets ? 1 : 0) + (input.finishType !== "none" ? 1 : 0),
  });
  const readiness = computeReadinessScore({
    measurementsConfirmed: true, materialsAvailable: false, siteAccessConfirmed: true,
    permitsAddressed: true, scopeApproved: true, depositPaid: false, clientApproval: false,
  });
  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous: false, clientProvidesMaterials: false, noPhotosRequired: false,
    hasChangeOrderPolicy: true, hasEvidenceRequired: true, hasMilestones: true,
    hasHighRiskConditions: input.complexity === "complex" || input.paintedCabinets,
    priceIsFixed: true, clientExpectationMismatch: input.paintedCabinets,
  });
  const priceBands = computePriceBands(costs.total, 0.82, input.complexity === "complex" || input.material === "oak" || input.material === "maple" ? 1.40 : 1.25, {
    low:  "Pine / MDF, basic complexity, no finish",
    mid:  "Oak / plywood, medium complexity, stain or paint",
    high: input.material === "maple" || input.complexity === "complex" ? "Maple/oak, complex, soft-close, painted cabinets" : "Custom built-in, complex, premium material",
  });
  const scope = buildScope(
    [`${input.projectType} — ${input.quantity} pcs (${input.material})`, `Dimensions: ${input.lengthIn}" × ${input.widthIn}" × ${input.thicknessIn}"`, input.finishType !== "none" ? `Finish: ${input.finishType}` : "", input.softClose ? "Soft-close hardware" : "", input.paintedCabinets ? "Cabinet painting" : ""].filter(Boolean),
    [input.finishType === "none" ? "Surface finish / sealing" : "", "On-site painting touch-up beyond scope", "Countertop or hardware supply (client-provided unless noted)"].filter(Boolean),
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
    `Your ${input.projectType} in ${input.material} (${input.quantity} pcs, ${input.complexity} complexity) with ${input.finishType !== "none" ? input.finishType + " finish" : "no finish"}.${input.softClose ? " Soft-close hardware included." : ""} Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
    [`Board feet: ${adjBoardFeet.toFixed(1)} (${(waste * 100).toFixed(0)}% waste)`, `Labor rate: $${LABOR_RATE[input.projectType]}/hr`, `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`],
  );
  const algorithmTrace = buildAlgorithmTrace(ALGORITHM_VERSIONS.carpentry, "carpentry",
    ["projectType", "material", "lengthIn", "widthIn", "quantity", "complexity", "finishType"],
    [], ["Finished dimensions", "US market pricing"],
    [
      { ruleId: "COMPLEX_MULT",     label: "Complex project",      triggered: input.complexity === "complex",  reason: "18% waste + 4 extra labor hours + premium rate", points: 20 },
      { ruleId: "PAINTED_CABINETS", label: "Painted cabinets",     triggered: input.paintedCabinets,           reason: "Primer, paint, and extra labor for fine finish", points: 12 },
      { ruleId: "SOFT_CLOSE",       label: "Soft-close hardware",  triggered: input.softClose,                 reason: "Premium hardware kits + installation time", points: 0 },
      { ruleId: "OAK_MAPLE",        label: "Hardwood premium",     triggered: input.material === "oak" || input.material === "maple", reason: "Higher material cost and precision machining", points: 12 },
    ],
  );

  return {
    toolId: `carpentry-${Date.now()}`, trade: "carpentry", projectType: input.projectType,
    mode: input.mode, inputs: { ...input }, validationIssues: issues, isValid: isValid(issues),
    materials: mats, labor, costs, risk, milestones, evidenceRequired: evidence.items,
    warnings: [
      ...(input.material === "mdf" ? ["MDF: seal edges and avoid moisture exposure."] : []),
      ...(input.projectType === "door" ? ["Doors require tight tolerances and hinge alignment."] : []),
      ...(input.complexity === "complex" ? ["Complex project: expect more setup and alignment time."] : []),
      ...(input.finishType === "none" ? ["No finish: consider sealing for durability."] : []),
    ],
    recommendations: [
      "Confirm final dimensions and reveals before cutting.",
      "Check grain direction and finish compatibility.",
      ...(input.paintedCabinets ? ["Sand between coats for smooth painted cabinet finish."] : []),
    ],
    assumptions: ["Dimensions are finished dimensions.", "US market pricing."],
    createdAt: new Date().toISOString(),
    confidenceScore: confidence, readinessScore: readiness, disputeRisk, priceBands,
    safeToProceed, scope, explained, warranty, inspectionGate, algorithmTrace,
  } as SemseToolResult;
}

export const runCarpentryEngine = calculateCarpentry;
