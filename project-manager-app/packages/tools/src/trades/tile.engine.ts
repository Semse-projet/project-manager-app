import { collect, isValid, positive, warn } from "../core/validation-engine.js";
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

export type TileInput = {
  lengthFt: number;
  widthFt: number;
  tileSizeIn: number;
  pattern: "straight" | "diagonal" | "herringbone" | "offset";
  areaType: "floor" | "wall" | "backsplash" | "shower";
  waterproofing: boolean;
  demoExisting: boolean;
  substratePrep: "none" | "minor" | "major";
  groutType: "standard" | "sanded" | "epoxy";
  niche: boolean;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const WASTE_BY_PATTERN = { straight: 0.10, diagonal: 0.14, herringbone: 0.20, offset: 0.11 };
const TILE_COST_PER_SQFT: Record<number, number> = { 4: 1.8, 6: 2.4, 8: 3.0, 12: 4.2, 16: 5.6, 24: 8.5, 36: 11.0 };
const GROUT_COST = { standard: 24, sanded: 28, epoxy: 48 };

function tileCostPerSqFt(size: number): number {
  const keys = Object.keys(TILE_COST_PER_SQFT).map(Number).sort((a, b) => a - b);
  for (let i = keys.length - 1; i >= 0; i--) {
    if (size >= (keys[i] ?? 12)) return TILE_COST_PER_SQFT[keys[i] ?? 12] ?? 4.2;
  }
  return 4.2;
}

export function calculateTile(input: TileInput): SemseToolResult {
  const issues = collect(
    positive("lengthFt", input.lengthFt, "Length"),
    positive("widthFt", input.widthFt, "Width"),
    positive("tileSizeIn", input.tileSizeIn, "Tile size"),
    input.pattern === "herringbone" ? warn("pattern", "Herringbone: higher waste and more cuts.") : null,
    input.areaType === "shower" && !input.waterproofing ? warn("waterproofing", "Shower without waterproofing: high leak risk.") : null,
    input.areaType === "shower" && input.substratePrep === "none" ? warn("substratePrep", "Shower requires substrate prep before tiling.") : null,
  );

  const areaSqFt = input.lengthFt * input.widthFt;
  const wasteFactor = WASTE_BY_PATTERN[input.pattern] + (input.demoExisting ? 0.03 : 0) + (input.areaType === "shower" ? 0.05 : 0);
  const adjustedArea = areaSqFt * (1 + wasteFactor);
  const tilesPerSqFt = (12 * 12) / (input.tileSizeIn * input.tileSizeIn);
  const tileCount = Math.max(1, Math.ceil(adjustedArea * tilesPerSqFt));
  const thinsetBags   = Math.max(1, Math.ceil(adjustedArea / 50));
  const groutBuckets  = Math.max(1, Math.ceil(adjustedArea / 75));
  const spacers       = Math.max(1, Math.ceil(tileCount / 100));
  const membraneRolls = input.waterproofing ? Math.max(1, Math.ceil(adjustedArea / 75)) : 0;
  const prepKits      = input.substratePrep === "major" ? Math.ceil(areaSqFt / 100) : input.substratePrep === "minor" ? Math.ceil(areaSqFt / 180) : 0;

  const mats = [
    material(`${input.tileSizeIn}" tile`, tileCount, "pcs", tileCostPerSqFt(input.tileSizeIn), "Finish"),
    material("Thinset mortar", thinsetBags, "bag", 22, "Install"),
    material(`${input.groutType} grout`, groutBuckets, "bucket", GROUT_COST[input.groutType], "Finish"),
    material("Tile spacers / leveling clips", spacers, "pack", 14, "Install"),
    ...(input.waterproofing ? [material("Waterproofing membrane", membraneRolls, "roll", 42, "Protection")] : []),
    ...(prepKits > 0 ? [material("Substrate prep materials", Math.max(1, prepKits), "kit", 34, "Prep")] : []),
    ...(input.demoExisting ? [material("Demo / disposal", Math.max(1, Math.ceil(areaSqFt / 120)), "job", 48, "Demo")] : []),
    ...(input.niche ? [material("Niche frame / materials", 1, "kit", 85, "Niche")] : []),
  ];

  const labor = estimateLabor({
    baseHours: 4 + adjustedArea / 90 + (input.pattern === "diagonal" ? 2 : 0)
      + (input.pattern === "herringbone" ? 4 : 0) + (input.areaType === "wall" ? 1.5 : 0)
      + (input.areaType === "shower" ? 4.5 : 0) + (input.waterproofing ? 2 : 0)
      + (input.demoExisting ? 2.5 : 0) + (input.substratePrep === "minor" ? 1.5 : 0)
      + (input.substratePrep === "major" ? 4 : 0) + (input.niche ? 2 : 0),
    crewSize: adjustedArea > 300 ? 3 : 2,
    ratePerHour: input.areaType === "shower" || input.pattern === "herringbone" ? 64 : 56,
    difficulty: input.areaType === "shower" || input.pattern === "herringbone" || input.substratePrep === "major" ? "complex" : "moderate",
    notes: [`${areaSqFt.toFixed(0)} sqft — ${adjustedArea.toFixed(0)} adjusted`, `${input.tileSizeIn}" ${input.pattern} — ${input.areaType}`],
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost, input.location, "labor"),
    { overhead: input.areaType === "shower" || input.pattern === "herringbone" ? 0.17 : 0.14, profit: 0.20, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: areaSqFt || 1 },
  );

  const risk = computeRisk([
    factor("shower",      "Shower area",         0.24, input.areaType === "shower"),
    factor("waterproof",  "Waterproofing",        0.22, input.waterproofing),
    factor("herringbone", "Herringbone",          0.18, input.pattern === "herringbone"),
    factor("demo",        "Demo existing tile",   0.14, input.demoExisting),
    factor("major_prep",  "Major substrate prep", 0.18, input.substratePrep === "major"),
  ], { requiresPermit: input.areaType === "shower", requiresLicense: false, requiresInspection: input.areaType === "shower" || input.waterproofing, requiresEngineering: false });

  const milestones = buildMilestones(costs.total, risk.level,
    ["Measure and prep", "Set tile", "Grout and seal", "Cleanup and handoff"],
    [
      ["Photos of measurement and substrate"], ["Photos of tile set", "Spacing check"],
      ["Photos of grout / waterproofing"], ["Final photos", "Client approval"],
    ]
  );
  const evidence = buildEvidenceChecklist("tile", risk, milestones, [
    { type: "photo",      description: "Pre-install area and substrate",             required: true, milestone: 1 },
    { type: "photo",      description: "Waterproofing layer before covering",        required: input.waterproofing || input.areaType === "shower", milestone: 2 },
    { type: "photo",      description: "Tile setting progress",                      required: true, milestone: 2 },
    { type: "inspection", description: "Final inspection / approval",                required: true, milestone: 4 },
  ]);

  const confidence = computeConfidenceScore({
    hasMeasurements: true, hasPhotos: false, hasConditionData: input.substratePrep !== "none",
    hasMaterialSelection: true, hasScopeConfirmed: !(input.areaType === "shower" && input.substratePrep === "none"),
    hasUnknownConditions: input.areaType === "shower" && input.substratePrep === "none",
    extraConfirmedFields: (input.waterproofing ? 1 : 0) + (input.niche ? 1 : 0),
  });
  const readiness = computeReadinessScore({
    measurementsConfirmed: true, materialsAvailable: false, siteAccessConfirmed: true,
    permitsAddressed: input.areaType !== "shower", scopeApproved: true, depositPaid: false, clientApproval: false,
  });
  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous: input.areaType === "shower" && input.substratePrep === "none",
    clientProvidesMaterials: false, noPhotosRequired: false, hasChangeOrderPolicy: true,
    hasEvidenceRequired: true, hasMilestones: true, hasHighRiskConditions: input.areaType === "shower",
    priceIsFixed: true, clientExpectationMismatch: input.pattern === "herringbone",
  });
  const priceBands = computePriceBands(costs.total, 0.82, input.areaType === "shower" ? 1.40 : 1.25, {
    low:  "Small tile, straight, no demo, no waterproofing",
    mid:  "Standard size, offset, minor substrate prep",
    high: input.areaType === "shower" ? "Full shower + waterproofing + epoxy grout + niche" : "Herringbone + major prep + epoxy grout",
  });
  const scope = buildScope(
    [`${input.tileSizeIn}" ${input.areaType} tile (${areaSqFt.toFixed(0)} sqft)`, `${input.pattern} pattern`, input.waterproofing ? "Waterproofing membrane" : "", input.demoExisting ? "Demo and disposal" : "", input.niche ? "Niche installation" : "", `${input.groutType} grout`, "Thinset and spacers"].filter(Boolean),
    ["Subfloor structural replacement", "Grout sealing after cure (if not included)", !input.waterproofing && input.areaType === "shower" ? "⚠ Waterproofing (recommended)" : ""].filter(Boolean),
    ["Subfloor / substrate sound", "US market pricing"],
    ["Substrate damage found during demo", "Shower leak requiring membrane replacement"],
  );
  const warranty = buildWarranty(365, "1-year labor warranty. Grout and tile subject to normal wear.", ["Client-caused impact cracks", "Structural movement"]);
  const inspectionGate = buildInspectionGate(
    input.areaType === "shower" ? "After waterproofing — before tile" : "After substrate prep — before tile",
    ["Waterproofing photos", "Flood test if applicable"],
    "Waterproofing failure or substrate damage requiring repair",
    input.areaType === "shower" ? "Flood test shower pan before tiling. Document waterproofing height." : "Verify substrate flatness and moisture.",
  );
  const safeToProceed = computeSafeToProceed({
    hasMinimalData: isValid(issues), readinessScore: readiness.score,
    hasCriticalBlockers: input.areaType === "shower" && !input.waterproofing,
    hasMilestones: true, hasEvidencePlan: true, confidenceScore: confidence.score,
    noCriticalBlockers: !(input.areaType === "shower" && !input.waterproofing), scopeIsComplete: true,
  });
  const explained = buildExplainedOutput(
    `Your ${input.areaType} tile job covers ${areaSqFt.toFixed(0)} sqft in ${input.pattern} pattern with ${input.tileSizeIn}" tile and ${input.groutType} grout.${input.waterproofing ? " Waterproofing included." : ""} Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
    [`Waste: ${(wasteFactor * 100).toFixed(0)}% — ordered ${tileCount} tiles`, `Substrate prep: ${input.substratePrep}`, `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`],
  );
  const algorithmTrace = buildAlgorithmTrace(ALGORITHM_VERSIONS.tile, "tile",
    ["lengthFt", "widthFt", "tileSizeIn", "pattern", "areaType", "waterproofing", "substratePrep"],
    [], ["Substrate sound", "US market pricing"],
    [
      { ruleId: "SHOWER_PREMIUM",    label: "Shower area premium",    triggered: input.areaType === "shower",        reason: "Waterproofing, niche, precise cuts, longer labor", points: 24 },
      { ruleId: "HERRINGBONE_WASTE", label: "Herringbone waste",      triggered: input.pattern === "herringbone",    reason: "20% waste vs 10% straight", points: 18 },
      { ruleId: "MAJOR_PREP",        label: "Major substrate prep",   triggered: input.substratePrep === "major",    reason: "Leveling and patching add significant labor and material", points: 18 },
      { ruleId: "EPOXY_GROUT",       label: "Epoxy grout premium",    triggered: input.groutType === "epoxy",        reason: "Epoxy grout 2× cost of standard", points: 0 },
    ],
  );


  const productionSchedule = buildProductionSchedule([
    { name: 'Site prep and layout', daysMin: 0, daysMax: 1, crew: 2, description: 'Protect surrounding surfaces, mark tile layout, dry-fit pattern' },
    { name: 'Substrate and waterproofing', daysMin: 1, daysMax: 2, crew: 2, description: 'Prep substrate, install waterproofing membrane where required' },
    { name: 'Tile setting', daysMin: 2, daysMax: 4, crew: 2, description: 'Set tile with thinset, maintain pattern and spacing' },
    { name: 'Grout and sealing', daysMin: 1, daysMax: 2, crew: 2, description: 'Apply grout, clean haze, seal grout joints' },
    { name: 'Final cleanup and inspection', daysMin: 0, daysMax: 1, crew: 2, description: 'Remove spacers, clean tile, verify alignment' },
  ]);

  const hiddenDamage = assessHiddenDamageProbability(undefined, false, false, false, true, false);

  const scheduleRisk = assessScheduleRisk({
    dependsOnOtherTrades: true,
    clientMustDecide: input.groutType === 'epoxy',
    materialsOnSite: false,
    weatherDependent: false,
    scopeIsLarge: input.lengthFt * input.widthFt > 300,
    hasComplexDetails: input.pattern === 'herringbone' || input.areaType === 'shower',
  });

  const upsells = [
      { service: 'Epoxy grout upgrade', reason: 'Epoxy grout resists staining and never needs sealing — worth it on shower floors.' },
      { service: 'Decorative accent tiles', reason: 'A 6" accent band adds visual interest for ~5% extra material cost.' },
      { service: 'Heated floor mat (under tile)', reason: 'Ideal time to rough-in radiant heat before setting tile.' }
  ];

  const roi = {
    investmentAmount:    costs.total,
    estimatedValueAdded: Math.round(costs.total * 0.65),
    roiPercent:          -35,
    notes:               'Tile work adds 60-70% of installation cost in home value, highest in bathrooms and kitchens.',
  };
  return {
    toolId: `tile-${Date.now()}`, trade: "tile", projectType: input.areaType,
    mode: input.mode, inputs: { ...input }, validationIssues: issues, isValid: isValid(issues),
    materials: mats, labor, costs, risk, milestones, evidenceRequired: evidence.items,
    warnings: [
      ...(input.areaType === "shower" && !input.waterproofing ? ["⚠ Shower without waterproofing — not recommended."] : []),
      ...(input.pattern === "herringbone" ? ["Herringbone: 20% waste and longer layout time."] : []),
      ...(input.demoExisting ? ["Demo existing tile: confirm substrate damage before starting."] : []),
    ],
    recommendations: [
      "Confirm tile layout, grout color and edge trims before install.",
      ...(input.areaType === "shower" ? ["Flood test shower pan before tiling.", "Hold escrow until waterproofing is documented."] : []),
      "Check substrate flatness and moisture before setting tile.",
    ],
    assumptions: ["US market pricing.", "Substrate structurally sound."],
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

export const runTileEngine = calculateTile;
