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

export type DrainageType = "none" | "swale" | "french-drain" | "catch-basin";
export type SoilType     = "loam" | "clay" | "sand" | "rocky";

export type LandscapingInput = {
  landscapeAreaSqft: number;
  sodAreaSqft: number;
  mulchYards: number;
  plantCount: number;
  irrigationLinesFt: number;
  drainageType: DrainageType;
  soilType: SoilType;
  demoExisting: boolean;
  hardscapeSqft: number;
  gradingIncluded: boolean;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const SOIL_PREP_MULT: Record<SoilType, number> = { loam: 1.0, clay: 1.20, sand: 0.90, rocky: 1.40 };
const DRAINAGE_COST:  Record<DrainageType, number> = { none: 0, swale: 9, "french-drain": 18, "catch-basin": 26 };

export function calculateLandscaping(input: LandscapingInput): SemseToolResult {
  const issues = collect(
    positive("landscapeAreaSqft", input.landscapeAreaSqft, "Area"),
    range("sodAreaSqft", input.sodAreaSqft, 0, 50000, "Sod area"),
    range("mulchYards", input.mulchYards, 0, 1000, "Mulch yards"),
    range("plantCount", input.plantCount, 0, 5000, "Plant count"),
    range("hardscapeSqft", input.hardscapeSqft, 0, 10000, "Hardscape"),
    input.soilType === "clay" ? warn("soilType", "Clay soil: slower drainage, more prep and amendment.") : null,
    input.soilType === "rocky" ? warn("soilType", "Rocky soil: post digging and irrigation harder — add contingency.") : null,
    input.drainageType !== "none" ? warn("drainageType", "Drainage included: verify slope, tie-in, and discharge path.") : null,
    !input.gradingIncluded && input.drainageType !== "none" ? warn("gradingIncluded", "Drainage without grading: verify slope before drainage install.") : null,
  );

  const sodSqFt       = input.sodAreaSqft > 0 ? input.sodAreaSqft : Math.round(input.landscapeAreaSqft * 0.55);
  const topSoilYards  = Math.max(1, Math.ceil(input.landscapeAreaSqft / 250));
  const irrigKits     = input.irrigationLinesFt > 0 ? Math.max(1, Math.ceil(input.irrigationLinesFt / 120)) : 0;
  const drainUnits    = input.drainageType !== "none" ? Math.max(1, Math.ceil(input.landscapeAreaSqft / 180)) : 0;
  const plantBatches  = input.plantCount > 0 ? Math.max(1, Math.ceil(input.plantCount / 4)) : 0;
  const soilMult      = SOIL_PREP_MULT[input.soilType];

  const mats = [
    ...(sodSqFt > 0 ? [material("Sod", sodSqFt, "sqft", 0.92, "Ground cover")] : []),
    ...(input.mulchYards > 0 ? [material("Mulch", input.mulchYards, "yd³", 42, "Ground cover")] : []),
    material("Topsoil / soil prep", topSoilYards, "yd³", 48 * soilMult, "Prep"),
    ...(plantBatches > 0 ? [material("Plants / shrubs", input.plantCount, "ea", 18, "Planting")] : []),
    ...(irrigKits > 0 ? [material("Irrigation supplies", irrigKits, "kit", 65, "Irrigation")] : []),
    ...(drainUnits > 0 ? [material("Drainage pipe / stone / fabric", drainUnits, "kit", DRAINAGE_COST[input.drainageType], "Drainage")] : []),
    ...(input.hardscapeSqft > 0 ? [material("Hardscape materials", Math.max(1, Math.ceil(input.hardscapeSqft / 80)), "kit", 52, "Hardscape")] : []),
    ...(input.demoExisting ? [material("Landscape demo / haul-off", Math.max(1, Math.ceil(input.landscapeAreaSqft / 200)), "job", 44, "Demo")] : []),
    ...(input.gradingIncluded ? [material("Grading / laser level", Math.max(1, Math.ceil(input.landscapeAreaSqft / 500)), "job", 120, "Grading")] : []),
  ];

  const labor = estimateLabor({
    baseHours: 4 + input.landscapeAreaSqft / 120 + sodSqFt / 180
      + input.mulchYards * 0.75 + input.plantCount * 0.22
      + input.irrigationLinesFt / 45 + input.hardscapeSqft / 75
      + (input.demoExisting ? 2.5 : 0)
      + (input.drainageType === "french-drain" ? 3 : input.drainageType === "catch-basin" ? 4 : input.drainageType === "swale" ? 1.5 : 0)
      + (input.gradingIncluded ? 2 : 0) + (input.soilType === "rocky" ? 2 : 0),
    crewSize: input.landscapeAreaSqft > 1200 ? 3 : 2,
    ratePerHour: input.drainageType === "none" && input.hardscapeSqft === 0 ? 48 : 56,
    difficulty: input.drainageType !== "none" || input.hardscapeSqft > 0 || input.soilType === "clay" || input.soilType === "rocky" ? "complex" : "moderate",
    notes: [`${input.landscapeAreaSqft} sqft — soil: ${input.soilType}`, `Drainage: ${input.drainageType}`, `Hardscape: ${input.hardscapeSqft} sqft`],
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost, input.location, "labor"),
    { overhead: input.drainageType !== "none" || input.hardscapeSqft > 0 ? 0.16 : 0.14, profit: 0.20, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: input.landscapeAreaSqft || 1 },
  );

  const risk = computeRisk([
    factor("clay",        "Clay soil",           0.14, input.soilType === "clay"),
    factor("rocky",       "Rocky soil",          0.16, input.soilType === "rocky"),
    factor("drainage",    "Drainage work",       0.18, input.drainageType !== "none"),
    factor("irrigation",  "Irrigation lines",    0.12, input.irrigationLinesFt > 0),
    factor("hardscape",   "Hardscape included",  0.14, input.hardscapeSqft > 0),
    factor("demo",        "Existing landscape",  0.10, input.demoExisting),
  ], { requiresPermit: input.drainageType !== "none" || input.hardscapeSqft > 250, requiresLicense: false, requiresInspection: true, requiresEngineering: input.drainageType === "catch-basin" || input.hardscapeSqft > 1000 });

  const milestones = buildMilestones(costs.total, risk.level,
    ["Site prep and grading", "Drainage / irrigation", "Sod / planting / mulch", "Cleanup and handoff"],
    [
      ["Photos of cleared site", "Grade / slope confirmed"],
      ["Photos of drainage / irrigation", "Tie-in verification"],
      ["Photos of sod / planting / mulch", "Coverage confirmed"],
      ["Final photos", "Client approval"],
    ]
  );
  const evidence = buildEvidenceChecklist("landscaping", risk, milestones, [
    { type: "photo",       description: "Pre-work site condition",              required: true, milestone: 1 },
    { type: "measurement", description: "Grade / slope check",                 required: input.drainageType !== "none" || input.gradingIncluded, milestone: 1 },
    { type: "photo",       description: "Drainage / irrigation install",       required: input.drainageType !== "none" || input.irrigationLinesFt > 0, milestone: 2 },
    { type: "photo",       description: "Sod / planting / mulch coverage",    required: true, milestone: 3 },
    { type: "inspection",  description: "Final walkthrough",                   required: true, milestone: 4 },
  ]);

  const confidence = computeConfidenceScore({
    hasMeasurements: true, hasPhotos: false, hasConditionData: input.gradingIncluded,
    hasMaterialSelection: true, hasScopeConfirmed: true,
    hasUnknownConditions: input.soilType === "rocky" && !input.gradingIncluded,
    extraConfirmedFields: (input.irrigationLinesFt > 0 ? 1 : 0) + (input.drainageType !== "none" ? 1 : 0),
  });
  const readiness = computeReadinessScore({
    measurementsConfirmed: true, materialsAvailable: false, siteAccessConfirmed: true,
    permitsAddressed: input.drainageType === "none" && input.hardscapeSqft <= 250,
    scopeApproved: true, depositPaid: false, clientApproval: false,
  });
  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous: false, clientProvidesMaterials: false, noPhotosRequired: false,
    hasChangeOrderPolicy: true, hasEvidenceRequired: true, hasMilestones: true,
    hasHighRiskConditions: input.drainageType !== "none" || input.soilType === "rocky",
    priceIsFixed: true, clientExpectationMismatch: input.soilType === "rocky",
  });
  const priceBands = computePriceBands(costs.total, 0.82, input.drainageType === "catch-basin" || input.hardscapeSqft > 500 ? 1.42 : input.drainageType !== "none" ? 1.30 : 1.20, {
    low:  "Sod, mulch, plants — flat loam, no drainage or hardscape",
    mid:  "Sod + irrigation + swale or french drain",
    high: input.drainageType === "catch-basin" ? "Full drainage + hardscape + rocky soil + grading" : "French drain + hardscape + irrigation + rocky soil",
  });
  const scope = buildScope(
    [
      sodSqFt > 0 ? `Sod (${sodSqFt} sqft)` : "", input.mulchYards > 0 ? `Mulch (${input.mulchYards} yd³)` : "",
      input.plantCount > 0 ? `${input.plantCount} plants / shrubs` : "", input.irrigationLinesFt > 0 ? `Irrigation (${input.irrigationLinesFt} lf)` : "",
      input.drainageType !== "none" ? `Drainage: ${input.drainageType}` : "", input.hardscapeSqft > 0 ? `Hardscape (${input.hardscapeSqft} sqft)` : "",
      input.gradingIncluded ? "Site grading" : "", input.demoExisting ? "Existing landscape demo" : "",
    ].filter(Boolean),
    [!input.gradingIncluded ? "Site grading / regrading" : "", "Tree removal or stump grinding", "Irrigation backflow preventer (if not included)", "Landscape lighting"].filter(Boolean),
    ["Adequate grade / slope for drainage", "Utility lines marked (call 811)", "US market pricing"],
    ["Hidden rocks or roots requiring extra excavation", "Drainage discharge path blocked or illegal"],
  );
  const warranty = buildWarranty(365, "1-year labor warranty. Plant warranty per contractor policy (typically 90 days).", ["Drought damage", "Client-caused damage", "Pest infestation"]);
  const inspectionGate = buildInspectionGate(
    "After grading / drainage — before sod or planting",
    ["Grade / slope measurement", "Drainage tie-in photos"],
    "Inadequate slope or blocked discharge requiring regrading",
    "Verify grade before covering with sod or mulch.",
  );
  const safeToProceed = computeSafeToProceed({
    hasMinimalData: isValid(issues), readinessScore: readiness.score, hasCriticalBlockers: false,
    hasMilestones: true, hasEvidencePlan: true, confidenceScore: confidence.score, noCriticalBlockers: true, scopeIsComplete: true,
  });
  const explained = buildExplainedOutput(
    `Your landscaping project covers ${input.landscapeAreaSqft} sqft with ${sodSqFt} sqft sod, ${input.mulchYards} yd³ mulch, and ${input.plantCount} plants.${input.drainageType !== "none" ? ` Drainage: ${input.drainageType}.` : ""} Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
    [`Soil: ${input.soilType} (×${soilMult.toFixed(2)} prep mult)`, `Drainage: ${input.drainageType}`, `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`],
  );
  const algorithmTrace = buildAlgorithmTrace(ALGORITHM_VERSIONS.landscaping, "landscaping",
    ["landscapeAreaSqft", "sodAreaSqft", "drainageType", "soilType", "irrigationLinesFt"],
    [], ["Grade adequate for drainage", "Utilities marked"],
    [
      { ruleId: "ROCKY_SOIL",   label: "Rocky soil surcharge",     triggered: input.soilType === "rocky",          reason: "40% labor/material increase for rocky conditions", points: 16 },
      { ruleId: "DRAINAGE",     label: "Drainage complexity",      triggered: input.drainageType !== "none",        reason: "Engineering, slope, and discharge verification required", points: 18 },
      { ruleId: "HARDSCAPE",    label: "Hardscape included",       triggered: input.hardscapeSqft > 0,              reason: "Base compaction, layout, and permits for hardscape", points: 14 },
    ],
  );


  const productionSchedule = buildProductionSchedule([
    { name: 'Site demo and clearing', daysMin: 1, daysMax: 2, crew: 2, description: 'Remove existing vegetation, debris, and haul-off' },
    { name: 'Grading and drainage', daysMin: 1, daysMax: 3, crew: 2, description: 'Grade to plan, install drainage pipe and structures' },
    { name: 'Irrigation installation', daysMin: 1, daysMax: 2, crew: 2, description: 'Lay irrigation lines, heads, and controller wiring' },
    { name: 'Sod and planting', daysMin: 1, daysMax: 3, crew: 3, description: 'Install sod, plant trees/shrubs, backfill and water in' },
    { name: 'Mulch and hardscape', daysMin: 1, daysMax: 2, crew: 2, description: 'Apply mulch, set edging, install hardscape elements' },
    { name: 'Final watering and walkthrough', daysMin: 0, daysMax: 1, crew: 2, description: 'Run irrigation test, adjust heads, final cleanup' },
  ]);

  const hiddenDamage = assessHiddenDamageProbability(undefined, false, false, false, true, false);

  const scheduleRisk = assessScheduleRisk({
    dependsOnOtherTrades: false,
    clientMustDecide: input.plantCount > 10,
    materialsOnSite: false,
    weatherDependent: true,
    scopeIsLarge: input.landscapeAreaSqft > 1500,
    hasComplexDetails: input.drainageType !== 'none' || input.hardscapeSqft > 200,
  });

  const upsells = [
      { service: 'Landscape lighting package', reason: 'Low-voltage LED lighting installs during planting before mulch covers wiring.' },
      { service: 'Smart irrigation controller', reason: 'Wi-Fi controller saves 30% water vs manual timer — $200 upgrade.' },
      { service: 'Annual maintenance plan', reason: 'Lock in recurring revenue — maintenance contract while relationship is fresh.' }
  ];

  const roi = {
    investmentAmount:    costs.total,
    estimatedValueAdded: Math.round(costs.total * 1.05),
    roiPercent:          5,
    notes:               'Professional landscaping returns 100%+ in curb appeal and property value.',
  };
  return {
    toolId: `landscaping-${Date.now()}`, trade: "landscaping",
    projectType: input.drainageType !== "none" ? "landscaping-drainage" : "landscaping",
    mode: input.mode, inputs: { ...input }, validationIssues: issues, isValid: isValid(issues),
    materials: mats, labor, costs, risk, milestones, evidenceRequired: evidence.items,
    warnings: [
      ...(input.soilType === "clay" ? ["Clay soil: drainage slow — add soil amendment for healthy plant growth."] : []),
      ...(input.soilType === "rocky" ? ["Rocky soil: irrigation and drainage harder — add contingency."] : []),
      ...(input.drainageType !== "none" ? ["Drainage: verify discharge path and slope before covering."] : []),
      ...(input.hardscapeSqft > 0 ? ["Hardscape: coordinate base compaction and layout."] : []),
    ],
    recommendations: [
      "Call 811 (utility locate) before any excavation or irrigation work.",
      "Confirm grade and drainage path before sod or planting.",
      ...(input.irrigationLinesFt > 0 ? ["Pressure-test irrigation before final handoff."] : []),
    ],
    assumptions: ["Utilities marked before digging.", "Adequate grade for drainage.", "US market pricing."],
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

export const runLandscapingEngine = calculateLandscaping;
