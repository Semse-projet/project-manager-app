import { collect, isValid, oneOf, positive, range, warn } from "../core/validation-engine.js";
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

const SHINGLE_TYPES = ["3-tab", "architectural", "metal", "tile", "flat-tpo", "flat-modified"] as const;
const DECK_CONDITIONS = ["good", "fair", "poor", "unknown"] as const;
const WARRANTY_YEARS = ["20", "30", "50"] as const;
const TOOL_MODES = ["client", "professional", "admin"] as const;

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

function normalizePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeRange(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function normalizeOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

export function calculateRoofing(input: RoofingInput): SemseToolResult {
  const issues = collect(
    oneOf("shingleType", input.shingleType, SHINGLE_TYPES, "Shingle type"),
    oneOf("deckCondition", input.deckCondition, DECK_CONDITIONS, "Deck condition"),
    oneOf("warrantyYears", String(input.warrantyYears), WARRANTY_YEARS, "Warranty years"),
    oneOf("mode", input.mode, TOOL_MODES, "Mode"),
    positive("roofAreaSqFt", input.roofAreaSqFt, "Roof area"),
    range("pitch", input.pitch, 1, 18, "Roof pitch"),
    range("layers", input.layers, 1, 3, "Existing layers"),
    range("vents", input.vents, 0, 80, "Roof vents"),
    range("skylightCount", input.skylightCount, 0, 20, "Skylights"),
    Number.isFinite(input.pitch) && input.pitch >= 10 ? warn("pitch", "Steep pitch (10+): add fall protection and steep-slope surcharge.") : null,
    Number.isFinite(input.layers) && input.layers > 1  ? warn("layers", "Multiple layers: verify structural capacity before tear-off.") : null,
    input.deckCondition === "unknown" ? warn("deckCondition", "Deck condition unknown: budget for potential sheathing repairs.") : null,
    input.deckCondition === "poor"    ? warn("deckCondition", "Poor deck: likely requires partial sheathing replacement — change-order risk.") : null,
  );

  const shingleType = normalizeOneOf(input.shingleType, SHINGLE_TYPES, "architectural");
  const deckCondition = normalizeOneOf(input.deckCondition, DECK_CONDITIONS, "unknown");
  const warrantyYears = Number(normalizeOneOf(String(input.warrantyYears), WARRANTY_YEARS, "30")) as RoofingInput["warrantyYears"];
  const mode = normalizeOneOf(input.mode, TOOL_MODES, "professional");
  const roofAreaSqFt = normalizePositive(input.roofAreaSqFt, 100);
  const pitch = normalizeRange(input.pitch, 1, 18, 6);
  const layers = Math.max(1, Math.round(normalizeRange(input.layers, 1, 3, 1)));
  const vents = Math.max(0, Math.round(normalizeRange(input.vents, 0, 80, 0)));
  const skylightCount = Math.max(0, Math.round(normalizeRange(input.skylightCount, 0, 20, 0)));

  const squares      = roofAreaSqFt / 100;
  const wasteFactor  = pitch >= 10 ? 0.15 : shingleType === "metal" ? 0.08 : 0.10;
  const orderSquares = Math.ceil(squares * (1 + wasteFactor));
  const pitchSurcharge = pitch >= 12 ? 0.30 : pitch >= 10 ? 0.18 : 0;

  const mats = [
    material(`${shingleType} shingles`, orderSquares, "sq",
      priceOf(input.prices, `${shingleType}-shingles`, SHINGLE_COST_PER_SQ[shingleType]), "Cover"),
    ...(input.underlayment ? [material("Synthetic underlayment", Math.ceil(roofAreaSqFt / 400), "roll",
      priceOf(input.prices, "roofing-underlayment", 72), "Base")] : []),
    ...(input.iceBarrier   ? [material("Ice & water shield", Math.ceil(roofAreaSqFt / 200), "roll", 95, "Base")] : []),
    ...(input.removeOldRoof ? [material("Tear-off & disposal", Math.ceil(squares), "sq", 42 + (layers - 1) * 18, "Demo")] : []),
    material("Ridge cap", Math.ceil(roofAreaSqFt / 600), "bundle", 55, "Trim"),
    material("Flashing (valleys/pipes)", input.flashingReplace ? Math.ceil(roofAreaSqFt / 120) : 1, "kit", 48, "Flashing"),
    ...(skylightCount > 0 ? [material("Skylight flashing kit", skylightCount, "kit", 120, "Flashing")] : []),
    ...(vents > 0 ? [material("Roof vents", vents, "un", 35, "Ventilation")] : []),
    ...(input.guttersIncluded ? [material("Gutters & downspouts", Math.ceil(roofAreaSqFt / 40), "lf", 12, "Gutters")] : []),
    material("Permits & inspection", 1, "job", 165, "Permits"),
  ];

  const installHours  = squares * LABOR_HOURS_PER_SQ[shingleType] * (1 + pitchSurcharge);
  const tearOffHours  = input.removeOldRoof ? squares * (0.6 + (layers - 1) * 0.3) : 0;
  const gutterHours   = input.guttersIncluded ? Math.ceil(roofAreaSqFt / 40) * 0.15 : 0;

  const labor = estimateLabor({
    baseHours: tearOffHours + installHours + skylightCount * 2.5 + gutterHours + 2,
    crewSize: roofAreaSqFt > 2500 ? 4 : 3,
    ratePerHour: 64,
    difficulty: pitch >= 10 || shingleType === "tile" || layers > 1 ? "complex" : "moderate",
    notes: [
      `${roofAreaSqFt.toLocaleString()} sqft — ${orderSquares} squares`,
      `${shingleType} shingles · ${warrantyYears}-yr warranty`,
      input.removeOldRoof ? `Tear-off: ${layers} layer(s)` : "Overlay",
      pitch >= 10 ? `Steep pitch ${pitch}/12` : `Pitch ${pitch}/12`,
    ],
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost, input.location, "labor"),
    { overhead: 0.16, profit: 0.22, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: roofAreaSqFt },
  );

  const risk = computeRisk([
    factor("steep_pitch",     "Steep pitch",           0.22, pitch >= 10),
    factor("tear_off",        "Tear-off required",     0.16, input.removeOldRoof),
    factor("multiple_layers", "Multiple layers",       0.14, layers > 1),
    factor("deck_poor",       "Poor deck condition",   0.20, deckCondition === "poor"),
    factor("deck_unknown",    "Deck condition unknown",0.10, deckCondition === "unknown"),
    factor("skylights",       "Skylight flashing",     0.10, skylightCount > 0),
    factor("premium_mat",     "Premium material",      0.08, shingleType === "metal" || shingleType === "tile"),
  ], {
    requiresPermit: true,
    requiresLicense: true,
    requiresInspection: true,
    requiresEngineering: pitch >= 12 || roofAreaSqFt > 3500,
  });

  const hiddenDamage = assessHiddenDamageProbability(
    undefined,
    false,
    deckCondition === "poor",
    false,
    true,
    false,
  );

  const confidence = computeConfidenceScore({
    hasMeasurements:      true,
    hasPhotos:            false,
    hasConditionData:     deckCondition !== "unknown",
    hasMaterialSelection: true,
    hasScopeConfirmed:    deckCondition !== "unknown",
    hasUnknownConditions: deckCondition === "unknown",
    extraConfirmedFields: (input.underlayment ? 1 : 0) + (input.flashingReplace ? 1 : 0) + (input.iceBarrier ? 1 : 0),
  });

  const readiness = computeReadinessScore({
    measurementsConfirmed: true,
    materialsAvailable:    false,
    siteAccessConfirmed:   true,
    permitsAddressed:      false,
    scopeApproved:         deckCondition !== "unknown",
    depositPaid:           false,
    clientApproval:        false,
    otherTradesCoordinated: false,
  });

  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous:           deckCondition === "unknown",
    clientProvidesMaterials:  false,
    noPhotosRequired:         false,
    hasChangeOrderPolicy:     true,
    hasEvidenceRequired:      true,
    hasMilestones:            true,
    hasHighRiskConditions:    deckCondition !== "good" || pitch >= 10,
    priceIsFixed:             true,
    clientExpectationMismatch: deckCondition === "unknown",
  });

  const priceBands = computePriceBands(
    costs.total,
    0.82,
    deckCondition !== "good" ? 1.38 : 1.22,
    {
      low:  "No tear-off, 3-tab, standard pitch, deck in good condition",
      mid:  "Architectural shingles, standard tear-off, typical conditions",
      high: deckCondition !== "good" ? "Deck repairs + steep pitch + skylights + full flashing" : "Metal/tile + steep + skylights + gutters",
    },
  );

  const scope = buildScope(
    [
      `${shingleType} shingle installation (${roofAreaSqFt.toLocaleString()} sqft)`,
      input.underlayment ? "Synthetic underlayment" : "Standard felt",
      input.iceBarrier ? "Ice & water shield at eaves and valleys" : "",
      input.removeOldRoof ? `Tear-off of ${layers} layer(s) with disposal` : "",
      input.flashingReplace ? "Full flashing replacement (valleys, step, pipe)" : "Pipe & penetration flashing",
      skylightCount > 0 ? `Skylight flashing (${skylightCount} unit(s))` : "",
      vents > 0 ? `${vents} roof vent(s)` : "",
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
    `Labor warranty 1 year. Material warranty: ${warrantyYears} years per manufacturer (registration required).`,
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
    hasCriticalBlockers: deckCondition === "unknown" && roofAreaSqFt > 2000,
    hasMilestones:       true,
    hasEvidencePlan:     true,
    confidenceScore:     confidence.score,
    noCriticalBlockers:  deckCondition !== "unknown",
    scopeIsComplete:     deckCondition !== "unknown",
  });

  const explained = buildExplainedOutput(
    `Your ${shingleType} roof replacement covers ${roofAreaSqFt.toLocaleString()} sqft with a ${warrantyYears}-year material warranty. ${input.removeOldRoof ? "Includes full tear-off. " : ""}Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}. ${deckCondition !== "good" ? "Note: a change order may be issued if damaged decking is found." : ""}`,
    [
      `Pitch ${pitch}/12 — ${pitch >= 10 ? `steep slope: ${(pitchSurcharge * 100).toFixed(0)}% labor surcharge` : "standard"}`,
      `Waste factor ${(wasteFactor * 100).toFixed(0)}% — ordered ${orderSquares} sq for ${squares.toFixed(1)} actual`,
      hiddenDamage.score > 20 ? `Hidden damage risk: ${hiddenDamage.probability} — include contingency allowance` : "Deck risk appears manageable",
      `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`,
    ],
  );

  const algorithmTrace = buildAlgorithmTrace(
    ALGORITHM_VERSIONS.roofing ?? "roofing-v2.0",
    "roofing",
    ["roofAreaSqFt", "pitch", "shingleType", "removeOldRoof", "layers", "underlayment", "iceBarrier", "deckCondition"],
    deckCondition === "unknown" ? ["deck condition details"] : [],
    ["Deck structurally sound", "Standard US market pricing", "Dumpster access available"],
    [
      { ruleId: "STEEP_PITCH",     label: "Steep pitch surcharge",   triggered: pitch >= 10,                    reason: `Pitch ${pitch}/12 adds ${(pitchSurcharge * 100).toFixed(0)}% to labor`, points: 22 },
      { ruleId: "MULTI_LAYER",     label: "Multi-layer tear-off",    triggered: layers > 1,                     reason: "Extra labor and disposal per additional layer", points: 14 },
      { ruleId: "ICE_BARRIER",     label: "Ice & water shield",      triggered: input.iceBarrier,               reason: "Climate/code requirement adds material", points: 0 },
      { ruleId: "DECK_RISK",       label: "Deck condition risk",     triggered: deckCondition !== "good",       reason: `Deck ${deckCondition} — hidden damage budget recommended`, points: 20 },
      { ruleId: "SKYLIGHT_FLASH",  label: "Skylight flashing",       triggered: skylightCount > 0,              reason: "Premium labor and materials for skylight seal", points: 10 },
    ],
  );

  return {
    toolId: `roofing-${Date.now()}`,
    trade: "roofing",
    projectType: shingleType.includes("flat") ? "flat-roof-install" : "roof-replacement",
    mode,
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
      ...(pitch >= 10        ? ["Steep pitch: OSHA fall protection required at all times."] : []),
      ...(layers > 1         ? ["Multiple layers: verify structural load capacity before tear-off."] : []),
      ...(deckCondition !== "good" ? [`Deck condition is ${deckCondition}: issue change order before covering damaged sheathing.`] : []),
      ...(skylightCount > 0  ? ["Skylight flashing: most common post-install leak source — triple-check seal."] : []),
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
