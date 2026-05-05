import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { SemseToolResult, ToolMode } from "../core/types.js";

export type HvacInput = {
  tonnage: number;
  ductRunFeet: number;
  zoneCount: number;
  heatPump: boolean;
  atticAccess: boolean;
  mode: ToolMode;
};

export function calculateHvac(input: HvacInput): SemseToolResult {
  const issues = collect(
    positive("tonnage", input.tonnage, "Capacidad"),
    range("ductRunFeet", input.ductRunFeet, 0, 1000, "Recorrido de ductos"),
    positive("zoneCount", input.zoneCount, "Número de zonas"),
    warn("tonnage", input.tonnage >= 5 ? "Sistema grande: considerar cálculo de carga y retorno." : "Sistema estándar."),
  );

  const mats = [
    material("Indoor air handler / furnace", 1, "unit", input.heatPump ? 2200 : 1800, "Equipo"),
    material("Outdoor condenser / heat pump", 1, "unit", input.heatPump ? 3600 : 3200, "Equipo"),
    material("Flexible duct / sheet metal", Math.ceil(input.ductRunFeet), "ft", 4.25, "Ductos"),
    material("Thermostat and controls", input.zoneCount, "set", 145, "Controles"),
    ...(input.atticAccess ? [material("Attic access safety / insulation repair", 1, "job", 260, "Acceso")] : []),
  ];

  const labor = estimateLabor({
    baseHours: 8 + input.tonnage * 2.5 + input.zoneCount * 2 + input.ductRunFeet / 45 + (input.atticAccess ? 3 : 0),
    crewSize: input.tonnage >= 5 ? 3 : 2,
    ratePerHour: 78,
    difficulty: input.heatPump || input.atticAccess ? "complex" : "moderate",
    notes: [
      `Capacidad: ${input.tonnage.toFixed(1)} ton`,
      `${input.zoneCount} zonas`,
      input.heatPump ? "Incluye bomba de calor." : "Sistema convencional.",
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: 0.17,
    profit: 0.22,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: input.tonnage,
  });

  const risk = computeRisk([
    factor("large_system", "Sistema grande", 0.18, input.tonnage >= 5),
    factor("heat_pump", "Bomba de calor", 0.15, input.heatPump),
    factor("attic_access", "Acceso a ático", 0.16, input.atticAccess),
    factor("multi_zone", "Múltiples zonas", 0.14, input.zoneCount > 1),
  ], {
    requiresPermit: true,
    requiresLicense: true,
    requiresInspection: true,
    requiresEngineering: input.tonnage >= 5 || input.zoneCount > 2,
  });

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    ["Desmontaje / preparación", "Instalación principal", "Ductos y controles", "Pruebas y balanceo"],
    [
      ["Fotos del sistema previo"],
      ["Fotos de equipo instalado"],
      ["Fotos de ductos y controles", "Mediciones de caudal"],
      ["Informe de pruebas", "Firma del cliente"],
    ]
  );

  const evidence = buildEvidenceChecklist("hvac", risk, milestones, [
    { type: "photo", description: "Estado previo del sistema", required: true, milestone: 1 },
    { type: "measurement", description: "Temperatura / presión / flujo", required: true, milestone: 3 },
    { type: "inspection", description: "Balanceo y prueba final", required: true, milestone: 4 },
  ]);

  return {
    toolId: `hvac-${Date.now()}`,
    trade: "hvac",
    projectType: input.heatPump ? "heat-pump-install" : "hvac-upgrade",
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
      ...(input.atticAccess ? ["Acceso a ático: revisar seguridad y aislamiento expuesto."] : []),
      ...(input.zoneCount > 2 ? ["Múltiples zonas: validar balance de aire y termostatos."] : []),
    ],
    recommendations: [
      "Realizar prueba de carga térmica antes del cierre.",
      "Documentar balanceo de aire por zona.",
      "Verificar drenaje de condensación.",
    ],
    assumptions: [
      "No incluye corrección mayor de ductos estructurales.",
      "Precios promedio EE.UU.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runHvacEngine = calculateHvac;
