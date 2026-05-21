import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";

export type TileInput = {
  lengthFt: number;
  widthFt: number;
  tileSizeIn: number;
  pattern: "straight" | "diagonal" | "herringbone";
  areaType: "floor" | "wall" | "backsplash" | "shower";
  waterproofing: boolean;
  demoExisting: boolean;
  substratePrep: "none" | "minor" | "major";
  groutType: "standard" | "sanded" | "epoxy";
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const WASTE_BY_PATTERN: Record<TileInput["pattern"], number> = {
  straight: 0.10,
  diagonal: 0.14,
  herringbone: 0.20,
};

const TILE_UNIT_COST: Record<number, number> = {
  4: 1.8,
  6: 2.4,
  8: 3.0,
  12: 4.2,
  16: 5.6,
  24: 8.5,
};

const GROUT_COST: Record<TileInput["groutType"], number> = {
  standard: 24,
  sanded: 28,
  epoxy: 48,
};

export function calculateTile(input: TileInput): SemseToolResult {
  const issues = collect(
    positive("lengthFt", input.lengthFt, "Largo"),
    positive("widthFt", input.widthFt, "Ancho"),
    positive("tileSizeIn", input.tileSizeIn, "Tamaño de tile"),
    warn("pattern", input.pattern === "herringbone" ? "Patrón herringbone: mayor desperdicio y más cortes." : "Patrón válido."),
    input.areaType === "shower" && !input.waterproofing
      ? warn("waterproofing", "Shower sin waterproofing: riesgo de filtración alto.")
      : null,
    input.areaType === "shower" && input.substratePrep === "none"
      ? warn("substratePrep", "Shower requiere preparación del substrate antes de instalar.")
      : null,
    input.areaType === "backsplash" && input.tileSizeIn > 12
      ? warn("tileSizeIn", "Backsplash con tile grande: revisar cortes y alineación.")
      : null,
  );

  const areaSqFt = input.lengthFt * input.widthFt;
  const wasteFactor = WASTE_BY_PATTERN[input.pattern] + (input.demoExisting ? 0.03 : 0) + (input.areaType === "shower" ? 0.05 : 0);
  const adjustedArea = areaSqFt * (1 + wasteFactor);
  const tilesPerSqFt = (12 * 12) / (input.tileSizeIn * input.tileSizeIn);
  const tileCount = Math.max(1, Math.ceil(adjustedArea * tilesPerSqFt));
  const thinsetBags = Math.max(1, Math.ceil(adjustedArea / 50));
  const groutBuckets = Math.max(1, Math.ceil(adjustedArea / 75));
  const spacers = Math.max(1, Math.ceil(tileCount / 100));
  const membraneRolls = input.waterproofing ? Math.max(1, Math.ceil(adjustedArea / 75)) : 0;
  const prepKitCount = input.substratePrep === "major" ? Math.max(2, Math.ceil(areaSqFt / 100)) : input.substratePrep === "minor" ? Math.max(1, Math.ceil(areaSqFt / 180)) : 0;
  const demoKitCount = input.demoExisting ? Math.max(1, Math.ceil(areaSqFt / 120)) : 0;

  const mats = [
    material(`${input.tileSizeIn}" tile`, tileCount, "pcs", TILE_UNIT_COST[input.tileSizeIn] ?? 4.2, "Finish"),
    material("Thinset mortar", thinsetBags, "bag", 22, "Install"),
    material(`${input.groutType} grout`, groutBuckets, "bucket", GROUT_COST[input.groutType], "Finish"),
    material("Tile spacers / leveling clips", spacers, "pack", 14, "Install"),
    ...(input.waterproofing ? [material("Waterproofing membrane", membraneRolls, "roll", 42, "Protection")] : []),
    ...(prepKitCount > 0 ? [material("Substrate prep materials", prepKitCount, "kit", 34, "Prep")] : []),
    ...(input.demoExisting ? [material("Demo / disposal", demoKitCount, "job", 48, "Demolition")] : []),
  ];

  const labor = estimateLabor({
    baseHours:
      4 +
      adjustedArea / 90 +
      (input.pattern === "diagonal" ? 2 : 0) +
      (input.pattern === "herringbone" ? 4 : 0) +
      (input.areaType === "wall" ? 1.5 : 0) +
      (input.areaType === "backsplash" ? 1.25 : 0) +
      (input.areaType === "shower" ? 3.5 : 0) +
      (input.waterproofing ? 2 : 0) +
      (input.demoExisting ? 2.5 : 0) +
      (input.substratePrep === "minor" ? 1.5 : 0) +
      (input.substratePrep === "major" ? 4 : 0),
    crewSize: adjustedArea > 300 ? 3 : 2,
    ratePerHour: input.areaType === "shower" || input.pattern === "herringbone" ? 64 : 56,
    difficulty:
      input.areaType === "shower" || input.pattern === "herringbone" || input.substratePrep === "major"
        ? "complex"
        : "moderate",
    notes: [
      `Área base: ${areaSqFt.toFixed(1)} sqft`,
      `Área ajustada con desperdicio: ${adjustedArea.toFixed(1)} sqft`,
      input.waterproofing ? "Incluye waterproofing." : "Sin waterproofing.",
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: input.areaType === "shower" || input.pattern === "herringbone" ? 0.17 : 0.14,
    profit: 0.2,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: areaSqFt || 1,
  });

  const risk = computeRisk(
    [
      factor("shower", "Shower area", 0.24, input.areaType === "shower"),
      factor("backsplash", "Backsplash", 0.08, input.areaType === "backsplash"),
      factor("waterproofing", "Waterproofing", 0.22, input.waterproofing),
      factor("herringbone", "Herringbone", 0.18, input.pattern === "herringbone"),
      factor("demo", "Demo existing tile", 0.14, input.demoExisting),
      factor("major_prep", "Major substrate prep", 0.18, input.substratePrep === "major"),
    ],
    {
      requiresPermit: input.areaType === "shower",
      requiresLicense: false,
      requiresInspection: input.areaType === "shower" || input.waterproofing,
      requiresEngineering: false,
    }
  );

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    ["Measure and prep", "Set tile", "Grout and seal", "Cleanup and handoff"],
    [
      ["Photos of measurement", "Pattern confirmation"],
      ["Photos of tile set", "Spacing check"],
      ["Photos of grout / waterproofing", "Sealant check"],
      ["Final photos", "Client approval"],
    ]
  );

  const evidence = buildEvidenceChecklist("tile", risk, milestones, [
    { type: "photo", description: "Pre-install area and substrate", required: true, milestone: 1 },
    { type: "photo", description: "Waterproofing layer before cover", required: input.waterproofing || input.areaType === "shower", milestone: 2 },
    { type: "photo", description: "Tile setting progress", required: true, milestone: 2 },
    { type: "inspection", description: "Final inspection / approval", required: true, milestone: 4 },
  ]);

  const warnings: string[] = [
    ...(input.areaType === "shower" && !input.waterproofing ? ["Shower tile without waterproofing is not recommended."] : []),
    ...(input.pattern === "herringbone" ? ["Herringbone pattern increases waste and labor."] : []),
    ...(input.demoExisting ? ["Demo existing tile: confirm substrate damage before starting."] : []),
    ...(input.substratePrep === "major" ? ["Major prep: expect leveling, patching and more cure time."] : []),
  ];

  const recommendations: string[] = [
    "Confirm tile layout, grout color and edge trims before install.",
    "Capture waterproofing evidence before covering shower walls.",
    "Check substrate flatness and moisture before setting tile.",
    ...(input.areaType === "shower" ? ["Hold escrow release until shower waterproofing is documented."] : []),
  ];

  const evidenceRequired: EvidenceItem[] = evidence.items;

  return {
    toolId: `tile-${Date.now()}`,
    trade: "tile",
    projectType: input.areaType,
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
      "Prices are approximate for the 2026 U.S. market.",
      "Tile size and box coverage are treated as provided client values.",
      "No structural waterproofing reconstruction included.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runTileEngine = calculateTile;
