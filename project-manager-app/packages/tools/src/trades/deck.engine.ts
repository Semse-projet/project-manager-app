import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal, priceOf } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";

export type DeckInput = {
  deckLengthFt: number;
  deckWidthFt: number;
  materialType: "pressureTreated" | "cedar" | "composite" | "tropicalHardwood";
  joistSpacingIn: 12 | 16 | 24;
  postCount: number;
  railingLinearFt: number;
  stairsCount: number;
  demoExisting: boolean;
  stainSeal: boolean;
  mode: ToolMode;
  prices?: MaterialPriceMap;
};

const DECK_SURFACE_COST: Record<DeckInput["materialType"], number> = {
  pressureTreated: 4.4,
  cedar: 6.2,
  composite: 9.8,
  tropicalHardwood: 12.4,
};

const JOIST_COST: Record<DeckInput["joistSpacingIn"], number> = {
  12: 4.2,
  16: 3.6,
  24: 3.0,
};

export function calculateDeck(input: DeckInput): SemseToolResult {
  const issues = collect(
    positive("deckLengthFt", input.deckLengthFt, "Largo del deck"),
    positive("deckWidthFt", input.deckWidthFt, "Ancho del deck"),
    range("postCount", input.postCount, 2, 100, "Post count"),
    range("railingLinearFt", input.railingLinearFt, 0, 500, "Railing"),
    range("stairsCount", input.stairsCount, 0, 20, "Stairs"),
    input.materialType === "tropicalHardwood"
      ? warn("materialType", "Madera tropical: revisar disponibilidad, aclimatación y costo.")
      : null,
    input.demoExisting
      ? warn("demoExisting", "Demo de deck existente: validar estructura, footing y disposición.")
      : null,
    input.deckWidthFt > 12 && input.joistSpacingIn === 24
      ? warn("joistSpacingIn", "Ancho grande con joist spacing 24: revisar deflexión y carga.")
      : null,
  );

  const deckAreaSqFt = input.deckLengthFt * input.deckWidthFt;
  const adjustedArea = deckAreaSqFt * (1 + (input.materialType === "composite" ? 0.08 : 0.12) + (input.demoExisting ? 0.03 : 0));
  const deckBoards = Math.max(1, Math.ceil(adjustedArea / 5.5));
  const joistCount = Math.max(1, Math.ceil(input.deckLengthFt / (input.joistSpacingIn / 12)));
  const postBases = Math.max(2, input.postCount);
  const railKits = input.railingLinearFt > 0 ? Math.max(1, Math.ceil(input.railingLinearFt / 8)) : 0;
  const stairKits = input.stairsCount > 0 ? Math.max(1, input.stairsCount) : 0;
  const stainKits = input.stainSeal ? Math.max(1, Math.ceil(deckAreaSqFt / 200)) : 0;

  const deckBoardCost = (input.materialType === "pressureTreated" || input.materialType === "cedar")
    ? priceOf(input.prices, "lumber-framing", DECK_SURFACE_COST[input.materialType])
    : DECK_SURFACE_COST[input.materialType];
  const joistCost = priceOf(input.prices, "lumber-framing", JOIST_COST[input.joistSpacingIn]);
  const mats = [
    material(`${input.materialType} decking`, deckBoards, "board", deckBoardCost, "Decking"),
    material(`Joists @ ${input.joistSpacingIn}"`, joistCount, "piece", joistCost, "Framing"),
    material("Post bases / anchors", postBases, "set", 18, "Support"),
    ...(railKits > 0 ? [material("Railing kit", railKits, "kit", 145, "Safety")] : []),
    ...(stairKits > 0 ? [material("Stair kit / stringers", stairKits, "kit", 85, "Access")] : []),
    material("Fasteners / brackets / hangers", Math.max(1, Math.ceil(deckAreaSqFt / 120)), "kit", 26, "Hardware"),
    ...(input.demoExisting ? [material("Deck demo / disposal", Math.max(1, Math.ceil(deckAreaSqFt / 180)), "job", 48, "Demo")] : []),
    ...(stainKits > 0 ? [material("Stain / sealant", stainKits, "gal", 34, "Finish")] : []),
  ];

  const labor = estimateLabor({
    baseHours:
      5 +
      adjustedArea / 28 +
      input.postCount * 0.5 +
      (input.railingLinearFt > 0 ? input.railingLinearFt / 18 : 0) +
      input.stairsCount * 1.4 +
      (input.demoExisting ? 3 : 0) +
      (input.materialType === "composite" ? 2 : 0) +
      (input.materialType === "tropicalHardwood" ? 3.25 : 0),
    crewSize: adjustedArea > 300 ? 3 : 2,
    ratePerHour: input.materialType === "composite" || input.materialType === "tropicalHardwood" ? 72 : 60,
    difficulty:
      input.materialType === "tropicalHardwood" || input.demoExisting || input.stairsCount > 2
        ? "complex"
        : "moderate",
    notes: [
      `Área base: ${deckAreaSqFt.toFixed(1)} sqft`,
      `Área ajustada: ${adjustedArea.toFixed(1)} sqft`,
      input.stainSeal ? "Incluye stain/seal." : "Sin stain/seal.",
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: input.materialType === "composite" || input.demoExisting ? 0.16 : 0.14,
    profit: 0.2,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: deckAreaSqFt || 1,
  });

  const risk = computeRisk(
    [
      factor("composite", "Composite deck", 0.10, input.materialType === "composite"),
      factor("hardwood", "Tropical hardwood", 0.16, input.materialType === "tropicalHardwood"),
      factor("demo", "Existing deck demo", 0.12, input.demoExisting),
      factor("rails", "Railing required", 0.14, input.railingLinearFt > 0),
      factor("stairs", "Stairs present", 0.16, input.stairsCount > 0),
      factor("wide_span", "Wide span", 0.10, input.deckWidthFt > 14),
    ],
    {
      requiresPermit: deckAreaSqFt > 200 || input.railingLinearFt > 0 || input.stairsCount > 0,
      requiresLicense: input.stairsCount > 0 || input.materialType === "tropicalHardwood",
      requiresInspection: true,
      requiresEngineering: input.deckWidthFt > 16 || input.stairsCount > 3,
    }
  );

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    ["Demo and layout", "Footings and framing", "Decking and rail", "Finish and handoff"],
    [
      ["Photos of existing deck removal", "Layout confirmation"],
      ["Photos of footings and frame", "Level / square check"],
      ["Photos of decking and railing", "Fastener verification"],
      ["Final photos", "Client approval"],
    ]
  );

  const evidence = buildEvidenceChecklist("deck", risk, milestones, [
    { type: "photo", description: "Demo / site prep", required: input.demoExisting, milestone: 1 },
    { type: "measurement", description: "Footing / frame level and square", required: true, milestone: 2 },
    { type: "photo", description: "Decking / railing install", required: true, milestone: 3 },
    { type: "inspection", description: "Final safe access and handoff", required: true, milestone: 4 },
  ]);

  const warnings: string[] = [
    ...(input.demoExisting ? ["Existing deck demo: check hidden damage and footing before rebuild."] : []),
    ...(input.railingLinearFt > 0 ? ["Railing required: verify height, posts and code compliance."] : []),
    ...(input.stairsCount > 0 ? ["Stairs present: confirm rise/run and landing details."] : []),
    ...(input.materialType === "tropicalHardwood" ? ["Tropical hardwood: allow acclimation and control fasteners."] : []),
  ];

  const recommendations: string[] = [
    "Verify footing, joist spacing and framing before decking.",
    "Capture photos of frame, rail and stairs before closeout.",
    "Hold escrow until safe access and final approval are documented.",
    ...(input.stainSeal ? ["Seal or stain only after the deck is dry and clean."] : []),
  ];

  const evidenceRequired: EvidenceItem[] = evidence.items;

  return {
    toolId: `deck-${Date.now()}`,
    trade: "deck",
    projectType: input.demoExisting ? "deck-remodel" : "new-deck",
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
      "Deck pricing is approximate for the 2026 U.S. market.",
      "Code compliance may vary by locality and railing/guard requirements.",
      "Structural engineering is not included unless explicitly scoped.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runDeckEngine = calculateDeck;
