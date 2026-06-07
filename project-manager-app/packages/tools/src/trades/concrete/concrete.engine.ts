import { collect, isValid, positive, range, warn } from "../../core/validation-engine.js";
import { applyLocation, buildCostSummary, material, materialTotal, priceOf } from "../../core/cost-engine.js";
import { computeRisk, factor } from "../../core/risk-engine.js";
import { buildMilestones } from "../../core/milestone-engine.js";
import type { EvidenceItem, LaborEstimate, LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../../core/types.js";
import {
  computeConfidenceScore, computeDisputeRisk, computeReadinessScore,
  computePriceBands, buildScope, buildExplainedOutput, buildWarranty,
  buildProductionSchedule, assessHiddenDamageProbability, assessScheduleRisk,
  buildInspectionGate, buildAlgorithmTrace, computeSafeToProceed, ALGORITHM_VERSIONS,
} from "../../core/extended-metrics.js";

// ─── Mix ratios (cement:sand:gravel) by strength ──────────────────────────────
const MIX_RATIOS: Record<string, { cement: number; sand: number; gravel: number; psi: number }> = {
  "2500psi": { cement: 1, sand: 2,   gravel: 3,   psi: 2500 },
  "3000psi": { cement: 1, sand: 1.5, gravel: 2.5, psi: 3000 },
  "3500psi": { cement: 1, sand: 1.5, gravel: 2.5, psi: 3500 },
  "4000psi": { cement: 1, sand: 1,   gravel: 2,   psi: 4000 },
};

const CU_FT_PER_BAG = 0.45; // 94lb cement bag ≈ 0.45 cu ft mixed

// ─── Input ────────────────────────────────────────────────────────────────────

export type ConcreteInput = {
  lengthFt: number;
  widthFt: number;
  thicknessIn: number;     // inches
  wastePercent: number;    // typically 10%
  mixStrength: "2500psi" | "3000psi" | "3500psi" | "4000psi";
  reinforced: boolean;
  formworkIncluded: boolean;
  pumpRequired: boolean;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

// ─── Engine ───────────────────────────────────────────────────────────────────

export function runConcreteEngine(input: ConcreteInput): SemseToolResult {
  // 1. Validate
  const issues = collect(
    positive("lengthFt", input.lengthFt, "Largo"),
    positive("widthFt", input.widthFt, "Ancho"),
    range("thicknessIn", input.thicknessIn, 2, 24, "Espesor"),
    range("wastePercent", input.wastePercent, 0, 30, "Factor de desperdicio"),
    input.thicknessIn < 4 && input.reinforced
      ? warn("thicknessIn", "Espesor <4\" con refuerzo es inusual. Verificar diseño estructural.")
      : null,
    input.lengthFt * input.widthFt > 1000
      ? warn("area", "Área >1000 sqft. Considerar vaciado por secciones (juntas de control).")
      : null,
  );

  // 2. Volume calculation
  const areaSqFt = input.lengthFt * input.widthFt;
  const thicknessFt = input.thicknessIn / 12;
  const netVolumeCuFt = areaSqFt * thicknessFt;
  const grossVolumeCuFt = netVolumeCuFt * (1 + input.wastePercent / 100);
  const grossVolumeCuYd = grossVolumeCuFt / 27;

  // 3. Materials
  const mix = MIX_RATIOS[input.mixStrength];
  const totalParts = mix.cement + mix.sand + mix.gravel;
  const cementCuFt = grossVolumeCuFt * (mix.cement / totalParts);
  const numBags = Math.ceil(cementCuFt / CU_FT_PER_BAG);
  const sandTons = (grossVolumeCuFt * (mix.sand / totalParts) * 100) / 100 / 20; // rough
  const gravelTons = (grossVolumeCuFt * (mix.gravel / totalParts) * 100) / 100 / 20;
  const waterGal = numBags * 5; // ~5 gal per bag

  const cementBagPrice = priceOf(input.prices, "cement-bag", 12.50);
  const mats = [
    material("Bolsas de cemento 94lb", numBags, "bolsas", cementBagPrice, "Cemento"),
    material("Arena gruesa", Math.ceil(sandTons * 10) / 10, "ton", 45, "Áridos"),
    material("Grava 3/4\"", Math.ceil(gravelTons * 10) / 10, "ton", 48, "Áridos"),
    material("Agua", Math.ceil(waterGal), "gal", 0.005, "Agua"),
    ...(input.reinforced
      ? [material("Malla electrosoldada 6×6 10/10", Math.ceil(areaSqFt / 50), "rollos", 85, "Refuerzo")]
      : []),
    ...(input.formworkIncluded
      ? [material("Formaleta (madera + clavos)", Math.ceil((input.lengthFt + input.widthFt) * 2 / 8), "tablones", 18, "Formaleta")]
      : []),
    ...(input.pumpRequired
      ? [material("Bomba de concreto (renta)", 1, "día", 650, "Equipo")]
      : []),
  ];

  const matCost = materialTotal(mats);

  // 4. Labor
  const baseHours = 4 + (areaSqFt / 100) * 2.5;
  const formHours = input.formworkIncluded ? (input.lengthFt + input.widthFt) * 0.25 : 0;
  const rebarHours = input.reinforced ? areaSqFt * 0.03 : 0;
  const totalHours = baseHours + formHours + rebarHours;
  const crewSize = areaSqFt > 500 ? 4 : areaSqFt > 200 ? 3 : 2;

  const labor: LaborEstimate = {
    hours: Math.round(totalHours * 10) / 10,
    crewSize,
    days: Math.ceil(totalHours / (8 * crewSize)),
    ratePerHour: 55,
    totalCost: Math.round(totalHours * crewSize * 55 * 100) / 100,
    difficulty: input.reinforced && input.pumpRequired ? "complex" : "moderate",
    notes: [
      `Área: ${areaSqFt.toFixed(1)} sqft | Volumen: ${grossVolumeCuYd.toFixed(2)} yd³`,
      `Resistencia: ${mix.psi} PSI | Mezcla ${mix.cement}:${mix.sand}:${mix.gravel}`,
      `${numBags} bolsas de cemento`,
    ],
  };

  // 5. Costs
  const costs = buildCostSummary(applyLocation(matCost, input.location, "material"), applyLocation(labor.totalCost, input.location, "labor"), {
    perUnitDivisor: areaSqFt,
  });

  // 6. Risk
  const risk = computeRisk([
    factor("large_area",    "Área > 500 sqft",          0.20, areaSqFt > 500),
    factor("reinforced",    "Concreto reforzado",         0.25, input.reinforced),
    factor("high_strength", "Mezcla ≥ 4000 PSI",          0.20, mix.psi >= 4000),
    factor("pump",          "Requiere bombeo",             0.10, input.pumpRequired),
    factor("thin_slab",     "Espesor < 4\" (no estructural)", 0.10, input.thicknessIn < 4),
  ]);

  // 7. Milestones
  const milestones = buildMilestones(
    costs.total,
    risk.level,
    [
      "Preparación de base y formaleta",
      "Vaciado y nivelado",
      "Curado y desmolde",
      "Entrega final",
    ],
    [
      ["Foto de base compactada", "Foto de formaleta instalada"],
      ["Foto de vaciado en proceso", "Medición de nivel"],
      ["Foto de superficie curada", "Registro de temperatura y humedad"],
      ["Foto de superficie final", "Prueba de asentamiento si aplica", "Aprobación del cliente"],
    ]
  );

  // 8. Evidence
  const evidence: EvidenceItem[] = [
    { type: "photo", description: "Base preparada antes del vaciado", required: true, milestone: 1 },
    { type: "photo", description: "Vaciado en proceso", required: true, milestone: 2 },
    { type: "measurement", description: `Volumen vaciado: ~${grossVolumeCuYd.toFixed(2)} yd³`, required: true, milestone: 2 },
    { type: "photo", description: "Superficie terminada", required: true, milestone: 3 },
    { type: "document", description: "Permiso de construcción (si aplica)", required: risk.requiresPermit, milestone: 1 },
  ];

  const warnings: string[] = [
    ...(areaSqFt > 400 ? ["Áreas >400 sqft: instalar juntas de control cada 10ft para evitar fisuras."] : []),
    ...(input.thicknessIn < 4 ? ["Espesor <4\" no es adecuado para carga vehicular o estructural."] : []),
    ...([`Tiempo de curado mínimo: 7 días (resist. completa: 28 días).`]),
  ];

  const recommendations: string[] = [
    `Mezcla ${input.mixStrength} adecuada para ${input.reinforced ? "uso estructural ligero" : "losas de piso"}.`,
    "Humedecer la base antes del vaciado para evitar absorción de agua.",
    "Cubrir con plástico las primeras 24h para curado uniforme.",
    ...(input.pumpRequired ? ["Coordinar camión de concreto premezclado para mayor control de calidad."] : []),
  ];


  const productionSchedule = buildProductionSchedule([
    { name: "Subgrade and forming",        daysMin: 1, daysMax: 2, crew: 3, description: "Grade, compact subbase, set forms to elevation" },
    { name: "Rebar and reinforcement",     daysMin: 0, daysMax: 1, crew: 2, description: "Install rebar grid, chairs, and tie wire" },
    { name: "Pour and spread",             daysMin: 1, daysMax: 1, crew: 4, description: "Place concrete, strike off, and spread to forms" },
    { name: "Finish and cure",             daysMin: 1, daysMax: 2, crew: 2, description: "Float, broom, edge, apply cure compound" },
    { name: "Strip forms and seal",        daysMin: 1, daysMax: 1, crew: 2, description: "Strip forms, backfill edges, apply sealer if included" },
  ]);

  const inspectionGate = buildInspectionGate(
    "After forming and rebar — before concrete placement",
    ["Form elevation and dimension photos", "Rebar spacing and chair photos", "Sub-base compaction verification"],
    "Form misalignment or rebar deficiency found requiring correction before pour",
    "All forms and rebar must be inspected and approved before any concrete is placed."
  );

  const hiddenDamage = assessHiddenDamageProbability(undefined, false, false, false, false, false);

  const scheduleRisk = assessScheduleRisk({
    dependsOnOtherTrades: false,
    clientMustDecide: false,
    materialsOnSite: false,
    weatherDependent: true,
    scopeIsLarge: false,
    hasComplexDetails: false,
  });

  const upsells = [
    { service: "Concrete sealer and color hardener", reason: "Apply at pour time — protects surface and adds aesthetic value for minimal cost." },
    { service: "Control joint saw-cutting", reason: "Prevents random cracking — schedule saw crew day after pour while crew is demobilizing." },
    { service: "Fiber reinforcement additive", reason: "Add to mix at batch plant — reduces surface cracking with no extra labor." },
  ];

  const roi = {
    investmentAmount:    costs.total,
    estimatedValueAdded: Math.round(costs.total * 0.90),
    roiPercent:          90,
    notes:               "Concrete flatwork and structures provide permanent value and return ~90% in property and functional value.",
  };

  return {
    toolId: `concrete-${Date.now()}`,
    trade: "concrete",
    projectType: input.reinforced ? "structural-slab" : "flat-slab",
    mode: input.mode,
    inputs: { ...input },
    validationIssues: issues,
    isValid: isValid(issues),
    materials: mats,
    labor,
    costs,
    risk,
    milestones,
    evidenceRequired: evidence,
    warnings,
    recommendations,
    assumptions: [
      "Precios basados en mercado EE.UU. / Miami 2026.",
      "Mezcla manual. Para premezclado, reemplazar cemento/arena/grava por yd³ de concreto (~$145/yd³).",
      "Resistencia de 28 días según ASTM C39.",
    ],
    productionSchedule,
    inspectionGate,
    hiddenDamageAssessment: hiddenDamage,
    scheduleRisk,
    upsells,
    roi,
    createdAt: new Date().toISOString(),
  };
}

export const calculateConcrete = runConcreteEngine;
