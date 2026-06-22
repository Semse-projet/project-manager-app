import { collect, isValid, oneOf, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";
import {
  computeConfidenceScore,
  computeDisputeRisk,
  computeReadinessScore,
  computePriceBands,
  buildProductionSchedule,
  buildScope,
  buildExplainedOutput,
  buildWarranty,
  assessHiddenDamageProbability,
  assessScheduleRisk,
  buildInspectionGate,
  buildAlgorithmTrace,
  computeSafeToProceed,
  ALGORITHM_VERSIONS,
} from "../core/extended-metrics.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SidingMaterial = "vinyl" | "insulated_vinyl" | "fiber_cement" | "wood" | "engineered_wood" | "metal";

export type SidingInput = {
  /** Total paintable/sideable wall area in sqft */
  wallSqFt: number;
  /** Stories of the structure */
  stories: 1 | 2 | 3;
  /** Type of siding material */
  sidingType: SidingMaterial;
  /** Remove existing siding before installing */
  removeOldSiding: boolean;
  /** Number of windows on siding surface */
  windowCount: number;
  /** Number of doors on siding surface */
  doorCount: number;
  /** Number of outside corners */
  corners: number;
  /** Visible water stains or damage on current siding */
  visibleWaterDamage: boolean;
  /** House wrap / weather barrier included */
  houseWrapIncluded: boolean;
  /** Current flashing condition */
  flashingCondition: "good" | "poor" | "unknown";
  /** Soffit and fascia included */
  soffitFasciaIncluded: boolean;
  /** Client already purchased materials */
  clientProvidesMaterials: boolean;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

// ── Material rates ─────────────────────────────────────────────────────────────

const MATERIAL_COST_PER_SQFT: Record<SidingMaterial, number> = {
  vinyl:           3.50,
  insulated_vinyl: 5.20,
  fiber_cement:    8.50,
  wood:            7.00,
  engineered_wood: 6.00,
  metal:           9.50,
};

const LABOR_COST_PER_SQFT: Record<SidingMaterial, number> = {
  vinyl:           3.00,
  insulated_vinyl: 3.50,
  fiber_cement:    6.00,
  wood:            5.50,
  engineered_wood: 4.50,
  metal:           7.00,
};

const WASTE_FACTOR: Record<SidingMaterial, number> = {
  vinyl:           0.10,
  insulated_vinyl: 0.10,
  fiber_cement:    0.12,
  wood:            0.15,
  engineered_wood: 0.12,
  metal:           0.08,
};

const SIDING_MATERIALS = ["vinyl", "insulated_vinyl", "fiber_cement", "wood", "engineered_wood", "metal"] as const;
const STORY_COUNTS = ["1", "2", "3"] as const;
const FLASHING_CONDITIONS = ["good", "poor", "unknown"] as const;
const TOOL_MODES = ["client", "professional", "admin"] as const;

function normalizePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeRange(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function normalizeOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

// ── Main engine ───────────────────────────────────────────────────────────────

export function calculateSiding(input: SidingInput): SemseToolResult {
  const issues = collect(
    oneOf("sidingType", input.sidingType, SIDING_MATERIALS, "Siding material"),
    oneOf("stories", String(input.stories), STORY_COUNTS, "Stories"),
    oneOf("flashingCondition", input.flashingCondition, FLASHING_CONDITIONS, "Flashing condition"),
    oneOf("mode", input.mode, TOOL_MODES, "Mode"),
    positive("wallSqFt", input.wallSqFt, "Wall area"),
    range("windowCount", input.windowCount, 0, 120, "Window count"),
    range("doorCount", input.doorCount, 0, 40, "Door count"),
    range("corners", input.corners, 0, 80, "Outside corners"),
    input.visibleWaterDamage
      ? warn("visibleWaterDamage", "Visible water damage increases probability of hidden moisture and sheathing damage.")
      : null,
    input.flashingCondition === "poor"
      ? warn("flashingCondition", "Poor flashing condition may require complete replacement — likely change order.")
      : null,
    input.flashingCondition === "unknown"
      ? warn("flashingCondition", "Unknown flashing condition: verify before final estimate.")
      : null,
    input.removeOldSiding
      ? warn("removeOldSiding", "Old siding removal creates an inspection gate — hidden conditions may trigger change orders.")
      : null,
    input.clientProvidesMaterials
      ? warn("clientProvidesMaterials", "Client-provided materials: verify product specs and coverage before installation.")
      : null,
    Number.isFinite(input.stories) && input.stories >= 2
      ? warn("stories", "Two-story or higher access increases labor cost and safety risk.")
      : null,
  );

  const sidingType = normalizeOneOf(input.sidingType, SIDING_MATERIALS, "vinyl");
  const stories = Number(normalizeOneOf(String(input.stories), STORY_COUNTS, "1")) as SidingInput["stories"];
  const flashingCondition = normalizeOneOf(input.flashingCondition, FLASHING_CONDITIONS, "unknown");
  const mode = normalizeOneOf(input.mode, TOOL_MODES, "professional");
  const wallSqFt = normalizePositive(input.wallSqFt, 100);
  const windowCount = Math.max(0, Math.round(normalizeRange(input.windowCount, 0, 120, 0)));
  const doorCount = Math.max(0, Math.round(normalizeRange(input.doorCount, 0, 40, 0)));
  const corners = Math.max(0, Math.round(normalizeRange(input.corners, 0, 80, 0)));

  // ── Area / materials ─────────────────────────────────────────────────────
  const wasteFactor   = WASTE_FACTOR[sidingType];
  const adjustedArea  = Math.round(wallSqFt * (1 + wasteFactor));
  const heightMult    = stories === 3 ? 1.35 : stories === 2 ? 1.18 : 1.0;
  const matCost       = MATERIAL_COST_PER_SQFT[sidingType];
  const laborCost     = LABOR_COST_PER_SQFT[sidingType];

  const removalCostPerSqFt = 1.20;
  const houseWrapCostPerSqFt = input.houseWrapIncluded ? 0.65 : 0;
  const flashingAllowancePerWindow = 85;
  const trimLinFt = Math.round(corners * 8 + windowCount * 6 + doorCount * 8);
  const trimCostPerFt = 4.50;

  const mats = input.clientProvidesMaterials
    ? [
        material("Professional labor (client materials)", adjustedArea, "sqft", laborCost * heightMult, "Labor"),
        material("Installation accessories (nails, adhesive, tape)", 1, "lot", adjustedArea * 0.35, "Accessories"),
      ]
    : [
        material(`${sidingType.replace("_", " ")} siding`, adjustedArea, "sqft", matCost, "Siding"),
        material("J-channel / starter strip", Math.ceil(wallSqFt / 100), "kit", 45, "Trim"),
        material("Corner posts", corners, "unit", 28, "Trim"),
        material("Window/door trim", windowCount + doorCount, "opening", 55, "Trim"),
        material("Fasteners / nails / tape", 1, "lot", adjustedArea * 0.18, "Accessories"),
        ...(input.houseWrapIncluded ? [material("House wrap / weather barrier", adjustedArea, "sqft", 0.65, "Moisture barrier")] : []),
        ...(input.soffitFasciaIncluded ? [material("Soffit / fascia boards", Math.ceil(wallSqFt / 80), "kit", 180, "Soffit/Fascia")] : []),
      ];

  const laborHours =
    (adjustedArea / 120 * 3) * heightMult +
    (input.removeOldSiding ? adjustedArea / 200 * 2 : 0) +
    (trimLinFt / 50) +
    (input.soffitFasciaIncluded ? 6 : 0);

  const laborBase = estimateLabor({
    baseHours:   laborHours,
    crewSize:    stories >= 2 ? 3 : 2,
    ratePerHour: sidingType === "fiber_cement" ? 85 : 70,
    difficulty:  stories >= 2 || input.visibleWaterDamage ? "complex" : "moderate",
    notes: [
      `Material: ${sidingType} — ${adjustedArea} sqft (incl. ${Math.round(wasteFactor * 100)}% waste)`,
      `Stories: ${stories} — height multiplier: ${heightMult}x`,
      `Trim: ${trimLinFt} lin.ft`,
    ],
  });

  const removalCost      = input.removeOldSiding ? Math.round(wallSqFt * removalCostPerSqFt) : 0;
  const flashingCost     = Math.round(windowCount * flashingAllowancePerWindow);
  const hiddenDamageAllowance = input.visibleWaterDamage ? Math.round(wallSqFt * 0.85) : 0;

  const costs = buildCostSummary(
    materialTotal(mats) + removalCost + flashingCost + hiddenDamageAllowance,
    laborBase.totalCost,
    { overhead: 0.15, profit: 0.22, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: wallSqFt }
  );

  // ── Risk ──────────────────────────────────────────────────────────────────
  const risk = computeRisk(
    [
      factor("visibleWaterDamage",  "Visible water damage",          0.25, input.visibleWaterDamage),
      factor("removeOldSiding",     "Old siding removal",            0.18, input.removeOldSiding),
      factor("flashingPoor",        "Poor flashing condition",       0.15, flashingCondition === "poor"),
      factor("flashingUnknown",     "Unknown flashing condition",    0.10, flashingCondition === "unknown"),
      factor("twoStory",            "Two-story or higher access",    0.12, stories >= 2),
      factor("threeStory",          "Three-story — high access risk",0.12, stories === 3),
      factor("fiberCement",         "Fiber cement — heavier labor",  0.06, sidingType === "fiber_cement"),
      factor("clientMaterials",     "Client-provided materials",     0.08, input.clientProvidesMaterials),
      factor("noHouseWrap",         "House wrap not included",       0.08, !input.houseWrapIncluded),
    ],
    {
      requiresPermit:      false,
      requiresLicense:     false,
      requiresInspection:  input.removeOldSiding || input.visibleWaterDamage,
      requiresEngineering: false,
    }
  );

  // ── Inspection gate (critical for siding) ─────────────────────────────────
  const inspectionGate = (input.removeOldSiding || input.visibleWaterDamage)
    ? buildInspectionGate(
        "After old siding removal — inspect sheathing, framing, and moisture barrier before continuing",
        [
          "Post-removal photos of every elevation",
          "Close-up photos of sheathing condition",
          "Photos of window/door areas",
          "Moisture reading if available",
        ],
        "Sheathing, framing, or moisture damage found after removal"
      )
    : null;

  // ── Milestones ────────────────────────────────────────────────────────────
  const milestoneNames = [
    ...(input.removeOldSiding ? ["Removal & hidden condition inspection"] : []),
    "House wrap & flashing",
    "Siding installation",
    ...(input.soffitFasciaIncluded ? ["Soffit & fascia"] : []),
    "Trim, corners & final cleanup",
  ];

  const milestoneDocs = [
    ...(input.removeOldSiding ? [[
      "Before photos of all elevations",
      "Post-removal sheathing photos",
      "Hidden damage documentation",
      "Client approval before continuing",
    ]] : []),
    [
      "House wrap installed photos",
      "Window flashing photos",
      "Door flashing photos",
    ],
    [
      "Siding progress photos by elevation",
      "Corner installation photos",
    ],
    ...(input.soffitFasciaIncluded ? [["Soffit/fascia photos"]] : []),
    [
      "Final photos — all elevations",
      "Trim detail photos",
      "Cleanup photos",
      "Client approval",
    ],
  ];

  const milestones = buildMilestones(costs.total, risk.level, milestoneNames, milestoneDocs);

  const evidence = buildEvidenceChecklist("siding", risk, milestones, [
    { type: "photo",      description: "Full exterior photos — all elevations before start", required: true, milestone: 1 },
    { type: "photo",      description: "Window/door closeups — existing trim and flashing",  required: true, milestone: 1 },
    ...(input.visibleWaterDamage ? [{ type: "photo" as const, description: "Water damage closeups", required: true, milestone: 1 }] : []),
    ...(input.removeOldSiding ? [{ type: "photo" as const, description: "Post-removal sheathing condition", required: true, milestone: 2 }] : []),
    { type: "photo",      description: "House wrap installed",                               required: input.houseWrapIncluded, milestone: 2 },
    { type: "photo",      description: "Final elevation photos",                             required: true, milestone: milestoneNames.length },
    { type: "inspection", description: "Client walkthrough and approval",                    required: true, milestone: milestoneNames.length },
  ] as EvidenceItem[]);

  // ── Extended metrics ──────────────────────────────────────────────────────
  const confidenceScore = computeConfidenceScore({
    hasMeasurements:      wallSqFt > 0,
    hasPhotos:            false,
    hasConditionData:     flashingCondition !== "unknown",
    hasMaterialSelection: true,
    hasScopeConfirmed:    true,
    clientProvidesMaterials: input.clientProvidesMaterials,
    hasUnknownConditions: flashingCondition === "unknown" || (input.visibleWaterDamage && input.removeOldSiding),
    extraConfirmedFields: [
      input.houseWrapIncluded,
      input.soffitFasciaIncluded,
      !input.clientProvidesMaterials,
      flashingCondition === "good",
    ].filter(Boolean).length,
  });

  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous:          false,
    clientProvidesMaterials: input.clientProvidesMaterials,
    noPhotosRequired:        false,
    hasChangeOrderPolicy:    true,
    hasEvidenceRequired:     true,
    hasMilestones:           milestones.length > 0,
    hasHighRiskConditions:   input.visibleWaterDamage || stories >= 2,
    priceIsFixed:            false,
    clientExpectationMismatch: input.visibleWaterDamage && !input.removeOldSiding,
  });

  const readinessScore = computeReadinessScore({
    measurementsConfirmed:  wallSqFt > 0,
    materialsAvailable:     !input.clientProvidesMaterials,
    siteAccessConfirmed:    true,
    permitsAddressed:       true,
    scopeApproved:          true,
    depositPaid:            false,
    clientApproval:         false,
    otherTradesCoordinated: !input.removeOldSiding,
  });

  const priceBands = computePriceBands(
    costs.total,
    0.72,
    1.50,
    {
      low:  "Simple vinyl replacement, no removal, no water damage, single story.",
      mid:  "Standard replacement with removal, house wrap and flashing.",
      high: "Multi-story, fiber cement, water damage, sheathing replacement needed.",
    }
  );

  const productionSchedule = buildProductionSchedule([
    { name: "Site prep & protection",           daysMin: 0, daysMax: 1, crew: 2, description: "Protect windows, landscaping, grade" },
    ...(input.removeOldSiding ? [{ name: "Old siding removal & inspection", daysMin: 1, daysMax: 2, crew: 2, description: "Remove old siding, document sheathing condition" }] : []),
    { name: "House wrap & flashing",            daysMin: 1, daysMax: 2, crew: 2, description: "Install moisture barrier, flash windows and doors" },
    { name: "Siding installation",              daysMin: 2, daysMax: 5, crew: 2, description: "Install siding panels by elevation" },
    ...(input.soffitFasciaIncluded ? [{ name: "Soffit & fascia", daysMin: 1, daysMax: 2, crew: 2, description: "Install soffit and fascia" }] : []),
    { name: "Trim, corners & final cleanup",    daysMin: 1, daysMax: 2, crew: 2, description: "Install trim, corners, caulk, cleanup" },
  ]);

  const scope = buildScope(
    [
      `${sidingType.replace("_", " ")} siding installation — ${wallSqFt} sqft`,
      ...(input.removeOldSiding ? ["Old siding removal and disposal"] : []),
      ...(input.houseWrapIncluded ? ["House wrap / weather barrier"] : []),
      `Window and door flashing (${windowCount + doorCount} openings)`,
      `Outside corners (${corners}) and trim`,
      "J-channel and starter strips",
      ...(input.soffitFasciaIncluded ? ["Soffit and fascia"] : []),
      "Basic cleanup",
    ],
    [
      "Sheathing or framing repair (hidden damage — change order if found)",
      "Window or door replacement",
      "Permit fees",
      "Roofing or gutter work",
      ...(input.houseWrapIncluded ? [] : ["House wrap / weather barrier"]),
      ...(input.soffitFasciaIncluded ? [] : ["Soffit and fascia"]),
      "Interior work",
      "Painting (fiber cement must be painted — separate quote)",
    ],
    [
      `Standard waste factor applied: ${Math.round(wasteFactor * 100)}%`,
      "Flashing for windows and doors included at standard detail",
      `Height multiplier applied for ${stories}-story structure`,
    ],
    [
      "Hidden sheathing or framing damage after removal",
      "Existing moisture damage worse than visible",
      "Window flashing failure requiring full rebuild",
      "Rot or structural damage at grade level",
      "Additional trim or architectural details",
      "Client changes material selection",
    ]
  );

  const explained = buildExplainedOutput(
    `Your ${sidingType.replace("_", " ")} siding project (${wallSqFt} sqft, ${stories} ${stories === 1 ? "story" : "stories"}) is estimated at $${Math.round(costs.total).toLocaleString()}. ` +
    `${input.removeOldSiding ? "This includes removing existing siding with a mandatory inspection milestone before continuing. " : ""}` +
    `${input.visibleWaterDamage ? "IMPORTANT: Visible water damage increases the probability of hidden issues. A change order may be needed. " : ""}` +
    `Payments are released by milestone with photo evidence required at each stage.`,
    [
      `Material: ${sidingType} — ${adjustedArea} sqft (${Math.round(wasteFactor * 100)}% waste) — $${matCost}/sqft`,
      `Labor: ${laborBase.hours.toFixed(1)} hrs × ${stories >= 2 ? "3-person crew" : "2-person crew"} — height mult: ${heightMult}x`,
      ...(input.removeOldSiding ? ["INSPECTION GATE: Do not continue past removal without documenting sheathing. Hidden damage = change order."] : []),
      ...(input.visibleWaterDamage ? ["WATER DAMAGE: Budget $800–$2,500 for potential sheathing replacement — cannot confirm until after removal."] : []),
      flashingCondition === "unknown"
        ? "FLASHING UNKNOWN: Inspect all window/door flashing before installing new siding. Poor condition = change order."
        : `Flashing condition: ${flashingCondition}`,
      ...(stories >= 2 ? ["HEIGHT: Scaffold or lift recommended — factor in setup/breakdown time."] : []),
      "FIBER CEMENT NOTE: Requires paint finish coat (separate quote) — factor into total project budget." + (sidingType === "fiber_cement" ? " ← ACTIVE" : " (not applicable)"),
    ]
  );

  const warranty = buildWarranty(
    365,
    `${sidingType.replace("_", " ")} siding installation — labor warranty on installation and flashing`,
    [
      "Manufacturer defects in siding material",
      "Structural settlement or movement",
      "Hidden moisture damage that was present before installation",
      "Damage from impact, storms, or improper maintenance",
      "Paint or finish on fiber cement (separate warranty)",
    ]
  );

  const hiddenDamage = assessHiddenDamageProbability(
    undefined,
    input.visibleWaterDamage,
    input.visibleWaterDamage,
    input.removeOldSiding,
    true,
    false
  );

  const scheduleRisk = assessScheduleRisk({
    dependsOnOtherTrades: input.removeOldSiding,
    clientMustDecide:     input.clientProvidesMaterials,
    materialsOnSite:      !input.clientProvidesMaterials,
    weatherDependent:     true,
    scopeIsLarge:         wallSqFt > 2000,
    hasComplexDetails:    sidingType === "fiber_cement" || stories >= 2,
  });

  const safeToProceed = computeSafeToProceed({
    hasMinimalData:      wallSqFt > 0,
    readinessScore:      readinessScore.score,
    hasCriticalBlockers: false,
    hasMilestones:       milestones.length > 0,
    hasEvidencePlan:     evidence.items.length > 0,
    confidenceScore:     confidenceScore.score,
    noCriticalBlockers:  true,
    scopeIsComplete:     !input.clientProvidesMaterials && flashingCondition !== "unknown",
  });

  const trace = buildAlgorithmTrace(
    ALGORITHM_VERSIONS.siding,
    "siding",
    ["wallSqFt", "stories", "sidingType", "removeOldSiding", "windowCount", "flashingCondition"],
    [
      ...(!input.houseWrapIncluded ? ["houseWrapIncluded — not selected"] : []),
      ...(flashingCondition === "unknown" ? ["flashingCondition — unknown"] : []),
    ],
    [
      `Waste factor: ${Math.round(wasteFactor * 100)}%`,
      `Height multiplier: ${heightMult}x for ${stories} stories`,
      "Flashing allowance per opening: $85",
    ],
    [
      { ruleId: "WATER_DAMAGE_RISK",    label: "Visible water damage",   triggered: input.visibleWaterDamage,           points: 25, reason: "Water damage increases hidden moisture risk" },
      { ruleId: "OLD_SIDING_REMOVAL",   label: "Removal required",       triggered: input.removeOldSiding,              points: 18, reason: "Creates inspection gate and potential change orders" },
      { ruleId: "FLASHING_POOR",        label: "Poor flashing",          triggered: flashingCondition === "poor",       points: 15, reason: "Likely change order for flashing rebuild" },
      { ruleId: "TWO_STORY",            label: "Two-story+ access",      triggered: stories >= 2,                       points: 12, reason: "Increases labor cost and safety risk" },
      { ruleId: "CLIENT_MATERIALS",     label: "Client materials",       triggered: input.clientProvidesMaterials,      points: 8,  reason: "Product compatibility risk" },
    ]
  );

  const warnings: string[] = [
    ...(input.visibleWaterDamage ? ["Visible water damage: $800–$2,500 hidden repair allowance recommended."] : []),
    ...(flashingCondition !== "good" ? ["Flashing condition should be verified before final estimate."] : []),
    ...(input.removeOldSiding ? ["Inspection gate: no additional work until sheathing documented and client approves."] : []),
    ...(sidingType === "fiber_cement" ? ["Fiber cement requires paint finish — budget separately."] : []),
    ...(stories >= 2 ? ["Two-story access: plan for proper scaffolding or lift."] : []),
  ];

  return {
    toolId:           `siding-${Date.now()}`,
    trade:            "siding",
    projectType:      `${sidingType}-siding-installation`,
    mode,
    inputs:           { ...input },
    validationIssues: issues,
    isValid:          isValid(issues),
    materials:        mats,
    labor:            laborBase,
    costs,
    risk,
    milestones,
    evidenceRequired: evidence.items,
    warnings,
    recommendations: [
      "Take full exterior photos before starting.",
      "Verify flashing condition on all windows and doors before installation.",
      ...(input.removeOldSiding ? ["Do not install house wrap until sheathing is inspected and documented."] : []),
      ...(input.visibleWaterDamage ? ["Add hidden damage allowance to contract. Client must approve change order if found."] : []),
      ...(sidingType === "fiber_cement" ? ["Coordinate paint contractor before scheduling siding job."] : []),
    ],
    assumptions: [
      "Standard rectangular wall sections assumed.",
      "Flashing included at all window and door openings at standard detail.",
      "Debris disposal and cleanup included.",
    ],
    // Extended metrics
    confidenceScore,
    disputeRisk,
    readinessScore,
    priceBands,
    productionSchedule,
    scope,
    explained,
    warranty,
    hiddenDamageAssessment: hiddenDamage,
    scheduleRisk,
    algorithmTrace: trace,
    // Siding-specific: inspection gate
    upsells: [
      ...(input.soffitFasciaIncluded ? [] : [{ service: "Soffit & fascia replacement", reason: "Crews are already set up with ladders — ideal time to replace.", additionalCostRange: { min: 1200, max: 3500 } }]),
      ...(flashingCondition !== "good" ? [{ service: "Full window flashing upgrade", reason: "Flashing is the #1 cause of water damage. Upgrade while siding is off." }] : []),
      { service: "Exterior paint (fiber cement only)", reason: "Fiber cement requires paint — schedule the same week for best pricing." },
    ],
    roi: {
      investmentAmount:      costs.total,
      estimatedValueAdded:   Math.round(costs.total * 1.45),
      roiPercent:            45,
      paybackPeriodMonths:   undefined,
      notes:                 "New siding typically adds 70-80% of installation cost in home value and reduces energy costs.",
    },
    createdAt: new Date().toISOString(),
  } satisfies SemseToolResult;
}

export const runSidingEngine = calculateSiding;
