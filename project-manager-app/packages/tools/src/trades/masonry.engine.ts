import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { applyLocation, buildCostSummary, material, materialTotal, priceOf } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";

export type MasonryInput = {
  wallLengthFt: number;
  wallHeightFt: number;
  unitType: "block8" | "brick" | "stoneVeneer";
  wastePercent: number;
  unitCost: number;
  mortarBagCost: number;
  laborRatePerSqft: number;
  reinforced: boolean;
  exteriorWork: boolean;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const UNIT_PER_SQFT: Record<MasonryInput["unitType"], number> = {
  block8: 1.125,
  brick: 7,
  stoneVeneer: 1,
};

const MORTAR_BAGS_PER_100_SQFT: Record<MasonryInput["unitType"], number> = {
  block8: 1.35,
  brick: 0.85,
  stoneVeneer: 1.1,
};

export function calculateMasonry(input: MasonryInput): SemseToolResult {
  const issues = collect(
    positive("wallLengthFt", input.wallLengthFt, "Largo del muro"),
    positive("wallHeightFt", input.wallHeightFt, "Altura del muro"),
    positive("unitCost", input.unitCost, "Costo por unidad"),
    positive("mortarBagCost", input.mortarBagCost, "Costo de mortero"),
    positive("laborRatePerSqft", input.laborRatePerSqft, "Labor por ft²"),
    range("wastePercent", input.wastePercent, 0, 0.35, "Desperdicio"),
    input.wallHeightFt > 6 && !input.reinforced
      ? warn("reinforced", "Muro alto sin refuerzo: validar footing, rebar y revisión técnica.")
      : null,
    input.exteriorWork && input.unitType === "stoneVeneer"
      ? warn("unitType", "Stone veneer exterior: revisar anclaje, waterproofing y detalle de terminación.")
      : null,
  );

  const wallAreaSqFt = input.wallLengthFt * input.wallHeightFt;
  const adjustedArea = wallAreaSqFt * (1 + input.wastePercent);
  const unitsNeeded = Math.max(1, Math.ceil(adjustedArea * UNIT_PER_SQFT[input.unitType]));
  const mortarBags = Math.max(1, Math.ceil((adjustedArea / 100) * MORTAR_BAGS_PER_100_SQFT[input.unitType]));
  const rebarBundles = input.reinforced ? Math.max(1, Math.ceil(wallAreaSqFt / 120)) : 0;
  const scaffoldKits = input.exteriorWork || input.wallHeightFt > 8 ? Math.max(1, Math.ceil(wallAreaSqFt / 160)) : 0;

  const mats = [
    material(`${input.unitType} masonry units`, unitsNeeded, "unit", input.unitCost, "Units"),
    material("Mortar bags", mortarBags, "bag", input.mortarBagCost, "Mortar"),
    ...(rebarBundles > 0 ? [material("Rebar / reinforcement", rebarBundles, "bundle", priceOf(input.prices, "steel-rebar", 18), "Reinforcement")] : []),
    ...(scaffoldKits > 0 ? [material("Scaffold / access kit", scaffoldKits, "kit", 42, "Access")] : []),
    material("Leveling / string / marking supplies", Math.max(1, Math.ceil(wallAreaSqFt / 300)), "kit", 16, "Layout"),
    ...(input.exteriorWork ? [material("Exterior sealant / water barrier", Math.max(1, Math.ceil(wallAreaSqFt / 220)), "tube", 12, "Weatherproofing")] : []),
  ];

  const labor = estimateLabor({
    baseHours:
      5 +
      (wallAreaSqFt / 35) +
      (input.unitType === "brick" ? 1.5 : 0) +
      (input.unitType === "stoneVeneer" ? 2.25 : 0) +
      (input.reinforced ? 1.75 : 0) +
      (input.exteriorWork ? 1.5 : 0),
    crewSize: wallAreaSqFt > 600 ? 3 : 2,
    ratePerHour: Math.max(18, input.laborRatePerSqft * 8),
    difficulty:
      input.wallHeightFt > 8 || input.unitType === "brick" || input.unitType === "stoneVeneer"
        ? "complex"
        : "moderate",
    notes: [
      `Área base: ${wallAreaSqFt.toFixed(1)} sqft`,
      `Área ajustada: ${adjustedArea.toFixed(1)} sqft`,
      input.reinforced ? "Incluye refuerzo." : "Sin refuerzo explícito.",
    ],
  });

  const costs = buildCostSummary(applyLocation(materialTotal(mats), input.location, "material"), applyLocation(labor.totalCost, input.location, "labor"), {
    overhead: input.exteriorWork ? 0.16 : 0.14,
    profit: 0.2,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: wallAreaSqFt || 1,
  });

  const risk = computeRisk(
    [
      factor("height", "Wall height above 6 ft", 0.18, input.wallHeightFt > 6),
      factor("reinforced", "Reinforcement", 0.1, input.reinforced),
      factor("exterior", "Exterior work", 0.16, input.exteriorWork),
      factor("brick", "Brick work", 0.12, input.unitType === "brick"),
      factor("stone", "Stone veneer", 0.15, input.unitType === "stoneVeneer"),
      factor("large_wall", "Large wall", 0.1, wallAreaSqFt > 500),
    ],
    {
      requiresPermit: input.exteriorWork || input.wallHeightFt > 8,
      requiresLicense: input.wallHeightFt > 8 || input.unitType === "stoneVeneer",
      requiresInspection: true,
      requiresEngineering: input.wallHeightFt > 10 || (!input.reinforced && input.exteriorWork),
    }
  );

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    ["Layout and footing prep", "Unit install", "Mortar, reinforcement and cleanup", "Final pointing and handoff"],
    [
      ["Photos of layout and footing", "Verification of wall dimensions"],
      ["Photos of units installed", "Plumb / level check"],
      ["Photos of reinforcement and mortar", "Debris cleanup confirmation"],
      ["Final photos", "Client approval"],
    ]
  );

  const evidence = buildEvidenceChecklist("masonry", risk, milestones, [
    { type: "photo", description: "Footing / base condition", required: true, milestone: 1 },
    { type: "measurement", description: "Plumb, level and alignment check", required: true, milestone: 2 },
    { type: "photo", description: "Reinforcement and mortar joints", required: input.reinforced, milestone: 3 },
    { type: "inspection", description: "Exterior weatherproofing / sealing", required: input.exteriorWork, milestone: 3 },
    { type: "inspection", description: "Final closeout and approval", required: true, milestone: 4 },
  ]);

  const warnings: string[] = [
    ...(input.wallHeightFt > 6 ? ["Wall height above 6 ft: verify footing and stability before build."] : []),
    ...(input.reinforced ? [] : ["No reinforcement flagged: review structural need before release."]),
    ...(input.exteriorWork ? ["Exterior work: protect from weather and confirm seal details."] : []),
    ...(input.unitType === "stoneVeneer" ? ["Stone veneer: check substrate, moisture barrier and anchoring."] : []),
  ];

  const recommendations: string[] = [
    "Confirm footing, plumb and wall layout before material install.",
    "Capture photos of reinforcement and mortar before final closeout.",
    "Hold escrow until exterior seal or structural checks are verified.",
    ...(input.wallHeightFt > 8 ? ["Bring a second set of hands for taller walls."] : []),
  ];

  const evidenceRequired: EvidenceItem[] = evidence.items;

  return {
    toolId: `masonry-${Date.now()}`,
    trade: "masonry",
    projectType: input.exteriorWork ? "exterior-masonry" : "interior-masonry",
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
      "Masonry pricing is approximate for the U.S. market.",
      "Structural engineering is not included unless explicitly scoped.",
      "Unit coverage depends on joints, cuts and finish profile.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runMasonryEngine = calculateMasonry;
