import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
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

export type MasonryUnitType = "block-8" | "brick" | "stone-veneer" | "cmu-12" | "concrete-block";

export type MasonryInput = {
  wallLengthFt: number;
  wallHeightFt: number;
  unitType: MasonryUnitType;
  wastePercent: number;
  exteriorWork: boolean;
  reinforced: boolean;
  groutFill: boolean;
  waterproofCoating: boolean;
  footingIncluded: boolean;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const UNIT_PER_SQFT: Record<MasonryUnitType, number> = {
  "block-8": 1.125, brick: 7.0, "stone-veneer": 1.0, "cmu-12": 0.75, "concrete-block": 1.125,
};
const UNIT_COST: Record<MasonryUnitType, number> = {
  "block-8": 2.20, brick: 0.75, "stone-veneer": 8.50, "cmu-12": 3.40, "concrete-block": 2.20,
};
const MORTAR_BAGS_PER_100_SQFT: Record<MasonryUnitType, number> = {
  "block-8": 1.35, brick: 0.85, "stone-veneer": 1.10, "cmu-12": 1.50, "concrete-block": 1.35,
};

export function calculateMasonry(input: MasonryInput): SemseToolResult {
  const issues = collect(
    positive("wallLengthFt", input.wallLengthFt, "Wall length"),
    positive("wallHeightFt", input.wallHeightFt, "Wall height"),
    range("wastePercent", input.wastePercent, 0, 0.35, "Waste %"),
    input.wallHeightFt > 6 && !input.reinforced ? warn("reinforced", "Wall > 6 ft without reinforcement: verify footing and structural review.") : null,
    input.exteriorWork && !input.waterproofCoating ? warn("waterproofCoating", "Exterior masonry without waterproof coating: moisture infiltration risk.") : null,
    input.wallHeightFt > 10 ? warn("wallHeightFt", "Wall > 10 ft: engineering review and scaffolding required.") : null,
  );

  const wallAreaSqFt = input.wallLengthFt * input.wallHeightFt;
  const adjustedArea = wallAreaSqFt * (1 + input.wastePercent);
  const unitsNeeded = Math.max(1, Math.ceil(adjustedArea * UNIT_PER_SQFT[input.unitType]));
  const unitCost    = priceOf(input.prices, `${input.unitType}-unit`, UNIT_COST[input.unitType]);
  const mortarBags  = Math.max(1, Math.ceil((adjustedArea / 100) * MORTAR_BAGS_PER_100_SQFT[input.unitType]));
  const rebarBundles = input.reinforced ? Math.max(1, Math.ceil(wallAreaSqFt / 120)) : 0;
  const groutBags    = input.groutFill ? Math.max(1, Math.ceil(wallAreaSqFt / 50)) : 0;
  const scaffoldKits = input.wallHeightFt > 8 || input.exteriorWork ? Math.max(1, Math.ceil(wallAreaSqFt / 160)) : 0;

  const mats = [
    material(`${input.unitType} units`, unitsNeeded, "unit", unitCost, "Units"),
    material("Mortar bags", mortarBags, "bag", priceOf(input.prices, "mortar-bag", 14), "Mortar"),
    ...(rebarBundles > 0 ? [material("Rebar / reinforcement", rebarBundles, "bundle", priceOf(input.prices, "steel-rebar", 18), "Reinforcement")] : []),
    ...(groutBags > 0 ? [material("Core grout fill", groutBags, "bag", 16, "Grout")] : []),
    ...(scaffoldKits > 0 ? [material("Scaffold / access", scaffoldKits, "kit", 42, "Access")] : []),
    ...(input.waterproofCoating ? [material("Waterproof / masonry sealer", Math.max(1, Math.ceil(wallAreaSqFt / 220)), "gal", 38, "Protection")] : []),
    ...(input.footingIncluded ? [material("Footing concrete / forming", Math.max(1, Math.ceil(input.wallLengthFt / 8)), "kit", 85, "Footing")] : []),
    material("Layout / tie wire / supplies", Math.max(1, Math.ceil(wallAreaSqFt / 300)), "kit", 16, "Layout"),
  ];

  const labor = estimateLabor({
    baseHours: 5 + wallAreaSqFt / 35 + (input.unitType === "brick" ? 1.5 : 0)
      + (input.unitType === "stone-veneer" ? 2.25 : 0)
      + (input.reinforced ? 1.75 : 0) + (input.groutFill ? 1 : 0)
      + (input.exteriorWork ? 1.5 : 0) + (input.footingIncluded ? 3 : 0),
    crewSize: wallAreaSqFt > 600 ? 3 : 2,
    ratePerHour: 66,
    difficulty: input.wallHeightFt > 8 || input.unitType === "brick" || input.unitType === "stone-veneer" ? "complex" : "moderate",
    notes: [`${wallAreaSqFt.toFixed(0)} sqft — ${input.unitType}`, input.reinforced ? "Reinforced" : "Unreinforced", input.exteriorWork ? "Exterior" : "Interior"],
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost, input.location, "labor"),
    { overhead: input.exteriorWork || input.wallHeightFt > 8 ? 0.16 : 0.14, profit: 0.20, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: wallAreaSqFt || 1 },
  );

  const risk = computeRisk([
    factor("height",        "Wall > 6 ft",        0.18, input.wallHeightFt > 6),
    factor("exterior",      "Exterior work",       0.16, input.exteriorWork),
    factor("brick",         "Brick work",          0.12, input.unitType === "brick"),
    factor("stone_veneer",  "Stone veneer",        0.15, input.unitType === "stone-veneer"),
    factor("no_waterproof", "No waterproof coat",  0.12, input.exteriorWork && !input.waterproofCoating),
    factor("large",         "Large wall (500+ sqft)", 0.10, wallAreaSqFt > 500),
  ], { requiresPermit: input.exteriorWork || input.wallHeightFt > 8, requiresLicense: input.wallHeightFt > 8 || input.unitType === "stone-veneer", requiresInspection: true, requiresEngineering: input.wallHeightFt > 10 || (!input.reinforced && input.exteriorWork) });

  const milestones = buildMilestones(costs.total, risk.level,
    ["Layout and footing", "Unit install", "Mortar and reinforcement", "Sealing and handoff"],
    [
      ["Photos of layout and footing", "Wall dimensions confirmed"],
      ["Photos of units installed", "Plumb / level check"],
      ["Photos of reinforcement and mortar", "Cleanup confirmation"],
      ["Photos of sealing / pointing", "Client approval"],
    ]
  );
  const evidence = buildEvidenceChecklist("masonry", risk, milestones, [
    { type: "photo",       description: "Footing / base condition",             required: true, milestone: 1 },
    { type: "measurement", description: "Plumb, level, and alignment",         required: true, milestone: 2 },
    { type: "photo",       description: "Reinforcement and mortar joints",     required: input.reinforced, milestone: 3 },
    { type: "inspection",  description: "Exterior weatherproofing / sealing",  required: input.exteriorWork, milestone: 4 },
  ]);

  const confidence = computeConfidenceScore({
    hasMeasurements: true, hasPhotos: false, hasConditionData: input.footingIncluded,
    hasMaterialSelection: true, hasScopeConfirmed: true, hasUnknownConditions: !input.footingIncluded && input.wallHeightFt > 6,
    extraConfirmedFields: (input.reinforced ? 1 : 0) + (input.groutFill ? 1 : 0) + (input.waterproofCoating ? 1 : 0),
  });
  const readiness = computeReadinessScore({
    measurementsConfirmed: true, materialsAvailable: false, siteAccessConfirmed: true,
    permitsAddressed: !(input.exteriorWork || input.wallHeightFt > 8),
    scopeApproved: true, depositPaid: false, clientApproval: false,
  });
  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous: !input.footingIncluded && input.wallHeightFt > 6, clientProvidesMaterials: false,
    noPhotosRequired: false, hasChangeOrderPolicy: true, hasEvidenceRequired: true,
    hasMilestones: true, hasHighRiskConditions: input.wallHeightFt > 6 || (input.exteriorWork && !input.waterproofCoating),
    priceIsFixed: true, clientExpectationMismatch: false,
  });
  const priceBands = computePriceBands(costs.total, 0.82, input.unitType === "stone-veneer" || input.wallHeightFt > 8 ? 1.40 : 1.25, {
    low:  "CMU/block, flat ground, interior, no reinforcement",
    mid:  "Block or brick, standard height, exterior with waterproofing",
    high: input.unitType === "stone-veneer" ? "Stone veneer, tall wall, exterior, reinforced, footing" : "Brick, tall wall, scaffold, reinforced, exterior",
  });
  const scope = buildScope(
    [`${input.unitType} wall (${wallAreaSqFt.toFixed(0)} sqft)`, input.reinforced ? "Rebar reinforcement" : "", input.groutFill ? "Core grout fill" : "", input.exteriorWork ? "Exterior installation" : "", input.waterproofCoating ? "Waterproof coating / sealer" : "", input.footingIncluded ? "Footing (included)" : ""].filter(Boolean),
    [!input.footingIncluded ? "Footing (assumed existing)" : "", "Architectural detailing beyond standard pointing", "Efflorescence or stain treatment"].filter(Boolean),
    [!input.footingIncluded ? "Footing exists and is adequate" : "New footing included", "US market pricing"],
    ["Footing inadequate or missing", "Hidden moisture in existing substrate"],
  );
  const warranty = buildWarranty(365, "1-year labor warranty on masonry work. Mortar joint pointing standard.", ["Structural movement", "Freeze-thaw cracking beyond normal limits"]);
  const inspectionGate = buildInspectionGate(
    "After footing and first course — before full build",
    ["Footing photo", "First course level / plumb"],
    "Footing inadequate or alignment off requiring correction",
    "Verify footing level, first course plumb, and layout before full installation.",
  );
  const safeToProceed = computeSafeToProceed({
    hasMinimalData: isValid(issues), readinessScore: readiness.score, hasCriticalBlockers: false,
    hasMilestones: true, hasEvidencePlan: true, confidenceScore: confidence.score, noCriticalBlockers: true, scopeIsComplete: true,
  });
  const explained = buildExplainedOutput(
    `Your ${input.unitType} masonry wall is ${input.wallLengthFt} lf × ${input.wallHeightFt} ft (${wallAreaSqFt.toFixed(0)} sqft).${input.reinforced ? " Reinforced." : ""}${input.exteriorWork ? " Exterior." : ""} Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
    [`Units: ${unitsNeeded} + mortar: ${mortarBags} bags`, `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`],
  );
  const algorithmTrace = buildAlgorithmTrace(ALGORITHM_VERSIONS.masonry, "masonry",
    ["wallLengthFt", "wallHeightFt", "unitType", "reinforced", "exteriorWork"],
    !input.footingIncluded ? ["footing condition"] : [], ["Footing adequate", "US market pricing"],
    [
      { ruleId: "STONE_VENEER",   label: "Stone veneer premium", triggered: input.unitType === "stone-veneer", reason: "Precision anchoring, substrate, waterproofing", points: 15 },
      { ruleId: "TALL_WALL",      label: "Tall wall (>6 ft)",    triggered: input.wallHeightFt > 6,            reason: "Reinforcement, scaffold, engineering review", points: 18 },
      { ruleId: "EXTERIOR_RISK",  label: "Exterior moisture",    triggered: input.exteriorWork && !input.waterproofCoating, reason: "No waterproof coating — infiltration risk", points: 12 },
    ],
  );


  const productionSchedule = buildProductionSchedule([
    { name: 'Footing and layout', daysMin: 1, daysMax: 2, crew: 2, description: 'Excavate or verify footing, set layout lines' },
    { name: 'First course and level set', daysMin: 1, daysMax: 1, crew: 2, description: 'Set critical first course, verify plumb and level' },
    { name: 'Full wall installation', daysMin: 2, daysMax: 5, crew: 3, description: 'Build wall in lifts, install rebar/grout if reinforced' },
    { name: 'Pointing and sealing', daysMin: 1, daysMax: 2, crew: 2, description: 'Tool mortar joints, apply waterproof coating or sealer' },
    { name: 'Cleanup and final check', daysMin: 0, daysMax: 1, crew: 2, description: 'Remove debris, check plumb/level, wash wall face' },
  ]);

  const hiddenDamage = assessHiddenDamageProbability(undefined, true, false, false, true, false);

  const scheduleRisk = assessScheduleRisk({
    dependsOnOtherTrades: false,
    clientMustDecide: false,
    materialsOnSite: false,
    weatherDependent: true,
    scopeIsLarge: input.wallLengthFt * input.wallHeightFt > 500,
    hasComplexDetails: input.wallHeightFt > 8 || ['brick','stone-veneer'].includes(input.unitType),
  });

  const upsells = [
      { service: 'Exterior waterproof coating', reason: 'Applied after pointing — prevents efflorescence and moisture infiltration.' },
      { service: 'Decorative coping or cap', reason: 'Protects wall top and adds visual finish — easiest to add during build.' },
      { service: 'Mortar color selection', reason: 'Pigmented mortar coordinates with brick/stone color — add at mixing stage.' }
  ];

  const roi = {
    investmentAmount:    costs.total,
    estimatedValueAdded: Math.round(costs.total * 0.65),
    roiPercent:          -35,
    notes:               'Masonry walls return 60-70% in curb appeal and structural permanence value.',
  };
  return {
    toolId: `masonry-${Date.now()}`, trade: "masonry", projectType: input.exteriorWork ? "exterior-masonry" : "interior-masonry",
    mode: input.mode, inputs: { ...input }, validationIssues: issues, isValid: isValid(issues),
    materials: mats, labor, costs, risk, milestones, evidenceRequired: evidence.items,
    warnings: [
      ...(input.wallHeightFt > 6 && !input.reinforced ? ["Wall > 6 ft without reinforcement: verify footing and structural review."] : []),
      ...(input.exteriorWork && !input.waterproofCoating ? ["⚠ Exterior masonry without waterproof coating: moisture infiltration risk."] : []),
      ...(input.unitType === "stone-veneer" ? ["Stone veneer: verify substrate, moisture barrier, and anchor system."] : []),
    ],
    recommendations: [
      "Confirm footing, plumb, and wall layout before material install.",
      "Capture reinforcement and mortar joint photos before finish coat.",
      ...(input.exteriorWork ? ["Apply waterproof sealer within 7 days of final pointing."] : []),
    ],
    assumptions: [!input.footingIncluded ? "Existing footing is adequate." : "New footing included in scope.", "US market pricing."],
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

export const runMasonryEngine = calculateMasonry;
