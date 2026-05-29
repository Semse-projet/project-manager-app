import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { applyLocation, buildCostSummary, material, materialTotal, priceOf } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";
import {
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

const DECK_COST: Record<DeckMaterial, number> = {
  "pressure-treated": 4.40, cedar: 6.20, composite: 9.80, "tropical-hardwood": 12.40, ipe: 14.50,
};
const JOIST_COST: Record<number, number> = { 12: 4.20, 16: 3.60, 24: 3.00 };

export function calculateDeck(input: DeckInput): SemseToolResult {
  const issues = collect(
    positive("deckLengthFt", input.deckLengthFt, "Deck length"),
    positive("deckWidthFt",  input.deckWidthFt,  "Deck width"),
    range("postCount", input.postCount, 2, 100, "Post count"),
    range("stairsCount", input.stairsCount, 0, 20, "Stairs"),
    input.materialType === "ipe" || input.materialType === "tropical-hardwood" ? warn("materialType", "Tropical wood: allow acclimation, pre-drill for fasteners, verify availability.") : null,
    input.deckWidthFt > 12 && input.joistSpacingIn === 24 ? warn("joistSpacingIn", "Wide span at 24\" spacing: verify deflection and load.") : null,
    input.attachedToHouse && !input.railingLinearFt ? warn("railingLinearFt", "Attached deck without railing: verify height and code.") : null,
  );

  const deckAreaSqFt = input.deckLengthFt * input.deckWidthFt;
  const waste = input.materialType === "composite" ? 0.08 : 0.12;
  const adjustedArea = deckAreaSqFt * (1 + waste + (input.demoExisting ? 0.03 : 0));
  const deckBoards = Math.max(1, Math.ceil(adjustedArea / 5.5));
  const joistCount = Math.max(2, Math.ceil(input.deckLengthFt / (input.joistSpacingIn / 12)));
  const railKits   = input.railingLinearFt > 0 ? Math.max(1, Math.ceil(input.railingLinearFt / 8)) : 0;
  const stainKits  = input.stainSeal ? Math.max(1, Math.ceil(deckAreaSqFt / 200)) : 0;

  const boardCost = priceOf(input.prices, "lumber-framing", DECK_COST[input.materialType]);
  const joistCost = priceOf(input.prices, "lumber-framing", JOIST_COST[input.joistSpacingIn] ?? 3.60);

  const mats = [
    material(`${input.materialType} decking`, deckBoards, "board", boardCost, "Decking"),
    material(`Joists @ ${input.joistSpacingIn}"`, joistCount, "piece", joistCost, "Framing"),
    material("Post bases / anchors", Math.max(2, input.postCount), "set", 18, "Support"),
    material("Beam / ledger lumber", Math.max(1, Math.ceil(input.deckLengthFt / 8)), "piece", 28, "Framing"),
    ...(railKits > 0 ? [material("Railing kit", railKits, "kit", 145, "Safety")] : []),
    ...(input.stairsCount > 0 ? [material("Stair kit / stringers", input.stairsCount, "kit", 85, "Access")] : []),
    material("Fasteners / brackets / joist hangers", Math.max(1, Math.ceil(deckAreaSqFt / 100)), "kit", 26, "Hardware"),
    ...(input.demoExisting ? [material("Deck demo / disposal", Math.max(1, Math.ceil(deckAreaSqFt / 180)), "job", 48, "Demo")] : []),
    ...(stainKits > 0 ? [material("Stain / sealant", stainKits, "gal", 34, "Finish")] : []),
    ...(input.pergola ? [material("Pergola framing kit", 1, "kit", 850, "Pergola")] : []),
    material("Concrete / concrete bags", Math.max(1, Math.ceil(input.postCount * 2)), "bag", 8, "Foundation"),
  ];

  const labor = estimateLabor({
    baseHours: 5 + adjustedArea / 28 + input.postCount * 0.5
      + (input.railingLinearFt > 0 ? input.railingLinearFt / 18 : 0)
      + input.stairsCount * 1.4 + (input.demoExisting ? 3 : 0)
      + (["composite", "ipe", "tropical-hardwood"].includes(input.materialType) ? 2.5 : 0)
      + (input.pergola ? 6 : 0) + (input.attachedToHouse ? 1.5 : 0),
    crewSize: adjustedArea > 300 ? 3 : 2,
    ratePerHour: input.materialType === "composite" || input.materialType === "ipe" ? 72 : 60,
    difficulty: input.materialType === "ipe" || input.materialType === "tropical-hardwood" || input.demoExisting || input.stairsCount > 2 ? "complex" : "moderate",
    notes: [`${deckAreaSqFt.toFixed(0)} sqft — ${input.materialType}`, input.stainSeal ? "Stain/seal included" : "No stain"],
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost, input.location, "labor"),
    { overhead: ["composite", "ipe"].includes(input.materialType) || input.demoExisting ? 0.16 : 0.14, profit: 0.20, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: deckAreaSqFt || 1 },
  );

  const risk = computeRisk([
    factor("hardwood",    "Tropical hardwood",  0.16, input.materialType === "ipe" || input.materialType === "tropical-hardwood"),
    factor("demo",        "Existing deck demo", 0.12, input.demoExisting),
    factor("rails",       "Railing required",   0.14, input.railingLinearFt > 0),
    factor("stairs",      "Stairs present",     0.16, input.stairsCount > 0),
    factor("wide_span",   "Wide span (14+ ft)", 0.10, input.deckWidthFt > 14),
    factor("attached",    "Attached to house",  0.12, input.attachedToHouse),
  ], { requiresPermit: deckAreaSqFt > 200 || input.railingLinearFt > 0 || input.stairsCount > 0, requiresLicense: input.stairsCount > 0 || input.materialType === "ipe", requiresInspection: true, requiresEngineering: input.deckWidthFt > 16 || input.stairsCount > 3 || input.attachedToHouse });

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
    extraConfirmedFields: (input.railingLinearFt > 0 ? 1 : 0) + (input.stairsCount > 0 ? 1 : 0) + (input.stainSeal ? 1 : 0),
  });
  const readiness = computeReadinessScore({
    measurementsConfirmed: true, materialsAvailable: false, siteAccessConfirmed: true,
    permitsAddressed: deckAreaSqFt <= 200 && input.railingLinearFt === 0 && input.stairsCount === 0,
    scopeApproved: true, depositPaid: false, clientApproval: false, otherTradesCoordinated: false,
  });
  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous: false, clientProvidesMaterials: false, noPhotosRequired: false,
    hasChangeOrderPolicy: true, hasEvidenceRequired: true, hasMilestones: true,
    hasHighRiskConditions: input.stairsCount > 0 || input.attachedToHouse,
    priceIsFixed: true, clientExpectationMismatch: input.materialType === "ipe" || input.materialType === "tropical-hardwood",
  });
  const priceBands = computePriceBands(costs.total, 0.82, input.materialType === "ipe" || input.pergola ? 1.45 : 1.25, {
    low:  "Pressure-treated, no stairs, no railing, no demo",
    mid:  "Composite or cedar, railing, simple stairs",
    high: input.materialType === "ipe" ? "Ipe, pergola, stairs, railing, demo" : "Composite + pergola + stairs + full railing",
  });
  const scope = buildScope(
    [`${input.materialType} deck (${deckAreaSqFt.toFixed(0)} sqft)`, `${input.joistSpacingIn}" joist spacing`, input.railingLinearFt > 0 ? `${input.railingLinearFt} lf railing` : "", input.stairsCount > 0 ? `${input.stairsCount} stair set(s)` : "", input.demoExisting ? "Existing deck demo" : "", input.stainSeal ? "Stain / seal" : "", input.pergola ? "Pergola framing" : "", input.attachedToHouse ? "Ledger attachment to house" : ""].filter(Boolean),
    ["Footings beyond code depth", "Landscaping disturbance", !input.stainSeal && input.materialType !== "composite" ? "Stain / sealant" : ""].filter(Boolean),
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
    `Your ${input.materialType} deck covers ${deckAreaSqFt.toFixed(0)} sqft with ${input.joistSpacingIn}" joist spacing.${input.railingLinearFt > 0 ? ` ${input.railingLinearFt} lf railing included.` : ""}${input.stairsCount > 0 ? ` ${input.stairsCount} stair set(s).` : ""} Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
    [`Waste: ${(waste * 100).toFixed(0)}% — ${deckBoards} boards ordered`, `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`],
  );
  const algorithmTrace = buildAlgorithmTrace(ALGORITHM_VERSIONS.deck, "deck",
    ["deckLengthFt", "deckWidthFt", "materialType", "railingLinearFt", "stairsCount"],
    [], ["Soil adequate for footings", "US market pricing"],
    [
      { ruleId: "IPE_PREMIUM",  label: "Ipe/tropical premium", triggered: input.materialType === "ipe" || input.materialType === "tropical-hardwood", reason: "Material cost + specialist labor + acclimation", points: 16 },
      { ruleId: "STAIRS_RISK",  label: "Stairs risk",          triggered: input.stairsCount > 0, reason: "Rise/run compliance, landings, fall protection", points: 16 },
      { ruleId: "ATTACHED_LDG", label: "Attached ledger",      triggered: input.attachedToHouse, reason: "Ledger flashing, structural tie-in, engineering", points: 12 },
    ],
  );

  return {
    toolId: `deck-${Date.now()}`, trade: "deck", projectType: input.demoExisting ? "deck-remodel" : "new-deck",
    mode: input.mode, inputs: { ...input }, validationIssues: issues, isValid: isValid(issues),
    materials: mats, labor, costs, risk, milestones, evidenceRequired: evidence.items,
    warnings: [
      ...(input.demoExisting ? ["Existing deck demo: check hidden damage and footing before rebuild."] : []),
      ...(input.railingLinearFt > 0 ? ["Railing: verify height, post spacing, and code compliance."] : []),
      ...(input.stairsCount > 0 ? ["Stairs: confirm rise/run, landing, and handrail requirements."] : []),
      ...(input.materialType === "ipe" ? ["Ipe: pre-drill all fasteners to prevent splitting."] : []),
    ],
    recommendations: [
      "Verify footing, joist spacing, and framing before decking.",
      "Capture photos of frame, railing, and stairs before closeout.",
      ...(input.stainSeal ? ["Seal or stain only after deck is dry and clean."] : []),
    ],
    assumptions: ["Adequate soil bearing capacity.", "US market pricing.", "Code-compliant fasteners."],
    createdAt: new Date().toISOString(),
    confidenceScore: confidence, readinessScore: readiness, disputeRisk, priceBands,
    safeToProceed, scope, explained, warranty, inspectionGate, algorithmTrace,
  } as SemseToolResult;
}

export const runDeckEngine = calculateDeck;
