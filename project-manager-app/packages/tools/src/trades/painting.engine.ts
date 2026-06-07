import { collect, isValid, oneOf, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";
import {
  buildInspectionGate,
  assessHiddenDamageProbability,
  assessScheduleRisk,
  computeConfidenceScore,
  computeDisputeRisk,
  computeReadinessScore,
  computePriceBands,
  buildScope,
  buildExplainedOutput,
  buildWarranty,
  computeSafeToProceed,
  ALGORITHM_VERSIONS,
  buildAlgorithmTrace,
  buildProductionSchedule,
} from "../core/extended-metrics.js";

export type PaintingInput = {
  roomLengthFt: number;
  roomWidthFt: number;
  wallHeightFt: number;
  doors: number;
  windows: number;
  coats: number;
  surfaceType: "smooth" | "textured" | "newDrywall" | "exterior";
  includeCeiling: boolean;
  includePrimer: boolean;
  paintQuality: "economy" | "standard" | "premium";
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const SURFACE_TYPES = ["smooth", "textured", "newDrywall", "exterior"] as const;
const PAINT_QUALITIES = ["economy", "standard", "premium"] as const;
const TOOL_MODES = ["client", "professional", "admin"] as const;

const SURFACE_MULTIPLIERS: Record<PaintingInput["surfaceType"], number> = {
  smooth: 1.0,
  textured: 1.15,
  newDrywall: 1.1,
  exterior: 1.2,
};

const QUALITY_UNIT_COST: Record<PaintingInput["paintQuality"], number> = {
  economy: 28,
  standard: 42,
  premium: 58,
};

const PRIMER_UNIT_COST: Record<PaintingInput["paintQuality"], number> = {
  economy: 22,
  standard: 28,
  premium: 35,
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

export function calculatePainting(input: PaintingInput): SemseToolResult {
  const issues = collect(
    oneOf("surfaceType", input.surfaceType, SURFACE_TYPES, "Tipo de superficie"),
    oneOf("paintQuality", input.paintQuality, PAINT_QUALITIES, "Calidad de pintura"),
    oneOf("mode", input.mode, TOOL_MODES, "Mode"),
    positive("roomLengthFt", input.roomLengthFt, "Largo del cuarto"),
    positive("roomWidthFt", input.roomWidthFt, "Ancho del cuarto"),
    positive("wallHeightFt", input.wallHeightFt, "Altura de muros"),
    range("doors", input.doors, 0, 20, "Puertas"),
    range("windows", input.windows, 0, 20, "Ventanas"),
    range("coats", input.coats, 1, 4, "Capas"),
    input.surfaceType === "newDrywall" && !input.includePrimer
      ? warn("includePrimer", "Nuevo drywall sin primer: riesgo de absorción y acabado irregular.")
      : null,
    input.surfaceType === "exterior" && input.paintQuality === "economy"
      ? warn("paintQuality", "Exterior con pintura economy: menor durabilidad esperada.")
      : null,
  );

  const surfaceType = normalizeOneOf(input.surfaceType, SURFACE_TYPES, "smooth");
  const paintQuality = normalizeOneOf(input.paintQuality, PAINT_QUALITIES, "standard");
  const mode = normalizeOneOf(input.mode, TOOL_MODES, "professional");
  const roomLengthFt = normalizePositive(input.roomLengthFt, 1);
  const roomWidthFt = normalizePositive(input.roomWidthFt, 1);
  const wallHeightFt = normalizePositive(input.wallHeightFt, 8);
  const doors = Math.max(0, Math.round(normalizeRange(input.doors, 0, 20, 0)));
  const windows = Math.max(0, Math.round(normalizeRange(input.windows, 0, 20, 0)));
  const coats = Math.max(1, Math.round(normalizeRange(input.coats, 1, 4, 2)));

  const perimeterFt = 2 * (roomLengthFt + roomWidthFt);
  const wallAreaSqFt = perimeterFt * wallHeightFt;
  const ceilingAreaSqFt = input.includeCeiling ? roomLengthFt * roomWidthFt : 0;
  const openingsSqFt = doors * 20 + windows * 15;
  const rawPaintArea = Math.max(0, wallAreaSqFt + ceilingAreaSqFt - openingsSqFt);
  const adjustedArea = rawPaintArea * SURFACE_MULTIPLIERS[surfaceType];
  const totalCoatArea = adjustedArea * coats;
  const gallonsNeeded = Math.max(1, Math.ceil(totalCoatArea / 350));
  const primerGallons = input.includePrimer ? Math.max(1, Math.ceil(adjustedArea / 350)) : 0;

  const mats = [
    material(`${paintQuality} interior paint`, gallonsNeeded, "gal", QUALITY_UNIT_COST[paintQuality], "Finish"),
    ...(input.includePrimer
      ? [material("Primer", primerGallons, "gal", PRIMER_UNIT_COST[paintQuality], "Prep")]
      : []),
    material("Painter's tape / masking", Math.max(1, Math.ceil(adjustedArea / 700)), "roll", 7.5, "Prep"),
    material("Drop cloths / plastic", Math.max(1, Math.ceil(adjustedArea / 900)), "set", 18, "Protection"),
    material("Patch / caulk / sanding supplies", Math.max(2, Math.ceil(adjustedArea / 500)), "kit", 16, "Prep"),
    ...(surfaceType === "exterior"
      ? [material("Exterior coating add-on", Math.max(1, Math.ceil(adjustedArea / 400)), "gal", 12, "Exterior")]
      : []),
  ];

  const labor = estimateLabor({
    baseHours: 4 + (adjustedArea / 100) * 1.6 + doors * 0.35 + windows * 0.45 + (input.includeCeiling ? 1.75 : 0) + (surfaceType === "textured" ? 1.5 : 0),
    crewSize: adjustedArea > 1200 ? 3 : 2,
    ratePerHour: surfaceType === "exterior" ? 58 : 52,
    difficulty: surfaceType === "exterior" || surfaceType === "textured" ? "complex" : "moderate",
    notes: [
      `Área ajustada: ${adjustedArea.toFixed(1)} sqft`,
      `Capas: ${coats}`,
      input.includePrimer ? "Incluye primer." : "Sin primer.",
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: surfaceType === "exterior" ? 0.16 : 0.14,
    profit: 0.2,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: adjustedArea || 1,
  });

  const risk = computeRisk([
    factor("new_drywall", "Drywall nuevo", 0.16, surfaceType === "newDrywall"),
    factor("exterior", "Exterior", 0.18, surfaceType === "exterior"),
    factor("textured", "Superficie texturizada", 0.12, surfaceType === "textured"),
    factor("no_primer", "Sin primer", 0.14, !input.includePrimer),
    factor("high_openings", "Múltiples aperturas", 0.08, doors + windows > 6),
  ], {
    requiresPermit: surfaceType === "exterior",
    requiresLicense: false,
    requiresInspection: surfaceType === "exterior" && paintQuality === "premium",
    requiresEngineering: false,
  });

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    ["Protección y preparación", "Primer y primera capa", "Segunda capa / detalles", "Limpieza y entrega"],
    [
      ["Fotos de protección de muebles", "Fotos de reparación superficial"],
      ["Fotos de primer aplicado", "Fotos de primera capa"],
      ["Fotos de segunda capa", "Verificación de cobertura"],
      ["Fotos finales", "Firma del cliente"],
    ]
  );

  const evidence = buildEvidenceChecklist("painting", risk, milestones, [
    { type: "photo", description: "Estado previo y protección del área", required: true, milestone: 1 },
    { type: "photo", description: "Primer / primera capa", required: input.includePrimer, milestone: 2 },
    { type: "photo", description: "Resultado final", required: true, milestone: 4 },
  ]);

  const warnings: string[] = [
    ...(surfaceType === "newDrywall" && !input.includePrimer ? ["Nuevo drywall sin primer puede requerir una capa adicional."] : []),
    ...(surfaceType === "exterior" ? ["Exterior: revisar clima, humedad y protección UV."] : []),
    ...(doors + windows > 6 ? ["Muchas aperturas: aumentar tiempo de masking y retoques."] : []),
  ];

  const recommendations: string[] = [
    "Confirmar color y acabado con el cliente antes de iniciar.",
    "Documentar preparación de superficie y reparación de imperfecciones.",
    "Tomar fotos antes/después para validar el cierre del hito.",
    ...(input.includePrimer ? [] : ["Considerar primer para mejorar adhesión y uniformidad."]),
  ];

  const evidenceRequired: EvidenceItem[] = evidence.items;

  const evidenceRequiredList = evidenceRequired;

  // ── Extended metrics ──────────────────────────────────────────────────────
  const netPaintSqFt = Math.round(adjustedArea);
  const isExterior     = surfaceType === "exterior";
  const hasRisk        = surfaceType === "newDrywall" || surfaceType === "textured";
  const highQuality    = paintQuality === "premium";

  const confidenceScore = computeConfidenceScore({
    hasMeasurements:      roomLengthFt > 0 && roomWidthFt > 0,
    hasPhotos:            false,
    hasConditionData:     true,
    hasMaterialSelection: true,
    hasScopeConfirmed:    true,
    hasUnknownConditions: false,
    extraConfirmedFields: [
      input.includeCeiling !== undefined ? 1 : 0,
      input.includePrimer  !== undefined ? 1 : 0,
      coats > 0 ? 1 : 0,
    ].reduce((a, b) => a + b, 0),
  });

  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous:          false,
    clientProvidesMaterials: false,
    noPhotosRequired:        false,
    hasChangeOrderPolicy:    true,
    hasEvidenceRequired:     true,
    hasMilestones:           milestones.length > 0,
    hasHighRiskConditions:   hasRisk || isExterior,
    priceIsFixed:            true,
    clientExpectationMismatch: coats === 1 && surfaceType === "newDrywall",
  });

  const readinessScore = computeReadinessScore({
    measurementsConfirmed:  roomLengthFt > 0,
    materialsAvailable:     true,
    siteAccessConfirmed:    true,
    permitsAddressed:       true,
    scopeApproved:          true,
    depositPaid:            false,
    clientApproval:         false,
  });

  const priceBands = computePriceBands(
    costs.total,
    0.78,
    1.35,
    {
      low:  "Smooth surfaces, economy paint, no primer, no repairs.",
      mid:  "Standard conditions, quality paint, 2 coats, basic prep.",
      high: "New drywall, primer required, exterior, premium paint, repairs needed.",
    }
  );

  const productionSchedule = buildProductionSchedule([
    { name: "Prep & protection",  daysMin: 0, daysMax: 1, crew: 1, description: "Protect floors, furniture, tape trim" },
    ...(input.includePrimer ? [{ name: "Primer coat", daysMin: 0, daysMax: 1, crew: 1, description: "Prime — allow to dry 4-6 hrs" }] : []),
    { name: "Paint application",  daysMin: 0, daysMax: 2, crew: coats >= 3 ? 2 : 1, description: `${coats} coat(s) — allow 2-4 hrs between coats` },
    { name: "Cleanup & walkthrough", daysMin: 0, daysMax: 0, crew: 1, description: "Touch-ups, remove tape/plastic, final photos" },
  ]);

  const scope = buildScope(
    [
      `${netPaintSqFt} sqft paintable area (${roomLengthFt}×${roomWidthFt} ft, ${wallHeightFt} ft walls)`,
      `${coats} coat(s) — ${paintQuality} quality paint`,
      ...(input.includePrimer ? ["Primer coat included"] : []),
      ...(input.includeCeiling ? ["Ceiling included"] : []),
      "Floor and furniture protection",
      "Painter's tape on trim",
      "Basic cleanup",
    ],
    [
      "Major drywall repair",
      "Trim/baseboard painting",
      "Doors (unless in scope)",
      "Exterior of windows",
      "Carpet or floor treatment",
      "Mold remediation",
      "Lead paint remediation (if applicable)",
      ...(input.includeCeiling ? [] : ["Ceiling"]),
    ],
    [
      `Surface type: ${surfaceType} — multiplier applied`,
      `${doors} doors and ${windows} windows deducted from area`,
    ],
    [
      "Major wall damage discovered during prep",
      "Client changes color after work begins",
      "Additional coats needed due to dark-to-light change",
      "Ceiling added after approval",
      "Trim/baseboards requested after approval",
    ]
  );

  const explained = buildExplainedOutput(
    `Your painting project (${netPaintSqFt} sqft, ${coats} coat(s)) is estimated at $${Math.round(costs.total).toLocaleString()} using ${paintQuality} paint. ` +
    `${input.includePrimer ? "Primer is included. " : ""}` +
    `${surfaceType === "newDrywall" ? "New drywall requires careful prep — primer is strongly recommended. " : ""}` +
    `Payments are structured by milestone with photo evidence at each stage.`,
    [
      `Area: ${netPaintSqFt} sqft — ${coats} coats — ${paintQuality} paint — surface: ${surfaceType}`,
      ...(surfaceType === "newDrywall" ? ["NEW DRYWALL: must prime before painting or topcoat may not adhere properly."] : []),
      ...(surfaceType === "exterior" ? ["EXTERIOR: check weather forecast 48hrs ahead. No painting below 50°F or above 90°F."] : []),
      ...(coats === 1 ? ["1 COAT: verify surface color is similar — 1 coat on a dark color will show bleed-through."] : []),
      "BEFORE PHOTOS are mandatory — document existing damage to avoid dispute responsibility.",
    ]
  );

  const warranty = buildWarranty(
    90,
    "Interior/exterior painting — labor warranty on paint application and prep",
    [
      "Paint fading or chalking from UV exposure (manufacturer warranty)",
      "Damage from moisture, flooding, or structural movement",
      "Touch-up needed due to normal wall use after completion",
      "Color shift due to lighting conditions (not workmanship)",
    ]
  );

  const safeToProceed = computeSafeToProceed({
    hasMinimalData:      netPaintSqFt > 0,
    readinessScore:      readinessScore.score,
    hasCriticalBlockers: false,
    hasMilestones:       milestones.length > 0,
    hasEvidencePlan:     true,
    confidenceScore:     confidenceScore.score,
    noCriticalBlockers:  true,
    scopeIsComplete:     true,
  });

  const algorithmTrace = buildAlgorithmTrace(
    ALGORITHM_VERSIONS.painting,
    "painting",
    ["roomLengthFt", "roomWidthFt", "wallHeightFt", "coats", "surfaceType", "paintQuality"],
    [],
    [
      `Net paintable area: ${netPaintSqFt} sqft`,
      `Surface multiplier: ${SURFACE_MULTIPLIERS[surfaceType]}x`,
      `Quality unit cost: $${QUALITY_UNIT_COST[paintQuality]}/gallon`,
    ],
    [
      { ruleId: "SURFACE_TEXTURED",  label: "Textured surface",    triggered: surfaceType === "textured",   points: 15, reason: "Textured surface increases paint consumption" },
      { ruleId: "NEW_DRYWALL",       label: "New drywall",         triggered: surfaceType === "newDrywall", points: 10, reason: "New drywall requires primer — absorption risk" },
      { ruleId: "EXTERIOR",          label: "Exterior work",       triggered: isExterior,                        points: 20, reason: "Exterior adds weather risk and complexity" },
      { ruleId: "PREMIUM_PAINT",     label: "Premium quality",     triggered: highQuality,                       points: 8,  reason: "Higher material cost for premium paint" },
      { ruleId: "MULTI_COAT",        label: "3+ coats",            triggered: coats >= 3,                        points: 12, reason: "More coats = proportionally more labor" },
      { ruleId: "CEILING_INCLUDED",  label: "Ceiling included",    triggered: input.includeCeiling,              points: 10, reason: "Ceiling adds overhead work complexity" },
    ]
  );


  const inspectionGate = buildInspectionGate(
    "After full surface prep — before first coat of paint",
    ["Surface prep photos", "Primer application photos", "Caulk and patch documented"],
    "Surface defects found during prep requiring repair before painting",
    "Verify all cracks, holes, and surfaces are sanded, primed, and ready before any color coat."
  );

  const hiddenDamage = assessHiddenDamageProbability(
    undefined,
    false,
    false,
    false,
    false,
    false
  );

  const scheduleRisk = assessScheduleRisk({
    dependsOnOtherTrades: false,
    clientMustDecide: true,
    materialsOnSite: false,
    weatherDependent: true,
    scopeIsLarge: false,
    hasComplexDetails: false,
  });

  const upsells = [
    { service: "Color consultation and accent wall", reason: "Upsell while on-site — client gets professional color selection for $150-300." },
    { service: "Cabinet painting", reason: "Cabinets already masked — painting them now avoids second mobilization." },
    { service: "Caulking and gap sealing package", reason: "Caulk all baseboards and trim while paint is fresh — prevents callbacks." },
  ];

  const roi = {
    investmentAmount:    costs.total,
    estimatedValueAdded: Math.round(costs.total * 2.07),
    roiPercent:          107,
    notes:               "Interior painting returns 107% of cost — highest ROI of any home improvement. Fresh paint is #1 factor in buyer perception.",
  };

  return {
    toolId:           `painting-${Date.now()}`,
    trade:            "painting",
    projectType:      isExterior ? "exterior-painting" : "interior-painting",
    mode,
    inputs:           { ...input },
    validationIssues: issues,
    isValid:          isValid(issues),
    materials:        mats,
    labor,
    costs,
    risk,
    milestones,
    evidenceRequired,
    warnings,
    recommendations,
    assumptions: [
      "Precios promedio EE.UU. 2026.",
      "Cobertura aproximada por galón: 350 sqft por capa.",
      "No incluye reparación mayor de drywall o carpintería.",
    ],
    // Extended metrics — constitution principle: "every tool must produce more than a calculation"
    confidenceScore,
    disputeRisk,
    readinessScore,
    priceBands,
    productionSchedule,
    scope,
    explained,
    warranty,
    safeToProceed,
    algorithmTrace,
    inspectionGate,
    hiddenDamageAssessment: hiddenDamage,
    scheduleRisk,
    upsells,
    roi,
    createdAt: new Date().toISOString(),
  };
}

export const runPaintingEngine = calculatePainting;
