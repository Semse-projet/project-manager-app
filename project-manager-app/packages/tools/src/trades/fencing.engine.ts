import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal, priceOf } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";

export type FencingInput = {
  fenceLengthFt: number;
  fenceHeightFt: number;
  materialType: "wood" | "vinyl" | "chainLink" | "metal";
  postSpacingFt: number;
  gateCount: number;
  demoExisting: boolean;
  stainSeal: boolean;
  terrainType: "flat" | "sloped" | "rocky";
  mode: ToolMode;
  prices?: MaterialPriceMap;
};

const FENCE_PANEL_COST: Record<FencingInput["materialType"], number> = {
  wood: 32,
  vinyl: 48,
  chainLink: 24,
  metal: 52,
};

const POST_COST: Record<FencingInput["materialType"], number> = {
  wood: 16,
  vinyl: 18,
  chainLink: 14,
  metal: 20,
};

export function calculateFencing(input: FencingInput): SemseToolResult {
  const issues = collect(
    positive("fenceLengthFt", input.fenceLengthFt, "Largo"),
    positive("fenceHeightFt", input.fenceHeightFt, "Altura"),
    range("postSpacingFt", input.postSpacingFt, 4, 12, "Espaciado de postes"),
    range("gateCount", input.gateCount, 0, 10, "Puertas"),
    input.fenceHeightFt > 6
      ? warn("fenceHeightFt", "Cerca alta: revisar código local, refuerzo y estabilidad.")
      : null,
    input.demoExisting
      ? warn("demoExisting", "Demo de cerca existente: verificar límites, postes y retiro de escombro.")
      : null,
    input.terrainType === "sloped"
      ? warn("terrainType", "Terreno inclinado: prever nivelación, escalonamiento y más tiempo.")
      : null,
  );

  const fenceAreaSqFt = input.fenceLengthFt * input.fenceHeightFt;
  const panelCount = Math.max(1, Math.ceil(input.fenceLengthFt / input.postSpacingFt));
  const postCount = Math.max(2, panelCount + 1);
  const concreteBags = Math.max(2, Math.ceil(postCount * 1.5));
  const gateKits = input.gateCount > 0 ? Math.max(1, input.gateCount) : 0;
  const sealKits = input.stainSeal && input.materialType === "wood" ? Math.max(1, Math.ceil(fenceAreaSqFt / 120)) : 0;

  const panelCost = input.materialType === "wood"
    ? priceOf(input.prices, "lumber-framing", FENCE_PANEL_COST[input.materialType])
    : FENCE_PANEL_COST[input.materialType];
  const postCost = input.materialType === "wood"
    ? priceOf(input.prices, "lumber-framing", POST_COST[input.materialType])
    : POST_COST[input.materialType];
  const mats = [
    material(`${input.materialType} fence panels`, panelCount, "panel", panelCost, "Fence"),
    material("Posts", postCount, "post", postCost, "Support"),
    material("Concrete bags", concreteBags, "bag", 7.5, "Foundation"),
    material("Fasteners / brackets", Math.max(1, Math.ceil(fenceAreaSqFt / 120)), "kit", 18, "Hardware"),
    ...(gateKits > 0 ? [material("Gate kit", gateKits, "kit", 110, "Access")] : []),
    ...(input.demoExisting ? [material("Fence demo / haul-off", Math.max(1, Math.ceil(fenceAreaSqFt / 200)), "job", 42, "Demo")] : []),
    ...(sealKits > 0 ? [material("Stain / sealant", sealKits, "gal", 34, "Finish")] : []),
    ...(input.terrainType === "rocky" ? [material("Auger / digging extras", Math.max(1, Math.ceil(input.fenceLengthFt / 40)), "kit", 24, "Access")] : []),
  ];

  const labor = estimateLabor({
    baseHours:
      4 +
      fenceAreaSqFt / 30 +
      input.gateCount * 1.5 +
      (input.demoExisting ? 2.5 : 0) +
      (input.terrainType === "sloped" ? 2 : 0) +
      (input.terrainType === "rocky" ? 3 : 0) +
      (input.materialType === "vinyl" ? 1 : 0) +
      (input.materialType === "metal" ? 1.5 : 0),
    crewSize: fenceAreaSqFt > 300 ? 3 : 2,
    ratePerHour: input.materialType === "metal" || input.materialType === "vinyl" ? 62 : 54,
    difficulty:
      input.terrainType !== "flat" || input.materialType === "metal" || input.gateCount > 1 || input.fenceHeightFt > 6
        ? "complex"
        : "moderate",
    notes: [
      `Largo: ${input.fenceLengthFt.toFixed(1)} ft`,
      `Área aproximada: ${fenceAreaSqFt.toFixed(1)} sqft`,
      input.demoExisting ? "Incluye demo de cerca existente." : "Sin demo de cerca existente.",
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: input.terrainType !== "flat" ? 0.16 : 0.14,
    profit: 0.2,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: fenceAreaSqFt || 1,
  });

  const risk = computeRisk(
    [
      factor("tall", "Fence height over 6 ft", 0.16, input.fenceHeightFt > 6),
      factor("demo", "Existing fence demo", 0.12, input.demoExisting),
      factor("gate", "Gate work", 0.10, input.gateCount > 0),
      factor("slope", "Sloped terrain", 0.16, input.terrainType === "sloped"),
      factor("rocky", "Rocky terrain", 0.18, input.terrainType === "rocky"),
      factor("metal", "Metal fence", 0.10, input.materialType === "metal"),
    ],
    {
      requiresPermit: input.fenceHeightFt > 6 || input.fenceLengthFt > 100,
      requiresLicense: input.fenceHeightFt > 8 || input.materialType === "metal",
      requiresInspection: true,
      requiresEngineering: input.fenceHeightFt > 8 || input.terrainType === "rocky",
    }
  );

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    ["Layout and posts", "Panels and rails", "Gates / finish", "Cleanup and handoff"],
    [
      ["Photos of property line and layout", "Post hole confirmation"],
      ["Photos of panels / rails", "Line and plumb check"],
      ["Photos of gates and finish", "Hardware verification"],
      ["Final photos", "Client approval"],
    ]
  );

  const evidence = buildEvidenceChecklist("fencing", risk, milestones, [
    { type: "photo", description: "Layout and property line markers", required: true, milestone: 1 },
    { type: "measurement", description: "Post spacing / plumb check", required: true, milestone: 1 },
    { type: "photo", description: "Panels / rails installed", required: true, milestone: 2 },
    { type: "photo", description: "Gate / latch details", required: input.gateCount > 0, milestone: 3 },
    { type: "inspection", description: "Final walk-through and approval", required: true, milestone: 4 },
  ]);

  const warnings: string[] = [
    ...(input.fenceHeightFt > 6 ? ["Fence height above 6 ft: verify code and stability."] : []),
    ...(input.demoExisting ? ["Existing fence demo: confirm utility lines and boundaries."] : []),
    ...(input.terrainType === "sloped" ? ["Sloped terrain: budget extra labor for step-downs."] : []),
    ...(input.terrainType === "rocky" ? ["Rocky terrain: expect slower post setting and more equipment."] : []),
  ];

  const recommendations: string[] = [
    "Confirm property line and layout before digging.",
    "Capture photos of posts, panels and gates before closeout.",
    "Hold escrow until final alignment and hardware are approved.",
    ...(input.materialType === "wood" && input.stainSeal ? ["Seal wood fence after proper dry time."] : []),
  ];

  const evidenceRequired: EvidenceItem[] = evidence.items;

  return {
    toolId: `fencing-${Date.now()}`,
    trade: "fencing",
    projectType: input.demoExisting ? "fence-remodel" : "new-fence",
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
      "Fencing pricing is approximate for the U.S. market.",
      "Property line verification is the client's responsibility unless scoped.",
      "Permit requirements vary by locality and fence height.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runFencingEngine = calculateFencing;
