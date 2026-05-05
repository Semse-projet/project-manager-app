import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, SemseToolResult, ToolMode } from "../core/types.js";

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
};

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

export function calculatePainting(input: PaintingInput): SemseToolResult {
  const issues = collect(
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

  const perimeterFt = 2 * (input.roomLengthFt + input.roomWidthFt);
  const wallAreaSqFt = perimeterFt * input.wallHeightFt;
  const ceilingAreaSqFt = input.includeCeiling ? input.roomLengthFt * input.roomWidthFt : 0;
  const openingsSqFt = input.doors * 20 + input.windows * 15;
  const rawPaintArea = Math.max(0, wallAreaSqFt + ceilingAreaSqFt - openingsSqFt);
  const adjustedArea = rawPaintArea * SURFACE_MULTIPLIERS[input.surfaceType];
  const totalCoatArea = adjustedArea * input.coats;
  const gallonsNeeded = Math.max(1, Math.ceil(totalCoatArea / 350));
  const primerGallons = input.includePrimer ? Math.max(1, Math.ceil(adjustedArea / 350)) : 0;

  const mats = [
    material(`${input.paintQuality} interior paint`, gallonsNeeded, "gal", QUALITY_UNIT_COST[input.paintQuality], "Finish"),
    ...(input.includePrimer
      ? [material("Primer", primerGallons, "gal", PRIMER_UNIT_COST[input.paintQuality], "Prep")]
      : []),
    material("Painter's tape / masking", Math.max(1, Math.ceil(adjustedArea / 700)), "roll", 7.5, "Prep"),
    material("Drop cloths / plastic", Math.max(1, Math.ceil(adjustedArea / 900)), "set", 18, "Protection"),
    material("Patch / caulk / sanding supplies", Math.max(2, Math.ceil(adjustedArea / 500)), "kit", 16, "Prep"),
    ...(input.surfaceType === "exterior"
      ? [material("Exterior coating add-on", Math.max(1, Math.ceil(adjustedArea / 400)), "gal", 12, "Exterior")]
      : []),
  ];

  const labor = estimateLabor({
    baseHours: 4 + (adjustedArea / 100) * 1.6 + input.doors * 0.35 + input.windows * 0.45 + (input.includeCeiling ? 1.75 : 0) + (input.surfaceType === "textured" ? 1.5 : 0),
    crewSize: adjustedArea > 1200 ? 3 : 2,
    ratePerHour: input.surfaceType === "exterior" ? 58 : 52,
    difficulty: input.surfaceType === "exterior" || input.surfaceType === "textured" ? "complex" : "moderate",
    notes: [
      `Área ajustada: ${adjustedArea.toFixed(1)} sqft`,
      `Capas: ${input.coats}`,
      input.includePrimer ? "Incluye primer." : "Sin primer.",
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: input.surfaceType === "exterior" ? 0.16 : 0.14,
    profit: 0.2,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: adjustedArea || 1,
  });

  const risk = computeRisk([
    factor("new_drywall", "Drywall nuevo", 0.16, input.surfaceType === "newDrywall"),
    factor("exterior", "Exterior", 0.18, input.surfaceType === "exterior"),
    factor("textured", "Superficie texturizada", 0.12, input.surfaceType === "textured"),
    factor("no_primer", "Sin primer", 0.14, !input.includePrimer),
    factor("high_openings", "Múltiples aperturas", 0.08, input.doors + input.windows > 6),
  ], {
    requiresPermit: input.surfaceType === "exterior",
    requiresLicense: false,
    requiresInspection: input.surfaceType === "exterior" && input.paintQuality === "premium",
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
    ...(input.surfaceType === "newDrywall" && !input.includePrimer ? ["Nuevo drywall sin primer puede requerir una capa adicional."] : []),
    ...(input.surfaceType === "exterior" ? ["Exterior: revisar clima, humedad y protección UV."] : []),
    ...(input.doors + input.windows > 6 ? ["Muchas aperturas: aumentar tiempo de masking y retoques."] : []),
  ];

  const recommendations: string[] = [
    "Confirmar color y acabado con el cliente antes de iniciar.",
    "Documentar preparación de superficie y reparación de imperfecciones.",
    "Tomar fotos antes/después para validar el cierre del hito.",
    ...(input.includePrimer ? [] : ["Considerar primer para mejorar adhesión y uniformidad."]),
  ];

  const evidenceRequired: EvidenceItem[] = evidence.items;

  return {
    toolId: `painting-${Date.now()}`,
    trade: "painting",
    projectType: input.surfaceType === "exterior" ? "exterior-painting" : "interior-painting",
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
      "Precios promedio EE.UU. 2026.",
      "Cobertura aproximada por galón: 350 sqft por capa.",
      "No incluye reparación mayor de drywall o carpintería.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runPaintingEngine = calculatePainting;
