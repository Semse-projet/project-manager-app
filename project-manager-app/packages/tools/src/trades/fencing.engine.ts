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

export type FenceMaterial = "wood" | "vinyl" | "chain-link" | "metal" | "aluminum" | "composite";

export type FencingInput = {
  fenceLengthFt: number;
  fenceHeightFt: number;
  materialType: FenceMaterial;
  postSpacingFt: number;
  gateCount: number;
  demoExisting: boolean;
  stainSeal: boolean;
  terrainType: "flat" | "sloped" | "rocky";
  propertyLineVerified: boolean;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const PANEL_COST: Record<FenceMaterial, number> = {
  wood: 32, vinyl: 48, "chain-link": 24, metal: 52, aluminum: 58, composite: 44,
};
const POST_COST: Record<FenceMaterial, number> = {
  wood: 16, vinyl: 18, "chain-link": 14, metal: 20, aluminum: 22, composite: 18,
};

export function calculateFencing(input: FencingInput): SemseToolResult {
  const issues = collect(
    positive("fenceLengthFt", input.fenceLengthFt, "Fence length"),
    positive("fenceHeightFt", input.fenceHeightFt, "Fence height"),
    range("postSpacingFt", input.postSpacingFt, 4, 12, "Post spacing"),
    range("gateCount", input.gateCount, 0, 10, "Gate count"),
    input.fenceHeightFt > 6 ? warn("fenceHeightFt", "Height > 6 ft: check local code and required permits.") : null,
    !input.propertyLineVerified ? warn("propertyLineVerified", "Property line not verified: risk of encroachment dispute.") : null,
    input.terrainType === "sloped" ? warn("terrainType", "Sloped terrain: step-down layout adds labor and material.") : null,
    input.terrainType === "rocky" ? warn("terrainType", "Rocky terrain: post setting slower, may require power auger or jackhammer.") : null,
  );

  const fenceAreaSqFt = input.fenceLengthFt * input.fenceHeightFt;
  const panelCount    = Math.max(1, Math.ceil(input.fenceLengthFt / input.postSpacingFt));
  const postCount     = panelCount + 1;
  const concreteBags  = Math.max(2, Math.ceil(postCount * 1.5));
  const sealKits      = input.stainSeal && input.materialType === "wood" ? Math.max(1, Math.ceil(fenceAreaSqFt / 120)) : 0;

  const panelCost = input.materialType === "wood" ? priceOf(input.prices, "lumber-framing", PANEL_COST[input.materialType]) : PANEL_COST[input.materialType];
  const postCost  = input.materialType === "wood" ? priceOf(input.prices, "lumber-framing", POST_COST[input.materialType])  : POST_COST[input.materialType];

  const mats = [
    material(`${input.materialType} fence panels`, panelCount, "panel", panelCost, "Fence"),
    material("Posts", postCount, "post", postCost, "Support"),
    material("Concrete bags", concreteBags, "bag", 7.50, "Foundation"),
    material("Fasteners / brackets / rails", Math.max(1, Math.ceil(fenceAreaSqFt / 120)), "kit", 18, "Hardware"),
    ...(input.gateCount > 0 ? [material("Gate kit", input.gateCount, "kit", 110, "Access")] : []),
    ...(input.demoExisting ? [material("Fence demo / haul-off", Math.max(1, Math.ceil(fenceAreaSqFt / 200)), "job", 42, "Demo")] : []),
    ...(sealKits > 0 ? [material("Stain / sealant", sealKits, "gal", 34, "Finish")] : []),
    ...(input.terrainType === "rocky" ? [material("Auger / digging extras", Math.max(1, Math.ceil(input.fenceLengthFt / 40)), "kit", 24, "Access")] : []),
  ];

  const labor = estimateLabor({
    baseHours: 4 + fenceAreaSqFt / 30 + input.gateCount * 1.5
      + (input.demoExisting ? 2.5 : 0) + (input.terrainType === "sloped" ? 2 : 0)
      + (input.terrainType === "rocky" ? 3.5 : 0)
      + (["metal", "aluminum"].includes(input.materialType) ? 1.5 : 0),
    crewSize: fenceAreaSqFt > 300 ? 3 : 2,
    ratePerHour: ["metal", "aluminum"].includes(input.materialType) ? 62 : 54,
    difficulty: input.terrainType !== "flat" || ["metal", "aluminum"].includes(input.materialType) || input.fenceHeightFt > 6 ? "complex" : "moderate",
    notes: [`${input.fenceLengthFt} lf — ${input.fenceHeightFt} ft height — ${input.materialType}`, input.terrainType !== "flat" ? `Terrain: ${input.terrainType}` : "Flat terrain"],
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost, input.location, "labor"),
    { overhead: input.terrainType !== "flat" ? 0.16 : 0.14, profit: 0.20, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: fenceAreaSqFt || 1 },
  );

  const risk = computeRisk([
    factor("tall",       "Height > 6 ft",      0.16, input.fenceHeightFt > 6),
    factor("demo",       "Existing fence demo", 0.12, input.demoExisting),
    factor("gates",      "Gate installation",  0.10, input.gateCount > 0),
    factor("sloped",     "Sloped terrain",      0.16, input.terrainType === "sloped"),
    factor("rocky",      "Rocky terrain",       0.18, input.terrainType === "rocky"),
    factor("no_line",    "Property line unverified", 0.14, !input.propertyLineVerified),
  ], { requiresPermit: input.fenceHeightFt > 6 || input.fenceLengthFt > 100, requiresLicense: input.fenceHeightFt > 8, requiresInspection: true, requiresEngineering: input.fenceHeightFt > 8 || input.terrainType === "rocky" });

  const milestones = buildMilestones(costs.total, risk.level,
    ["Layout and posts", "Panels and rails", "Gates / finish", "Cleanup and handoff"],
    [
      ["Photos of property line and layout", "Post hole confirmation"],
      ["Photos of panels / rails", "Level and plumb check"],
      ["Photos of gates and finish", "Hardware verification"],
      ["Final photos", "Client approval"],
    ]
  );
  const evidence = buildEvidenceChecklist("fencing", risk, milestones, [
    { type: "photo",       description: "Property line markers and layout",   required: true, milestone: 1 },
    { type: "measurement", description: "Post spacing / plumb verification",  required: true, milestone: 1 },
    { type: "photo",       description: "Panels / rails installed",           required: true, milestone: 2 },
    { type: "photo",       description: "Gate / latch detail",                required: input.gateCount > 0, milestone: 3 },
    { type: "inspection",  description: "Final walkthrough",                  required: true, milestone: 4 },
  ]);

  const confidence = computeConfidenceScore({
    hasMeasurements: true, hasPhotos: false, hasConditionData: input.propertyLineVerified,
    hasMaterialSelection: true, hasScopeConfirmed: input.propertyLineVerified,
    hasUnknownConditions: !input.propertyLineVerified,
    extraConfirmedFields: (input.gateCount > 0 ? 1 : 0) + (input.stainSeal ? 1 : 0),
  });
  const readiness = computeReadinessScore({
    measurementsConfirmed: input.propertyLineVerified, materialsAvailable: false, siteAccessConfirmed: true,
    permitsAddressed: input.fenceHeightFt <= 6 && input.fenceLengthFt <= 100,
    scopeApproved: input.propertyLineVerified, depositPaid: false, clientApproval: false,
  });
  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous: !input.propertyLineVerified, clientProvidesMaterials: false,
    noPhotosRequired: false, hasChangeOrderPolicy: true, hasEvidenceRequired: true,
    hasMilestones: true, hasHighRiskConditions: !input.propertyLineVerified || input.terrainType === "rocky",
    priceIsFixed: true, clientExpectationMismatch: !input.propertyLineVerified,
  });
  const priceBands = computePriceBands(costs.total, 0.82, input.terrainType === "rocky" || input.materialType === "aluminum" ? 1.40 : 1.25, {
    low:  "Wood, flat terrain, no gates, no demo",
    mid:  "Vinyl or chain-link, flat, single gate",
    high: input.terrainType === "rocky" ? "Metal, rocky terrain, multiple gates, demo" : "Metal/aluminum, sloped, multiple gates, demo",
  });
  const scope = buildScope(
    [`${input.materialType} fence (${input.fenceLengthFt} lf × ${input.fenceHeightFt} ft)`, input.gateCount > 0 ? `${input.gateCount} gate(s)` : "", input.demoExisting ? "Existing fence demo" : "", input.stainSeal && input.materialType === "wood" ? "Stain / sealant" : ""].filter(Boolean),
    ["Property line survey", "Utility marking (call 811 before digging)", !input.stainSeal && input.materialType === "wood" ? "Stain / sealant" : ""].filter(Boolean),
    ["Property line verified by client", "Utilities marked before post digging"],
    ["Buried utility or obstruction found during post digging", "Property line dispute requiring re-layout"],
  );
  const warranty = buildWarranty(365, "1-year labor warranty. Wood fence subject to weathering.", ["Normal wood weathering", "Storm damage", "Client-caused impact"]);
  const inspectionGate = buildInspectionGate(
    "After post setting — before panel install",
    ["Post plumb / spacing photos", "Concrete set confirmation"],
    "Posts out of plumb or spacing incorrect requiring correction",
    "Verify all posts are plumb, spaced, and concrete has cured before panel install.",
  );
  const safeToProceed = computeSafeToProceed({
    hasMinimalData: isValid(issues), readinessScore: readiness.score,
    hasCriticalBlockers: !input.propertyLineVerified, hasMilestones: true, hasEvidencePlan: true,
    confidenceScore: confidence.score, noCriticalBlockers: input.propertyLineVerified, scopeIsComplete: input.propertyLineVerified,
  });
  const explained = buildExplainedOutput(
    `Your ${input.materialType} fence is ${input.fenceLengthFt} lf at ${input.fenceHeightFt} ft height.${input.gateCount > 0 ? ` ${input.gateCount} gate(s) included.` : ""}${input.terrainType !== "flat" ? ` Terrain: ${input.terrainType}.` : ""} Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
    [`${panelCount} panels, ${postCount} posts at ${input.postSpacingFt} ft spacing`, `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`],
  );
  const algorithmTrace = buildAlgorithmTrace(ALGORITHM_VERSIONS.fencing, "fencing",
    ["fenceLengthFt", "fenceHeightFt", "materialType", "terrainType", "gateCount"],
    !input.propertyLineVerified ? ["property line verification"] : [], ["Utilities marked before digging", "US market pricing"],
    [
      { ruleId: "ROCKY_TERRAIN",   label: "Rocky terrain",           triggered: input.terrainType === "rocky",     reason: "Post setting slower, may need power equipment", points: 18 },
      { ruleId: "SLOPED_TERRAIN",  label: "Sloped terrain",          triggered: input.terrainType === "sloped",    reason: "Step-down layout, extra cut and fit time", points: 16 },
      { ruleId: "TALL_FENCE",      label: "Tall fence (>6 ft)",      triggered: input.fenceHeightFt > 6,           reason: "Permit required, post depth and bracing", points: 16 },
      { ruleId: "NO_PROPERTY_LINE",label: "Property line unverified", triggered: !input.propertyLineVerified,      reason: "High dispute risk — encroachment liability", points: 14 },
    ],
  );


  const productionSchedule = buildProductionSchedule([
    { name: 'Property line and layout', daysMin: 0, daysMax: 1, crew: 2, description: 'Confirm property line, mark post locations, call 811' },
    { name: 'Post digging and setting', daysMin: 1, daysMax: 2, crew: 2, description: 'Dig post holes, set posts in concrete, allow to cure' },
    { name: 'Panel and rail installation', daysMin: 1, daysMax: 3, crew: 2, description: 'Install fence panels or rails between posts' },
    { name: 'Gate installation', daysMin: 0, daysMax: 1, crew: 2, description: 'Hang gates, install latches and hardware' },
    { name: 'Stain / seal and cleanup', daysMin: 1, daysMax: 1, crew: 2, description: 'Apply stain or sealant if wood, cleanup debris' },
  ]);

  const hiddenDamage = assessHiddenDamageProbability(undefined, false, false, false, true, false);

  const scheduleRisk = assessScheduleRisk({
    dependsOnOtherTrades: false,
    clientMustDecide: !input.propertyLineVerified,
    materialsOnSite: false,
    weatherDependent: true,
    scopeIsLarge: input.fenceLengthFt > 200,
    hasComplexDetails: input.terrainType !== 'flat' || ['metal','aluminum'].includes(input.materialType),
  });

  const upsells = [
      { service: 'Automatic gate opener', reason: 'Add conduit and wiring during install — pre-wire for future automation.' },
      { service: 'Privacy slats (chain-link)', reason: 'Adds privacy to chain-link for ~$3/lf — minimal extra labor.' },
      { service: 'Post cap lighting', reason: 'Solar post caps install without wiring — added while posts are fresh.' }
  ];

  const roi = {
    investmentAmount:    costs.total,
    estimatedValueAdded: Math.round(costs.total * 0.55),
    roiPercent:          -45,
    notes:               'New fencing returns 50-60% in home value and improves curb appeal and security.',
  };
  return {
    toolId: `fencing-${Date.now()}`, trade: "fencing", projectType: input.demoExisting ? "fence-remodel" : "new-fence",
    mode: input.mode, inputs: { ...input }, validationIssues: issues, isValid: isValid(issues),
    materials: mats, labor, costs, risk, milestones, evidenceRequired: evidence.items,
    warnings: [
      ...(!input.propertyLineVerified ? ["⚠ Property line unverified: high risk of encroachment dispute."] : []),
      ...(input.fenceHeightFt > 6 ? ["Height > 6 ft: verify local code and permit requirements."] : []),
      ...(input.terrainType === "rocky" ? ["Rocky terrain: budget for power auger and slower post setting."] : []),
      ...(input.demoExisting ? ["Existing fence: confirm buried utilities and property markers."] : []),
    ],
    recommendations: [
      "Call 811 (utility locate) before any post digging.",
      "Confirm property line with survey or stakes before install.",
      "Capture photos of posts, panels, and gates before closeout.",
    ],
    assumptions: ["Property line verified by client.", "Utilities marked before digging.", "US market pricing."],
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

export const runFencingEngine = calculateFencing;
