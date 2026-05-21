import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";

export type LandscapingInput = {
  landscapeAreaSqft: number;
  sodAreaSqft: number;
  mulchYards: number;
  plantCount: number;
  irrigationLinesFt: number;
  drainageType: "none" | "swale" | "frenchDrain" | "catchBasin";
  soilType: "loam" | "clay" | "sand";
  demoExisting: boolean;
  hardscapeSqft: number;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const SOIL_PREP_COST: Record<LandscapingInput["soilType"], number> = {
  loam: 0.85,
  clay: 1.15,
  sand: 0.75,
};

const DRAINAGE_COST: Record<LandscapingInput["drainageType"], number> = {
  none: 0,
  swale: 9,
  frenchDrain: 18,
  catchBasin: 26,
};

export function calculateLandscaping(input: LandscapingInput): SemseToolResult {
  const issues = collect(
    positive("landscapeAreaSqft", input.landscapeAreaSqft, "Área"),
    range("sodAreaSqft", input.sodAreaSqft, 0, 50000, "Sod area"),
    range("mulchYards", input.mulchYards, 0, 1000, "Mulch"),
    range("plantCount", input.plantCount, 0, 5000, "Plants"),
    range("irrigationLinesFt", input.irrigationLinesFt, 0, 10000, "Irrigation"),
    range("hardscapeSqft", input.hardscapeSqft, 0, 10000, "Hardscape"),
    input.soilType === "clay"
      ? warn("soilType", "Clay soil: expect slower drainage and more prep.")
      : null,
    input.drainageType !== "none"
      ? warn("drainageType", "Drainage included: verify slope, tie-ins and discharge path.")
      : null,
    input.demoExisting
      ? warn("demoExisting", "Existing landscape demo: confirm debris removal and root issues.")
      : null,
  );

  const siteArea = Math.max(input.landscapeAreaSqft, input.sodAreaSqft, input.hardscapeSqft);
  const sodSqFt = input.sodAreaSqft > 0 ? input.sodAreaSqft : Math.round(input.landscapeAreaSqft * 0.55);
  const mulchYards = Math.max(0, input.mulchYards);
  const topSoilYards = Math.max(1, Math.ceil(input.landscapeAreaSqft / 250));
  const irrigationKits = input.irrigationLinesFt > 0 ? Math.max(1, Math.ceil(input.irrigationLinesFt / 120)) : 0;
  const drainageUnits = input.drainageType !== "none" ? Math.max(1, Math.ceil(input.landscapeAreaSqft / 180)) : 0;
  const plantBatches = input.plantCount > 0 ? Math.max(1, Math.ceil(input.plantCount / 4)) : 0;

  const mats = [
    material("Sod", sodSqFt, "sqft", 0.92, "Landscape"),
    material("Mulch", mulchYards, "yd³", 42, "Groundcover"),
    material("Topsoil / prep", topSoilYards, "yd³", 48 * SOIL_PREP_COST[input.soilType], "Prep"),
    ...(plantBatches > 0 ? [material("Plants / shrubs", input.plantCount, "ea", 18, "Planting")] : []),
    ...(irrigationKits > 0 ? [material("Irrigation supplies", irrigationKits, "kit", 65, "Irrigation")] : []),
    ...(drainageUnits > 0 ? [material("Drainage pipe / stone / fabric", drainageUnits, "kit", DRAINAGE_COST[input.drainageType], "Drainage")] : []),
    ...(input.hardscapeSqft > 0 ? [material("Hardscape materials", Math.max(1, Math.ceil(input.hardscapeSqft / 80)), "kit", 52, "Hardscape")] : []),
    ...(input.demoExisting ? [material("Landscape demo / haul-off", Math.max(1, Math.ceil(input.landscapeAreaSqft / 200)), "job", 44, "Demo")] : []),
  ];

  const labor = estimateLabor({
    baseHours:
      4 +
      input.landscapeAreaSqft / 120 +
      sodSqFt / 180 +
      mulchYards * 0.75 +
      input.plantCount * 0.22 +
      input.irrigationLinesFt / 45 +
      input.hardscapeSqft / 75 +
      (input.demoExisting ? 2.5 : 0) +
      (input.drainageType === "swale" ? 1.5 : 0) +
      (input.drainageType === "frenchDrain" ? 3 : 0) +
      (input.drainageType === "catchBasin" ? 4 : 0),
    crewSize: siteArea > 1200 ? 3 : 2,
    ratePerHour: input.drainageType === "none" && input.hardscapeSqft === 0 ? 48 : 56,
    difficulty:
      input.drainageType !== "none" || input.hardscapeSqft > 0 || input.soilType === "clay"
        ? "complex"
        : "moderate",
    notes: [
      `Área base: ${input.landscapeAreaSqft.toFixed(1)} sqft`,
      `Sod estimado: ${sodSqFt.toFixed(1)} sqft`,
      input.drainageType !== "none" ? `Drainage: ${input.drainageType}` : "Sin drenaje explícito.",
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: input.drainageType !== "none" || input.hardscapeSqft > 0 ? 0.16 : 0.14,
    profit: 0.2,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: input.landscapeAreaSqft || 1,
  });

  const risk = computeRisk(
    [
      factor("clay", "Clay soil", 0.14, input.soilType === "clay"),
      factor("drainage", "Drainage work", 0.18, input.drainageType !== "none"),
      factor("french", "French drain / basin", 0.18, input.drainageType === "frenchDrain" || input.drainageType === "catchBasin"),
      factor("irrigation", "Irrigation lines", 0.12, input.irrigationLinesFt > 0),
      factor("demo", "Existing landscape demo", 0.10, input.demoExisting),
      factor("hardscape", "Hardscape included", 0.14, input.hardscapeSqft > 0),
    ],
    {
      requiresPermit: input.drainageType !== "none" || input.hardscapeSqft > 250,
      requiresLicense: false,
      requiresInspection: true,
      requiresEngineering: input.drainageType === "catchBasin" || input.hardscapeSqft > 1000,
    }
  );

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    ["Site prep and grading", "Drainage / irrigation", "Sod / planting / mulch", "Cleanup and handoff"],
    [
      ["Photos of cleared site", "Grade / slope confirmation"],
      ["Photos of drainage / irrigation", "Tie-in verification"],
      ["Photos of sod / planting / mulch", "Coverage confirmation"],
      ["Final photos", "Client approval"],
    ]
  );

  const evidence = buildEvidenceChecklist("landscaping", risk, milestones, [
    { type: "photo", description: "Pre-work site condition", required: true, milestone: 1 },
    { type: "measurement", description: "Grade / slope check", required: input.drainageType !== "none", milestone: 1 },
    { type: "photo", description: "Drainage / irrigation install", required: input.drainageType !== "none" || input.irrigationLinesFt > 0, milestone: 2 },
    { type: "photo", description: "Sod / planting / mulch", required: true, milestone: 3 },
    { type: "inspection", description: "Final walkthrough / approval", required: true, milestone: 4 },
  ]);

  const warnings: string[] = [
    ...(input.soilType === "clay" ? ["Clay soil: drainage may need extra time and material."] : []),
    ...(input.drainageType !== "none" ? ["Drainage included: verify discharge and slope before closing the job."] : []),
    ...(input.hardscapeSqft > 0 ? ["Hardscape included: coordinate base compaction and layout."] : []),
    ...(input.demoExisting ? ["Existing landscape demo: check roots, buried lines and disposal."] : []),
  ];

  const recommendations: string[] = [
    "Confirm grade and discharge path before drainage work.",
    "Take photos before and after grading, sod and planting.",
    "Hold escrow until water flow and finish are approved.",
    ...(input.irrigationLinesFt > 0 ? ["Pressure test irrigation before final handoff."] : []),
  ];

  const evidenceRequired: EvidenceItem[] = evidence.items;

  return {
    toolId: `landscaping-${Date.now()}`,
    trade: "landscaping",
    projectType: input.drainageType !== "none" ? "landscaping-drainage" : "landscaping",
    mode: input.mode,
    inputs: { ...input },
    validationIssues: issues,
    isValid: isValid(issues),
    materials: mats,
    labor,
    costs,
    risk,
    milestones,
    evidenceRequired,
    warnings,
    recommendations,
    assumptions: [
      "Landscape pricing is approximate for the U.S. market.",
      "Irrigation, hardscape and drainage may require local permits or utility marking.",
      "Plant selections and irrigation zones are client-provided unless scoped.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runLandscapingEngine = calculateLandscaping;
