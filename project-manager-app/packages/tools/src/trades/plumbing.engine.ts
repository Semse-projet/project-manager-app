import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { SemseToolResult, ToolMode } from "../core/types.js";

export type PlumbingInput = {
  fixtureCount: number;
  pipeRunFeet: number;
  drainLineFeet: number;
  waterHeaterReplace: boolean;
  slabAccess: boolean;
  outdoorWork: boolean;
  mode: ToolMode;
};

export function calculatePlumbing(input: PlumbingInput): SemseToolResult {
  const issues = collect(
    positive("fixtureCount", input.fixtureCount, "Número de fixtures"),
    positive("pipeRunFeet", input.pipeRunFeet, "Tubería de suministro"),
    range("drainLineFeet", input.drainLineFeet, 0, 500, "Línea de desagüe"),
    warn("pipeRunFeet", input.pipeRunFeet > 80 ? "Recorrido largo: prever presión y pruebas de estanqueidad." : "Recorrido estándar."),
  );

  const mats = [
    material("PEX / CPVC supply line", Math.ceil(input.pipeRunFeet * 1.15), "ft", 1.85, "Suministro"),
    material("Drain pipe PVC", Math.ceil(input.drainLineFeet * 1.1), "ft", 2.15, "Desagüe"),
    material("Shutoff valves", input.fixtureCount, "un", 18, "Accesorios"),
    material("Fittings and primer", Math.max(2, Math.ceil(input.fixtureCount * 1.5)), "kit", 24, "Accesorios"),
    ...(input.waterHeaterReplace ? [material("Water heater install kit", 1, "kit", 175, "Equipo")] : []),
  ];

  const labor = estimateLabor({
    baseHours: 4 + input.fixtureCount * 1.8 + input.pipeRunFeet / 35 + input.drainLineFeet / 60 + (input.waterHeaterReplace ? 3.5 : 0) + (input.slabAccess ? 2 : 0),
    crewSize: input.pipeRunFeet > 100 ? 2 : 1,
    ratePerHour: 72,
    difficulty: input.waterHeaterReplace || input.slabAccess ? "complex" : "moderate",
    notes: [
      `${input.fixtureCount} fixtures a intervenir`,
      input.waterHeaterReplace ? "Incluye cambio de calentador." : "Sin cambio de calentador.",
      input.slabAccess ? "Acceso bajo losa: considerar tiempos extra." : "Acceso sin losa.",
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: 0.15,
    profit: 0.20,
    taxRate: 0.07,
    semseFeeRate: 0.05,
  });

  const risk = computeRisk([
    factor("slab", "Acceso bajo losa", 0.22, input.slabAccess),
    factor("water_heater", "Cambio de calentador", 0.18, input.waterHeaterReplace),
    factor("outdoor", "Trabajo exterior", 0.10, input.outdoorWork),
    factor("long_run", "Recorrido largo", 0.12, input.pipeRunFeet > 80),
  ], {
    requiresPermit: input.waterHeaterReplace || input.slabAccess,
    requiresLicense: true,
    requiresInspection: input.waterHeaterReplace,
    requiresEngineering: false,
  });

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    ["Corte y desmontaje", "Instalación de suministro", "Desagüe y pruebas", "Cierre y entrega"],
    [
      ["Fotos de las conexiones previas"],
      ["Fotos de nueva tubería instalada"],
      ["Prueba de presión", "Prueba de drenaje"],
      ["Fotos de equipos funcionando", "Firma del cliente"],
    ]
  );

  const evidence = buildEvidenceChecklist("plumbing", risk, milestones, [
    { type: "photo", description: "Antes de la intervención", required: true, milestone: 1 },
    { type: "measurement", description: "Prueba de presión / caudal", required: true, milestone: 3 },
    { type: "photo", description: "Resultado final", required: true, milestone: 4 },
  ]);

  return {
    toolId: `plumbing-${Date.now()}`,
    trade: "plumbing",
    projectType: input.waterHeaterReplace ? "water-heater-replacement" : "plumbing-service",
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
      ...(input.slabAccess ? ["Acceso bajo losa: coordinar corte y restauración de acabado."] : []),
      ...(input.pipeRunFeet > 80 ? ["Recorrido largo: revisar presión y soportes."] : []),
    ],
    recommendations: [
      "Probar fugas antes de cerrar paredes o losas.",
      "Etiquetar válvulas de corte por zona.",
      "Documentar número de serie del calentador si aplica.",
    ],
    assumptions: [
      "No incluye reparación estructural ni reinstalación de acabados.",
      "Precios de mercado promedio EE.UU.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runPlumbingEngine = calculatePlumbing;
