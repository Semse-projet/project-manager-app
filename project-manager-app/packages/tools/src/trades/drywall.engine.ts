import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, SemseToolResult, ToolMode } from "../core/types.js";
import {
  computeConfidenceScore, computeDisputeRisk, computePriceBands,
  buildScope, buildExplainedOutput, buildWarranty, assessHiddenDamageProbability,
} from "../core/extended-metrics.js";

export type DrywallInput = {
  wallAreaSqft: number;
  ceilingAreaSqft: number;
  panelType: "regular" | "moisture-resistant" | "fire-rated";
  panelSize: "4x8" | "4x10" | "4x12";
  finishLevel: 0 | 1 | 2 | 3 | 4 | 5;
  includeCeiling: boolean;
  repairMode: boolean;
  textureMatch: boolean;
  mode: ToolMode;
};

const PANEL_SQUARE_FEET: Record<DrywallInput["panelSize"], number> = {
  "4x8": 32,
  "4x10": 40,
  "4x12": 48,
};

const PANEL_UNIT_COST: Record<DrywallInput["panelType"], number> = {
  regular: 14.5,
  "moisture-resistant": 18.5,
  "fire-rated": 24.5,
};

const COMPOUND_PER_PANEL: Record<DrywallInput["finishLevel"], number> = {
  0: 0.5,
  1: 0.75,
  2: 1,
  3: 1.15,
  4: 1.35,
  5: 1.65,
};

export function calculateDrywall(input: DrywallInput): SemseToolResult {
  const issues = collect(
    positive("wallAreaSqft", input.wallAreaSqft, "Área de muros"),
    range("ceilingAreaSqft", input.ceilingAreaSqft, 0, 2000, "Área de ceiling"),
    range("finishLevel", input.finishLevel, 0, 5, "Nivel de acabado"),
    warn(
      "finishLevel",
      input.finishLevel === 5 && !input.includeCeiling
        ? "Nivel 5 sin ceiling: validar necesidad real de acabado premium."
        : "Nivel de acabado válido."
    ),
    input.includeCeiling && input.finishLevel === 5
      ? warn("includeCeiling", "Ceiling con finish level 5: prever mano de obra adicional y control de luz rasante.")
      : null,
    input.repairMode && input.textureMatch
      ? warn("textureMatch", "Reparación con igualado de textura: prever mezcla de acabado y más horas de retoque.")
      : null,
  );

  const totalArea = input.wallAreaSqft + (input.includeCeiling ? input.ceilingAreaSqft : 0);
  const adjustedArea = totalArea * (input.repairMode ? 1.08 : 1.03);
  const panelCount = Math.max(1, Math.ceil(adjustedArea / PANEL_SQUARE_FEET[input.panelSize]));
  const screwBoxes = Math.max(1, Math.ceil(panelCount / 10));
  const tapeRolls = Math.max(1, Math.ceil(adjustedArea / 500));
  const compoundUnits = Math.max(1, Math.ceil(panelCount * COMPOUND_PER_PANEL[input.finishLevel]));
  const cornerBeadFeet = Math.max(0, Math.ceil((input.wallAreaSqft / 120) * 8));

  const mats = [
    material(`${input.panelType} drywall panel`, panelCount, "sheet", PANEL_UNIT_COST[input.panelType], "Panel"),
    material("Drywall screws", screwBoxes, "box", 12.5, "Fasteners"),
    material("Joint tape", tapeRolls, "roll", 6.5, "Finish"),
    material("Joint compound", compoundUnits, "bucket", 19.5, "Finish"),
    ...(cornerBeadFeet > 0 ? [material("Corner bead", cornerBeadFeet, "ft", 1.1, "Finish")] : []),
    ...(input.repairMode ? [material("Patch kit / sanding supplies", Math.max(1, Math.ceil(adjustedArea / 350)), "kit", 15, "Repair")] : []),
    ...(input.includeCeiling ? [material("Ceiling hangers / fasteners", Math.max(1, Math.ceil(input.ceilingAreaSqft / 200)), "kit", 18, "Ceiling")] : []),
  ];

  const labor = estimateLabor({
    baseHours:
      3.5 +
      adjustedArea / 90 +
      input.finishLevel * 0.75 +
      (input.repairMode ? 2.25 : 0) +
      (input.textureMatch ? 1.5 : 0) +
      (input.includeCeiling ? 2.5 : 0),
    crewSize: adjustedArea > 900 ? 3 : 2,
    ratePerHour: 58,
    difficulty: input.finishLevel >= 4 || input.repairMode || input.includeCeiling ? "complex" : "moderate",
    notes: [
      `Área ajustada: ${adjustedArea.toFixed(1)} sqft`,
      `Nivel de acabado: ${input.finishLevel}`,
      input.repairMode ? "Modo reparación activado." : "Instalación nueva o parcial.",
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: input.finishLevel >= 4 ? 0.16 : 0.14,
    profit: 0.2,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: adjustedArea || 1,
  });

  const risk = computeRisk(
    [
      factor("finish5", "Acabado nivel 5", 0.18, input.finishLevel === 5),
      factor("repair", "Modo reparación", 0.12, input.repairMode),
      factor("texture", "Igualado de textura", 0.14, input.textureMatch),
      factor("ceiling", "Incluye ceiling", 0.16, input.includeCeiling),
      factor("moisture", "Panel moisture-resistant", 0.08, input.panelType === "moisture-resistant"),
      factor("fire", "Panel fire-rated", 0.10, input.panelType === "fire-rated"),
    ],
    {
      requiresPermit: false,
      requiresLicense: false,
      requiresInspection: input.includeCeiling || input.finishLevel >= 4,
      requiresEngineering: false,
    }
  );

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    ["Medición y corte", "Colocación de paneles", "Tape / mud / finish", "Lijado y entrega"],
    [
      ["Fotos de áreas medidas", "Fotos de paneles entregados"],
      ["Fotos de paneles instalados", "Verificación de tornillos"],
      ["Fotos de tape y compound", "Registro de finish level"],
      ["Fotos finales", "Aprobación del cliente"],
    ]
  );

  const evidence = buildEvidenceChecklist("drywall", risk, milestones, [
    { type: "photo", description: "Estado inicial del área", required: true, milestone: 1 },
    { type: "photo", description: "Paneles colocados", required: true, milestone: 2 },
    { type: "photo", description: "Acabado / textura", required: input.finishLevel >= 3, milestone: 3 },
    { type: "inspection", description: "Aprobación final del cliente", required: true, milestone: 4 },
  ]);

  const warnings: string[] = [
    ...(input.finishLevel === 5
      ? ["Nivel 5: revisar luz rasante y uniformidad antes de pintar."]
      : []),
    ...(input.includeCeiling ? ["Ceiling incluido: validar peso, suspensión y acceso a instalaciones superiores."] : []),
    ...(input.repairMode && !input.textureMatch ? ["Reparación sin igualado de textura: puede requerir blending adicional."] : []),
  ];

  const recommendations: string[] = [
    "Tomar mediciones finales antes de cortar paneles.",
    "Cerrar juntas con secuencia de secado apropiada.",
    "Documentar fotos antes de aplicar primer o pintura.",
    ...(input.finishLevel >= 4 ? ["Programar inspección visual antes del cierre del hito final."] : []),
  ];

  const evidenceRequired: EvidenceItem[] = evidence.items;

  const confidenceScore = computeConfidenceScore({
    hasMeasurements:      input.wallAreaSqft > 0,
    hasPhotos:            false,
    hasConditionData:     true,
    hasMaterialSelection: true,
    hasScopeConfirmed:    true,
    hasUnknownConditions: input.repairMode && !input.textureMatch,
    extraConfirmedFields: [input.includeCeiling, input.repairMode, input.textureMatch].filter(Boolean).length,
  });

  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous:       input.textureMatch,
    clientProvidesMaterials: false,
    noPhotosRequired:     false,
    hasChangeOrderPolicy: true,
    hasEvidenceRequired:  true,
    hasMilestones:        milestones.length > 0,
    hasHighRiskConditions: input.finishLevel === 5 || input.includeCeiling,
    priceIsFixed:         false,
    clientExpectationMismatch: input.textureMatch,
  });

  const priceBands = computePriceBands(
    costs.total, 0.70, 1.40,
    {
      low:  "Hang-only or basic repair, no texture match, standard finish.",
      mid:  "Standard finish with tape/mud/sand, moderate complexity.",
      high: "Level 5 finish, ceiling work, texture match, moisture-resistant panels.",
    }
  );

  const scope = buildScope(
    [
      `${input.repairMode ? "Drywall repair" : "Drywall installation"} — ${adjustedArea.toFixed(0)} sqft`,
      `${input.panelType} panels (${input.panelSize})`,
      "Tape, joint compound, sanding",
      `Finish level ${input.finishLevel}`,
      ...(input.includeCeiling ? ["Ceiling drywall included"] : []),
      ...(input.textureMatch ? ["Texture match attempt"] : []),
      "Basic cleanup",
    ],
    [
      "Painting or priming (unless specified)",
      "Structural framing repair",
      "Insulation behind drywall",
      "Plumbing or electrical behind walls",
      "Mold remediation",
      ...(input.includeCeiling ? [] : ["Ceiling drywall"]),
    ],
    ["Wall framing is structurally sound and plumb", "No active moisture or leaks behind drywall area"],
    [
      "Hidden moisture or mold discovered behind existing drywall",
      "Structural framing damage found",
      "Electrical or plumbing obstruction",
      "Texture match requires more passes than estimated",
    ]
  );

  const explained = buildExplainedOutput(
    `Your drywall ${input.repairMode ? "repair" : "installation"} (${adjustedArea.toFixed(0)} sqft, finish level ${input.finishLevel}) is estimated at $${Math.round(costs.total).toLocaleString()}. ` +
    `${input.includeCeiling ? "Ceiling work is included. " : ""}` +
    `${input.textureMatch ? "Texture matching is included — client must approve visually before painting. " : ""}` +
    `Photos are required at key stages before covering the substrate.`,
    [
      `Area: ${adjustedArea.toFixed(0)} sqft — finish level: ${input.finishLevel} — repair mode: ${input.repairMode}`,
      `Panel type: ${input.panelType} — size: ${input.panelSize}`,
      "Do NOT paint before final sanding is approved and documented",
      ...(input.textureMatch ? ["TEXTURE: require client approval before painting — disputes often start here"] : []),
      ...(input.includeCeiling ? ["Ceiling: ensure lift/scaffolding safety before starting"] : []),
      "Before photos are non-negotiable — document pre-existing cracks or damage",
    ]
  );

  const warranty = buildWarranty(
    60,
    `Drywall ${input.repairMode ? "repair" : "installation"} — labor warranty on tape joints, finish, and patches`,
    [
      "Cracks from structural settlement or building movement",
      "Damage from moisture or flooding after completion",
      "Painting or texturing done by others after drywall is finished",
    ]
  );

  const hiddenDamage = assessHiddenDamageProbability(
    undefined,
    input.panelType === "moisture-resistant",
    false,
    input.repairMode,
    false,
    false
  );

  return {
    toolId: `drywall-${Date.now()}`,
    trade: "drywall",
    projectType: input.repairMode ? "drywall-repair" : "drywall-install",
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
      "Precios de referencia para mercado EE.UU. 2026.",
      "No incluye pintura final ni reparación estructural mayor.",
      "Finish level 5 requiere control adicional de luz y acabado.",
    ],
    confidenceScore,
    disputeRisk,
    priceBands,
    scope,
    explained,
    warranty,
    hiddenDamageAssessment: hiddenDamage,
    createdAt: new Date().toISOString(),
  };
}

export const runDrywallEngine = calculateDrywall;
