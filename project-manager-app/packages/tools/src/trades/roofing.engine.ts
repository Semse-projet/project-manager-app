import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { applyLocation, buildCostSummary, material, materialTotal, priceOf } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";
import {
  computeConfidenceScore,
  computeDisputeRisk,
  computeReadinessScore,
  computePriceBands,
  buildScope,
  buildExplainedOutput,
  buildWarranty,
  assessHiddenDamageProbability,
  buildInspectionGate,
  buildAlgorithmTrace,
  computeSafeToProceed,
  ALGORITHM_VERSIONS,
} from "../core/extended-metrics.js";

export type ShingleType = "3-tab" | "architectural" | "metal" | "tile" | "flat-tpo" | "flat-modified";

export type RoofingInput = {
  roofAreaSqFt: number;
  pitch: number;
  shingleType: ShingleType;
  removeOldRoof: boolean;
  layers: number;
  underlayment: boolean;
  iceBarrier: boolean;
  vents: number;
  skylightCount: number;
  flashingReplace: boolean;
  deckCondition: "good" | "fair" | "poor" | "unknown";
  guttersIncluded: boolean;
  warrantyYears: 20 | 30 | 50;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const SHINGLE_COST_PER_SQ: Record<ShingleType, number> = {
  "3-tab":          95,
  architectural:   120,
  metal:           310,
  tile:            480,
  "flat-tpo":      185,
  "flat-modified": 165,
};

const LABOR_HOURS_PER_SQ: Record<ShingleType, number> = {
  "3-tab":          1.6,
  architectural:    1.8,
  metal:            2.8,
  tile:             3.5,
  "flat-tpo":       2.2,
  "flat-modified":  2.5,
};

export function calculateRoofing(input: RoofingInput): SemseToolResult {
  const issues = collect(
    positive("roofAreaSqFt", input.roofAreaSqFt, "Roof area"),
    range("pitch", input.pitch, 1, 18, "Roof pitch"),
    range("layers", input.layers, 1, 3, "Existing layers"),
    input.pitch >= 10 ? warn("pitch", "Steep pitch (10+): add fall protection and steep-slope surcharge.") : null,
    input.layers > 1  ? warn("layers", "Multiple layers: verify structural capacity before tear-off.") : null,
    input.deckCondition === "unknown" ? warn("deckCondition", "Deck condition unknown: budget for potential sheathing repairs.") : null,
    input.deckCondition === "poor"    ? warn("deckCondition", "Poor deck: likely requires partial sheathing replacement — change-order risk.") : null,
  );

  const squares      = input.roofAreaSqFt / 100;
  const wasteFactor  = input.pitch >= 10 ? 0.15 : input.shingleType === "metal" ? 0.08 : 0.10;
  const orderSquares = Math.ceil(squares * (1 + wasteFactor));
  const pitchSurcharge = input.pitch >= 12 ? 0.30 : input.pitch >= 10 ? 0.18 : 0;

  const mats = [
    material(`${input.shingleType} shingles`, orderSquares, "sq",
      priceOf(input.prices, `${input.shingleType}-shingles`, SHINGLE_COST_PER_SQ[input.shingleType]), "Cover"),
    ...(input.underlayment ? [material("Synthetic underlayment", Math.ceil(input.roofAreaSqFt / 400), "roll",
      priceOf(input.prices, "roofing-underlayment", 72), "Base")] : []),
    ...(input.iceBarrier   ? [material("Ice & water shield", Math.ceil(input.roofAreaSqFt / 200), "roll", 95, "Base")] : []),
    ...(input.removeOldRoof ? [material("Tear-off & disposal", Math.ceil(squares), "sq", 42 + (input.layers - 1) * 18, "Demo")] : []),
    material("Ridge cap", Math.ceil(input.roofAreaSqFt / 600), "bundle", 55, "Trim"),
    material("Flashing (valleys/pipes)", input.flashingReplace ? Math.ceil(input.roofAreaSqFt / 120) : 1, "kit", 48, "Flashing"),
    ...(input.skylightCount > 0 ? [material("Skylight flashing kit", input.skylightCount, "kit", 120, "Flashing")] : []),
    ...(input.vents > 0 ? [material("Roof vents", input.vents, "un", 35, "Ventilation")] : []),
    ...(input.guttersIncluded ? [material("Gutters & downspouts", Math.ceil(input.roofAreaSqFt / 40), "lf", 12, "Gutters")] : []),
    material("Permits & inspection", 1, "job", 165, "Permits"),
  ];

  const installHours  = squares * LABOR_HOURS_PER_SQ[input.shingleType] * (1 + pitchSurcharge);
  const tearOffHours  = input.removeOldRoof ? squares * (0.6 + (input.layers - 1) * 0.3) : 0;
  const gutterHours   = input.guttersIncluded ? Math.ceil(input.roofAreaSqFt / 40) * 0.15 : 0;

  const labor = estimateLabor({
    baseHours: tearOffHours + installHours + input.skylightCount * 2.5 + gutterHours + 2,
    crewSize: input.roofAreaSqFt > 2500 ? 4 : 3,
    ratePerHour: 64,
    difficulty: input.pitch >= 10 || input.shingleType === "tile" || input.layers > 1 ? "complex" : "moderate",
    notes: [
      `${input.roofAreaSqFt.toLocaleString()} sqft — ${orderSquares} squares`,
      `${input.shingleType} shingles · ${input.warrantyYears}-yr warranty`,
      input.removeOldRoof ? `Tear-off: ${input.layers} layer(s)` : "Overlay",
      input.pitch >= 10 ? `Steep pitch ${input.pitch}/12` : `Pitch ${input.pitch}/12`,
    ],
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost, input.location, "labor"),
    { overhead: 0.16, profit: 0.22, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: input.roofAreaSqFt },
  );

  const risk = computeRisk([
    factor("steep_pitch",     "Steep pitch",           0.22, input.pitch >= 10),
    factor("tear_off",        "Tear-off required",     0.16, input.removeOldRoof),
    factor("multiple_layers", "Multiple layers",       0.14, input.layers > 1),
    factor("deck_poor",       "Poor deck condition",   0.20, input.deckCondition === "poor"),
    factor("deck_unknown",    "Deck condition unknown",0.10, input.deckCondition === "unknown"),
    factor("skylights",       "Skylight flashing",     0.10, input.skylightCount > 0),
    factor("premium_mat",     "Premium material",      0.08, input.shingleType === "metal" || input.shingleType === "tile"),
  ], {
    requiresPermit: true,
    requiresLicense: true,
    requiresInspection: true,
    requiresEngineering: input.pitch >= 12 || input.roofAreaSqFt > 3500,
  });

  const hiddenDamage = assessHiddenDamageProbability(
    undefined,
    false,
    input.deckCondition === "poor",
    false,
    true,
    false,
  );

  const confidence = computeConfidenceScore({
    hasMeasurements:      true,
    hasPhotos:            false,
    hasConditionData:     input.deckCondition !== "unknown",
    hasMaterialSelection: true,
    hasScopeConfirmed:    input.deckCondition !== "unknown",
    hasUnknownConditions: input.deckCondition === "unknown",
    extraConfirmedFields: (input.underlayment ? 1 : 0) + (input.flashingReplace ? 1 : 0) + (input.iceBarrier ? 1 : 0),
  });

  const readiness = computeReadinessScore({
    measurementsConfirmed: true,
    materialsAvailable:    false,
    siteAccessConfirmed:   true,
    permitsAddressed:      false,
    scopeApproved:         input.deckCondition !== "unknown",
    depositPaid:           false,
    clientApproval:        false,
    otherTradesCoordinated: false,
  });

  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous:           input.deckCondition === "unknown",
    clientProvidesMaterials:  false,
    noPhotosRequired:         false,
    hasChangeOrderPolicy:     true,
    hasEvidenceRequired:      true,
    hasMilestones:            true,
    hasHighRiskConditions:    input.deckCondition !== "good" || input.pitch >= 10,
    priceIsFixed:             true,
    clientExpectationMismatch: input.deckCondition === "unknown",
  });

  const priceBands = computePriceBands(
    costs.total,
    0.82,
    input.deckCondition !== "good" ? 1.38 : 1.22,
    {
      low:  "No tear-off, 3-tab, standard pitch, deck in good condition",
      mid:  "Architectural shingles, standard tear-off, typical conditions",
      high: input.deckCondition !== "good" ? "Deck repairs + steep pitch + skylights + full flashing" : "Metal/tile + steep + skylights + gutters",
    },
  );

  const scope = buildScope(
    [
      `${input.shingleType} shingle installation (${input.roofAreaSqFt.toLocaleString()} sqft)`,
      input.underlayment ? "Synthetic underlayment" : "Standard felt",
      input.iceBarrier ? "Ice & water shield at eaves and valleys" : "",
      input.removeOldRoof ? `Tear-off of ${input.layers} layer(s) with disposal` : "",
      input.flashingReplace ? "Full flashing replacement (valleys, step, pipe)" : "Pipe & penetration flashing",
      input.skylightCount > 0 ? `Skylight flashing (${input.skylightCount} unit(s))` : "",
      input.vents > 0 ? `${input.vents} roof vent(s)` : "",
      input.guttersIncluded ? "Gutter & downspout installation" : "",
      "Ridge cap, cleanup, nail sweep",
    ].filter(Boolean),
    [
      "Deck/sheathing structural repairs (change order if needed)",
      "Chimney masonry or repointing",
      "Fascia and soffit rot repair",
      !input.guttersIncluded ? "Gutters and downspouts" : "",
      "Interior water damage remediation",
    ].filter(Boolean),
    [
      "Deck is structurally sound — no replacement required",
      "Dumpster or haul-away access available on-site",
      "Existing fasteners compatible with new material",
    ],
    [
      "Rotted or damaged decking discovered during tear-off",
      "More existing layers found than stated",
      "Chimney flashing deterioration beyond surface sealing",
      "Hidden mold or moisture in attic",
    ],
  );

  const milestones = buildMilestones(costs.total, risk.level,
    ["Site prep & tear-off", "Deck & base layers", "Shingle installation", "Final inspection & cleanup"],
    [
      ["Pre-existing roof condition photos", "Perimeter protection"],
      ["Deck condition photos post-tear-off", "Underlayment & ice barrier"],
      ["Installation progress photos", "Ridge & flashing detail"],
      ["Completed roof photos", "Nail sweep confirmation", "Client walkthrough"],
    ]
  );

  const evidence = buildEvidenceChecklist("roofing", risk, milestones, [
    { type: "photo",      description: "Pre-existing roof condition",         required: true,  milestone: 1 },
    { type: "photo",      description: "Deck condition after tear-off",       required: true,  milestone: 2 },
    { type: "photo",      description: "Underlayment and flashing installed", required: true,  milestone: 2 },
    { type: "photo",      description: "Completed installation",              required: true,  milestone: 3 },
    { type: "inspection", description: "Final inspection sign-off",           required: true,  milestone: 4 },
  ]);

  const warranty = buildWarranty(365,
    `Labor warranty 1 year. Material warranty: ${input.warrantyYears} years per manufacturer (registration required).`,
    ["Storm or hail damage", "Foot traffic damage", "Structural movement"],
  );

  const inspectionGate = buildInspectionGate(
    "After tear-off — before any new material installed",
    ["Deck condition photos", "Measurements of damaged areas"],
    "Deck damage or additional layers discovered requiring sheathing replacement",
    "Inspect deck for rot, delamination, soft spots. Issue change order before proceeding.",
  );

  const safeToProceed = computeSafeToProceed({
    hasMinimalData:      isValid(issues),
    readinessScore:      readiness.score,
    hasCriticalBlockers: input.deckCondition === "unknown" && input.roofAreaSqFt > 2000,
    hasMilestones:       true,
    hasEvidencePlan:     true,
    confidenceScore:     confidence.score,
    noCriticalBlockers:  input.deckCondition !== "unknown",
    scopeIsComplete:     input.deckCondition !== "unknown",
  });

  const explained = buildExplainedOutput(
    `Your ${input.shingleType} roof replacement covers ${input.roofAreaSqFt.toLocaleString()} sqft with a ${input.warrantyYears}-year material warranty. ${input.removeOldRoof ? "Includes full tear-off. " : ""}Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}. ${input.deckCondition !== "good" ? "Note: a change order may be issued if damaged decking is found." : ""}`,
    [
      `Pitch ${input.pitch}/12 — ${input.pitch >= 10 ? `steep slope: ${(pitchSurcharge * 100).toFixed(0)}% labor surcharge` : "standard"}`,
      `Waste factor ${(wasteFactor * 100).toFixed(0)}% — ordered ${orderSquares} sq for ${squares.toFixed(1)} actual`,
      hiddenDamage.score > 20 ? `Hidden damage risk: ${hiddenDamage.probability} — include contingency allowance` : "Deck risk appears manageable",
      `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`,
    ],
  );

  const algorithmTrace = buildAlgorithmTrace(
    ALGORITHM_VERSIONS.roofing ?? "roofing-v2.0",
    "roofing",
    ["roofAreaSqFt", "pitch", "shingleType", "removeOldRoof", "layers", "underlayment", "iceBarrier", "deckCondition"],
    input.deckCondition === "unknown" ? ["deck condition details"] : [],
    ["Deck structurally sound", "Standard US market pricing", "Dumpster access available"],
    [
      { ruleId: "STEEP_PITCH",     label: "Steep pitch surcharge",   triggered: input.pitch >= 10,              reason: `Pitch ${input.pitch}/12 adds ${(pitchSurcharge * 100).toFixed(0)}% to labor`, points: 22 },
      { ruleId: "MULTI_LAYER",     label: "Multi-layer tear-off",    triggered: input.layers > 1,               reason: "Extra labor and disposal per additional layer", points: 14 },
      { ruleId: "ICE_BARRIER",     label: "Ice & water shield",      triggered: input.iceBarrier,               reason: "Climate/code requirement adds material", points: 0 },
      { ruleId: "DECK_RISK",       label: "Deck condition risk",     triggered: input.deckCondition !== "good", reason: `Deck ${input.deckCondition} — hidden damage budget recommended`, points: 20 },
      { ruleId: "SKYLIGHT_FLASH",  label: "Skylight flashing",       triggered: input.skylightCount > 0,        reason: "Premium labor and materials for skylight seal", points: 10 },
    ],
  );

  return {
    toolId: `roofing-${Date.now()}`,
    trade: "roofing",
    projectType: input.shingleType.includes("flat") ? "flat-roof-install" : "roof-replacement",
    mode: input.mode,
    inputs: { ...input },
    validationIssues: issues,
    isValid: isValid(issues),
    materials: mats,
    labor,
    costs,
    risk,
    milestones,
    evidenceRequired: evidence.items,
    warnings: [
      ...(input.pitch >= 10        ? ["Steep pitch: OSHA fall protection required at all times."] : []),
      ...(input.layers > 1         ? ["Multiple layers: verify structural load capacity before tear-off."] : []),
      ...(input.deckCondition !== "good" ? [`Deck condition is ${input.deckCondition}: issue change order before covering damaged sheathing.`] : []),
      ...(input.skylightCount > 0  ? ["Skylight flashing: most common post-install leak source — triple-check seal."] : []),
    ],
    recommendations: [
      "Inspect deck after tear-off before any material goes down.",
      "Perform magnetic nail sweep after completion.",
      "Provide manufacturer warranty registration to client.",
    ],
    assumptions: [
      "Deck structurally sound — no replacement required.",
      "US market pricing — adjust with location multiplier.",
      "Dumpster or haul-away access available.",
    ],
    createdAt: new Date().toISOString(),
    confidenceScore: confidence,
    readinessScore:  readiness,
    disputeRisk,
    priceBands,
    safeToProceed,
    scope,
    explained,
    warranty,
    inspectionGate,
    algorithmTrace,
  } as SemseToolResult;
}

export const runRoofingEngine = calculateRoofing;
