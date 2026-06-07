import { collect, isValid, oneOf, positive, range, warn } from "../core/validation-engine.js";
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

export type DeckMaterial = "pressure-treated" | "cedar" | "composite" | "tropical-hardwood" | "ipe";

export type DeckInput = {
  deckLengthFt: number;
  deckWidthFt: number;
  materialType: DeckMaterial;
  joistSpacingIn: 12 | 16 | 24;
  postCount: number;
  railingLinearFt: number;
  stairsCount: number;
  demoExisting: boolean;
  stainSeal: boolean;
  pergola: boolean;
  attachedToHouse: boolean;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const DECK_MATERIALS = ["pressure-treated", "cedar", "composite", "tropical-hardwood", "ipe"] as const;
const JOIST_SPACINGS = ["12", "16", "24"] as const;
const TOOL_MODES = ["client", "professional", "admin"] as const;

const DECK_COST: Record<DeckMaterial, number> = {
  "pressure-treated": 4.40, cedar: 6.20, composite: 9.80, "tropical-hardwood": 12.40, ipe: 14.50,
};
const JOIST_COST: Record<number, number> = { 12: 4.20, 16: 3.60, 24: 3.00 };

function normalizeRange(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function normalizeOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

export function calculateDeck(input: DeckInput): SemseToolResult {
  const materialType = normalizeOneOf(input.materialType, DECK_MATERIALS, "pressure-treated");
  const joistSpacingIn = Number(normalizeOneOf(String(input.joistSpacingIn), JOIST_SPACINGS, "16"));
  const mode = normalizeOneOf(input.mode, TOOL_MODES, "professional");
  const deckLengthFt = normalizeRange(input.deckLengthFt, 0.1, 500, 12);
  const deckWidthFt = normalizeRange(input.deckWidthFt, 0.1, 500, 12);
  const postCount = normalizeRange(input.postCount, 2, 100, 4);
  const railingLinearFt = normalizeRange(input.railingLinearFt, 0, 5_000, 0);
  const stairsCount = normalizeRange(input.stairsCount, 0, 20, 0);

  const issues = collect(
    oneOf("materialType", input.materialType, DECK_MATERIALS, "Material type"),
    oneOf("joistSpacingIn", String(input.joistSpacingIn), JOIST_SPACINGS, "Joist spacing"),
    oneOf("mode", input.mode, TOOL_MODES, "Mode"),
    positive("deckLengthFt", input.deckLengthFt, "Deck length"),
    positive("deckWidthFt",  input.deckWidthFt,  "Deck width"),
    range("postCount", input.postCount, 2, 100, "Post count"),
    range("railingLinearFt", input.railingLinearFt, 0, 5_000, "Railing linear feet"),
    range("stairsCount", input.stairsCount, 0, 20, "Stairs"),
    materialType === "ipe" || materialType === "tropical-hardwood" ? warn("materialType", "Tropical wood: allow acclimation, pre-drill for fasteners, verify availability.") : null,
    deckWidthFt > 12 && joistSpacingIn === 24 ? warn("joistSpacingIn", "Wide span at 24\" spacing: verify deflection and load.") : null,
    input.attachedToHouse && !railingLinearFt ? warn("railingLinearFt", "Attached deck without railing: verify height and code.") : null,
  );

  const deckAreaSqFt = deckLengthFt * deckWidthFt;
  const waste = materialType === "composite" ? 0.08 : 0.12;
  const adjustedArea = deckAreaSqFt * (1 + waste + (input.demoExisting ? 0.03 : 0));
  const deckBoards = Math.max(1, Math.ceil(adjustedArea / 5.5));
  const joistCount = Math.max(2, Math.ceil(deckLengthFt / (joistSpacingIn / 12)));
  const railKits   = railingLinearFt > 0 ? Math.max(1, Math.ceil(railingLinearFt / 8)) : 0;
  const stainKits  = input.stainSeal ? Math.max(1, Math.ceil(deckAreaSqFt / 200)) : 0;

  const boardCost = priceOf(input.prices, "lumber-framing", DECK_COST[materialType]);
  const joistCost = priceOf(input.prices, "lumber-framing", JOIST_COST[joistSpacingIn] ?? 3.60);

  const mats = [
    material(`${materialType} decking`, deckBoards, "board", boardCost, "Decking"),
    material(`Joists @ ${joistSpacingIn}"`, joistCount, "piece", joistCost, "Framing"),
    material("Post bases / anchors", Math.max(2, postCount), "set", 18, "Support"),
    material("Beam / ledger lumber", Math.max(1, Math.ceil(deckLengthFt / 8)), "piece", 28, "Framing"),
    ...(railKits > 0 ? [material("Railing kit", railKits, "kit", 145, "Safety")] : []),
    ...(stairsCount > 0 ? [material("Stair kit / stringers", stairsCount, "kit", 85, "Access")] : []),
    material("Fasteners / brackets / joist hangers", Math.max(1, Math.ceil(deckAreaSqFt / 100)), "kit", 26, "Hardware"),
    ...(input.demoExisting ? [material("Deck demo / disposal", Math.max(1, Math.ceil(deckAreaSqFt / 180)), "job", 48, "Demo")] : []),
    ...(stainKits > 0 ? [material("Stain / sealant", stainKits, "gal", 34, "Finish")] : []),
    ...(input.pergola ? [material("Pergola framing kit", 1, "kit", 850, "Pergola")] : []),
    material("Concrete / concrete bags", Math.max(1, Math.ceil(postCount * 2)), "bag", 8, "Foundation"),
  ];

  const labor = estimateLabor({
    baseHours: 5 + adjustedArea / 28 + postCount * 0.5
      + (railingLinearFt > 0 ? railingLinearFt / 18 : 0)
      + stairsCount * 1.4 + (input.demoExisting ? 3 : 0)
      + (["composite", "ipe", "tropical-hardwood"].includes(materialType) ? 2.5 : 0)
      + (input.pergola ? 6 : 0) + (input.attachedToHouse ? 1.5 : 0),
    crewSize: adjustedArea > 300 ? 3 : 2,
    ratePerHour: materialType === "composite" || materialType === "ipe" ? 72 : 60,
    difficulty: materialType === "ipe" || materialType === "tropical-hardwood" || input.demoExisting || stairsCount > 2 ? "complex" : "moderate",
    notes: [`${deckAreaSqFt.toFixed(0)} sqft — ${materialType}`, input.stainSeal ? "Stain/seal included" : "No stain"],
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost, input.location, "labor"),
    { overhead: ["composite", "ipe"].includes(materialType) || input.demoExisting ? 0.16 : 0.14, profit: 0.20, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: deckAreaSqFt || 1 },
  );

  const risk = computeRisk([
    factor("hardwood",    "Tropical hardwood",  0.16, materialType === "ipe" || materialType === "tropical-hardwood"),
    factor("demo",        "Existing deck demo", 0.12, input.demoExisting),
    factor("rails",       "Railing required",   0.14, railingLinearFt > 0),
    factor("stairs",      "Stairs present",     0.16, stairsCount > 0),
    factor("wide_span",   "Wide span (14+ ft)", 0.10, deckWidthFt > 14),
    factor("attached",    "Attached to house",  0.12, input.attachedToHouse),
  ], { requiresPermit: deckAreaSqFt > 200 || railingLinearFt > 0 || stairsCount > 0, requiresLicense: stairsCount > 0 || materialType === "ipe", requiresInspection: true, requiresEngineering: deckWidthFt > 16 || stairsCount > 3 || input.attachedToHouse });

  const milestones = buildMilestones(costs.total, risk.level,
    ["Demo and layout", "Footings and framing", "Decking and rail", "Finish and handoff"],
    [
      ["Photos of site / demo", "Layout confirmation"],
      ["Photos of footings and frame", "Level / square check"],
      ["Photos of decking and railing", "Fastener verification"],
      ["Final photos", "Client approval"],
    ]
  );
  const evidence = buildEvidenceChecklist("deck", risk, milestones, [
    { type: "photo",       description: "Demo / site prep",                    required: input.demoExisting, milestone: 1 },
    { type: "measurement", description: "Footing / frame level and square",    required: true, milestone: 2 },
    { type: "photo",       description: "Decking / railing install",           required: true, milestone: 3 },
    { type: "inspection",  description: "Final safe access and handoff",       required: true, milestone: 4 },
  ]);

  const confidence = computeConfidenceScore({
    hasMeasurements: true, hasPhotos: false, hasConditionData: !input.demoExisting,
    hasMaterialSelection: true, hasScopeConfirmed: true, hasUnknownConditions: false,
    extraConfirmedFields: (railingLinearFt > 0 ? 1 : 0) + (stairsCount > 0 ? 1 : 0) + (input.stainSeal ? 1 : 0),
  });
  const readiness = computeReadinessScore({
    measurementsConfirmed: true, materialsAvailable: false, siteAccessConfirmed: true,
    permitsAddressed: deckAreaSqFt <= 200 && railingLinearFt === 0 && stairsCount === 0,
    scopeApproved: true, depositPaid: false, clientApproval: false, otherTradesCoordinated: false,
  });
  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous: false, clientProvidesMaterials: false, noPhotosRequired: false,
    hasChangeOrderPolicy: true, hasEvidenceRequired: true, hasMilestones: true,
    hasHighRiskConditions: stairsCount > 0 || input.attachedToHouse,
    priceIsFixed: true, clientExpectationMismatch: materialType === "ipe" || materialType === "tropical-hardwood",
  });
  const priceBands = computePriceBands(costs.total, 0.82, materialType === "ipe" || input.pergola ? 1.45 : 1.25, {
    low:  "Pressure-treated, no stairs, no railing, no demo",
    mid:  "Composite or cedar, railing, simple stairs",
    high: materialType === "ipe" ? "Ipe, pergola, stairs, railing, demo" : "Composite + pergola + stairs + full railing",
  });
  const scope = buildScope(
    [`${materialType} deck (${deckAreaSqFt.toFixed(0)} sqft)`, `${joistSpacingIn}" joist spacing`, railingLinearFt > 0 ? `${railingLinearFt} lf railing` : "", stairsCount > 0 ? `${stairsCount} stair set(s)` : "", input.demoExisting ? "Existing deck demo" : "", input.stainSeal ? "Stain / seal" : "", input.pergola ? "Pergola framing" : "", input.attachedToHouse ? "Ledger attachment to house" : ""].filter(Boolean),
    ["Footings beyond code depth", "Landscaping disturbance", !input.stainSeal && materialType !== "composite" ? "Stain / sealant" : ""].filter(Boolean),
    ["Soil bearing capacity adequate for footings", "US market pricing"],
    ["Footing depth fails inspection", "Attached ledger reveals wall damage"],
  );
  const warranty = buildWarranty(365, "1-year labor warranty. Material warranty per manufacturer.", ["Storm damage", "Wood movement from moisture cycles"]);
  const inspectionGate = buildInspectionGate(
    "After footing and framing — before decking install",
    ["Footing photo with depth measurement", "Frame level / square photo"],
    "Footing depth or framing fails inspection — must be corrected before decking",
    "Inspect footings and frame before decking covers them.",
  );
  const safeToProceed = computeSafeToProceed({
    hasMinimalData: isValid(issues), readinessScore: readiness.score, hasCriticalBlockers: false,
    hasMilestones: true, hasEvidencePlan: true, confidenceScore: confidence.score, noCriticalBlockers: true, scopeIsComplete: true,
  });
  const explained = buildExplainedOutput(
    `Your ${materialType} deck covers ${deckAreaSqFt.toFixed(0)} sqft with ${joistSpacingIn}" joist spacing.${railingLinearFt > 0 ? ` ${railingLinearFt} lf railing included.` : ""}${stairsCount > 0 ? ` ${stairsCount} stair set(s).` : ""} Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
    [`Waste: ${(waste * 100).toFixed(0)}% — ${deckBoards} boards ordered`, `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`],
  );
  const algorithmTrace = buildAlgorithmTrace(ALGORITHM_VERSIONS.deck, "deck",
    ["deckLengthFt", "deckWidthFt", "materialType", "railingLinearFt", "stairsCount"],
    [], ["Soil adequate for footings", "US market pricing"],
    [
      { ruleId: "IPE_PREMIUM",  label: "Ipe/tropical premium", triggered: materialType === "ipe" || materialType === "tropical-hardwood", reason: "Material cost + specialist labor + acclimation", points: 16 },
      { ruleId: "STAIRS_RISK",  label: "Stairs risk",          triggered: stairsCount > 0, reason: "Rise/run compliance, landings, fall protection", points: 16 },
      { ruleId: "ATTACHED_LDG", label: "Attached ledger",      triggered: input.attachedToHouse, reason: "Ledger flashing, structural tie-in, engineering", points: 12 },
    ],
  );


  const productionSchedule = buildProductionSchedule([
    { name: 'Demo and layout', daysMin: 1, daysMax: 2, crew: 2, description: 'Remove existing deck if applicable, stake and layout new footings' },
    { name: 'Footings and posts', daysMin: 1, daysMax: 2, crew: 2, description: 'Dig and pour concrete footings, set posts and let cure' },
    { name: 'Beam and joist framing', daysMin: 1, daysMax: 2, crew: 2, description: 'Install beams, ledger board, joist hangers, blocking' },
    { name: 'Decking installation', daysMin: 2, daysMax: 4, crew: 2, description: 'Install deck boards, fascia, spacing gaps' },
    { name: 'Railing and stairs', daysMin: 1, daysMax: 3, crew: 2, description: 'Install railing posts, rails, balusters, stair stringers' },
    { name: 'Stain / seal and cleanup', daysMin: 1, daysMax: 2, crew: 2, description: 'Apply stain or sealant, final cleanup, hardware check' },
  ]);

  const hiddenDamage = assessHiddenDamageProbability(undefined, false, false, true, true, false);

  const scheduleRisk = assessScheduleRisk({
    dependsOnOtherTrades: false,
    clientMustDecide: ['ipe','tropical-hardwood'].includes(materialType),
    materialsOnSite: false,
    weatherDependent: true,
    scopeIsLarge: deckAreaSqFt > 300,
    hasComplexDetails: stairsCount > 0 || input.pergola || materialType === 'ipe',
  });

  const upsells = [
      { service: 'Pergola or shade structure', reason: 'Crews are staged — add pergola for 30% less labor than a separate mobilization.' },
      { service: 'Composite decking upgrade', reason: 'Composite lasts 25-30 years vs 10-15 for PT — eliminates future staining.' },
      { service: 'Under-deck lighting', reason: 'Install wire channels while boards are going down for future deck lighting.' }
  ];

  const roi = {
    investmentAmount:    costs.total,
    estimatedValueAdded: Math.round(costs.total * 0.7),
    roiPercent:          -30,
    notes:               'Deck additions return 65-75% of construction cost in home value and usable outdoor space.',
  };
  return {
    toolId: `deck-${Date.now()}`, trade: "deck", projectType: input.demoExisting ? "deck-remodel" : "new-deck",
    mode, inputs: { ...input }, validationIssues: issues, isValid: isValid(issues),
    materials: mats, labor, costs, risk, milestones, evidenceRequired: evidence.items,
    warnings: [
      ...(input.demoExisting ? ["Existing deck demo: check hidden damage and footing before rebuild."] : []),
      ...(railingLinearFt > 0 ? ["Railing: verify height, post spacing, and code compliance."] : []),
      ...(stairsCount > 0 ? ["Stairs: confirm rise/run, landing, and handrail requirements."] : []),
      ...(materialType === "ipe" ? ["Ipe: pre-drill all fasteners to prevent splitting."] : []),
    ],
    recommendations: [
      "Verify footing, joist spacing, and framing before decking.",
      "Capture photos of frame, railing, and stairs before closeout.",
      ...(input.stainSeal ? ["Seal or stain only after deck is dry and clean."] : []),
    ],
    assumptions: ["Adequate soil bearing capacity.", "US market pricing.", "Code-compliant fasteners."],
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

export const runDeckEngine = calculateDeck;
