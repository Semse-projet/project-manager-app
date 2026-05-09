import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { SemseToolResult, ToolMode } from "../core/types.js";
import { calculateQuoteFromToolResult } from "../business/quote-engine.js";

export type RoofingInput = {
  roofAreaSqFt: number;
  pitch: number;
  shingleType: "3-tab" | "architectural" | "metal";
  removeOldRoof: boolean;
  layers: number;
  underlayment: boolean;
  vents: number;
  mode: ToolMode;
};

export function calculateRoofing(input: RoofingInput): SemseToolResult {
  const issues = collect(
    positive("roofAreaSqFt", input.roofAreaSqFt, "Área del techo"),
    range("pitch", input.pitch, 1, 18, "Pendiente"),
    range("layers", input.layers, 1, 3, "Capas existentes"),
    warn("roofPitch", input.pitch >= 10 ? "Pendiente alta: usar protección adicional y mayor tiempo de instalación." : "Pendiente estándar."),
  );

  const shinglesPerSqFt = input.shingleType === "metal" ? 0.12 : input.shingleType === "architectural" ? 0.11 : 0.10;
  const shingleCount = Math.ceil(input.roofAreaSqFt * shinglesPerSqFt * (1 + (input.removeOldRoof ? 0.12 : 0.06)));
  const underlaymentRolls = input.underlayment ? Math.ceil(input.roofAreaSqFt / 400) : 0;
  const mats = [
    material(`${input.shingleType} shingles`, shingleCount, "sq", input.shingleType === "metal" ? 180 : input.shingleType === "architectural" ? 120 : 95, "Cubierta"),
    ...(input.underlayment ? [material("Underlayment sintético", underlaymentRolls, "rolls", 75, "Base")] : []),
    ...(input.removeOldRoof ? [material("Disposal / tear-off", Math.ceil(input.roofAreaSqFt / 100), "bundle", 42, "Demolición")] : []),
    material("Flashing / sealant", Math.ceil(input.roofAreaSqFt / 150), "kit", 38, "Sellado"),
    ...(input.vents > 0 ? [material("Roof vents", input.vents, "un", 30, "Ventilación")] : []),
  ];

  const labor = estimateLabor({
    baseHours: 6 + (input.roofAreaSqFt / 100) * 1.8 + (input.removeOldRoof ? 4 : 0) + (input.layers > 1 ? 3 : 0),
    crewSize: input.roofAreaSqFt > 2500 ? 4 : 3,
    ratePerHour: 62,
    difficulty: input.layers > 1 || input.pitch >= 10 ? "complex" : "moderate",
    notes: [
      `Área: ${input.roofAreaSqFt.toFixed(0)} sqft`,
      `Material: ${input.shingleType}`,
      input.removeOldRoof ? "Incluye retiro de cubierta existente." : "Sin retiro de cubierta existente.",
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: 0.16,
    profit: 0.22,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: input.roofAreaSqFt,
  });

  const risk = computeRisk([
    factor("high_pitch", "Pendiente alta", 0.22, input.pitch >= 10),
    factor("tear_off", "Retiro de cubierta", 0.18, input.removeOldRoof),
    factor("multiple_layers", "Múltiples capas", 0.14, input.layers > 1),
    factor("metal", "Cubierta metálica", 0.10, input.shingleType === "metal"),
  ], {
    requiresPermit: true,
    requiresLicense: true,
    requiresInspection: true,
    requiresEngineering: input.pitch >= 12 || input.roofAreaSqFt > 3000,
  });

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    ["Protección y retiro", "Instalación de base", "Colocación de cubierta", "Limpieza y entrega"],
    [
      ["Fotos del techo previo", "Protección de perímetro"],
      ["Fotos de underlayment", "Detalle de flashing"],
      ["Fotos de instalación terminada", "Verificación de ventilación"],
      ["Inspección final", "Firma del cliente"],
    ]
  );

  const evidence = buildEvidenceChecklist("roofing", risk, milestones, [
    { type: "photo", description: "Estado inicial del techo", required: true, milestone: 1 },
    { type: "photo", description: "Instalación de cubierta", required: true, milestone: 3 },
    { type: "inspection", description: "Inspección final de techo", required: true, milestone: 4 },
  ]);

  const quote = calculateQuoteFromToolResult({
    toolId: `roofing-${Date.now()}`,
    trade: "roofing",
    projectType: "roof-replacement",
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
    warnings: [],
    recommendations: [],
    assumptions: [],
    createdAt: new Date().toISOString(),
  });

  return {
    toolId: `roofing-${Date.now()}`,
    trade: "roofing",
    projectType: "roof-replacement",
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
      ...(input.pitch >= 10 ? ["Pendiente alta: considerar seguridad anticaídas reforzada."] : []),
      ...(input.layers > 1 ? ["Múltiples capas: verificar peso y condición estructural."] : []),
      `Cotización sugerida: $${quote.total.toFixed(2)}.`,
    ],
    recommendations: [
      "Verificar ventilación del ático.",
      "Revisar flashing en penetraciones y limatesas.",
      "Programar inspección final antes del pago.",
    ],
    assumptions: [
      "Precios aproximados para mercado EE.UU.",
      "Instalación por cuadrilla estándar.",
      "No incluye reparación estructural mayor.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runRoofingEngine = calculateRoofing;
