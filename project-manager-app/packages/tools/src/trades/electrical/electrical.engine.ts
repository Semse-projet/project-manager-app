import { collect, isValid, positive, range, warn } from "../../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../../core/cost-engine.js";
import { computeRisk, factor } from "../../core/risk-engine.js";
import { buildMilestones } from "../../core/milestone-engine.js";
import type { EvidenceItem, LaborEstimate, SemseToolResult, ToolMode } from "../../core/types.js";

// ─── Wire gauge table (AWG → max amps @ 60°C Cu, NEC 310.15) ─────────────────
const WIRE_TABLE: { awg: string; maxAmps: number; resistancePerFt: number }[] = [
  { awg: "14", maxAmps: 15,  resistancePerFt: 0.003143 },
  { awg: "12", maxAmps: 20,  resistancePerFt: 0.001984 },
  { awg: "10", maxAmps: 30,  resistancePerFt: 0.001248 },
  { awg: "8",  maxAmps: 40,  resistancePerFt: 0.000786 },
  { awg: "6",  maxAmps: 55,  resistancePerFt: 0.000495 },
  { awg: "4",  maxAmps: 70,  resistancePerFt: 0.000312 },
  { awg: "3",  maxAmps: 85,  resistancePerFt: 0.000248 },
  { awg: "2",  maxAmps: 95,  resistancePerFt: 0.000197 },
  { awg: "1",  maxAmps: 110, resistancePerFt: 0.000156 },
  { awg: "1/0",maxAmps: 125, resistancePerFt: 0.000124 },
  { awg: "2/0",maxAmps: 145, resistancePerFt: 0.0000983 },
  { awg: "3/0",maxAmps: 165, resistancePerFt: 0.0000780 },
  { awg: "4/0",maxAmps: 195, resistancePerFt: 0.0000618 },
];

// ─── Breaker standard sizes (NEC) ────────────────────────────────────────────
const BREAKER_SIZES = [15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200];

function selectWire(requiredAmps: number): typeof WIRE_TABLE[0] {
  return WIRE_TABLE.find((w) => w.maxAmps >= requiredAmps) ?? WIRE_TABLE[WIRE_TABLE.length - 1];
}

function selectBreaker(requiredAmps: number): number {
  return BREAKER_SIZES.find((b) => b >= requiredAmps) ?? 200;
}

function voltDrop(amps: number, feet: number, resistancePerFt: number): number {
  return 2 * amps * feet * resistancePerFt; // 2× for round-trip
}

// ─── Input ────────────────────────────────────────────────────────────────────

export type ElectricalInput = {
  watts: number;           // total connected load
  voltage: number;         // 120 | 240 | 208 | 277 | 480
  powerFactor: number;     // 0.8–1.0
  phase: 1 | 3;
  isContinuous: boolean;   // loads >3h — NEC 210.19
  runFeet: number;         // one-way wire run in feet
  numCircuits: number;     // number of branch circuits
  panelUpgrade: boolean;   // does panel need upgrade?
  outdoorWork: boolean;    // weatherproof / GFCI required
  mode: ToolMode;
};

// ─── Engine ───────────────────────────────────────────────────────────────────

export function runElectricalEngine(input: ElectricalInput): SemseToolResult {
  // 1. Validate
  const issues = collect(
    positive("watts", input.watts, "Potencia (W)"),
    range("voltage", input.voltage, 100, 600, "Voltaje"),
    range("powerFactor", input.powerFactor, 0.5, 1.0, "Factor de potencia"),
    range("runFeet", input.runFeet, 1, 2000, "Longitud del tramo"),
    positive("numCircuits", input.numCircuits, "Número de circuitos"),
    input.panelUpgrade && input.watts > 20000
      ? warn("watts", "Carga muy alta para un panel residencial estándar. Verificar con ingeniero.")
      : null,
    input.runFeet > 100
      ? warn("runFeet", "Tramos >100ft aumentan caída de tensión significativamente.")
      : null,
  );

  // 2. Calculate load
  const sqrtPhase = input.phase === 3 ? Math.sqrt(3) : 1;
  const baseAmps = input.watts / (input.voltage * sqrtPhase * input.powerFactor);
  const designAmps = input.isContinuous ? baseAmps * 1.25 : baseAmps; // NEC 210.19

  // 3. Wire selection
  const wire = selectWire(designAmps);
  const breakerSize = selectBreaker(designAmps * 1.1); // 10% headroom

  // 4. Voltage drop
  const vDrop = voltDrop(designAmps, input.runFeet, wire.resistancePerFt);
  const vDropPct = (vDrop / input.voltage) * 100;

  // 5. Materials
  const wireFeet = input.runFeet * input.numCircuits * 3; // 3 conductors (L/N/G)
  const wireCostPerFt: Record<string, number> = {
    "14": 0.35, "12": 0.55, "10": 0.90, "8": 1.50,
    "6": 2.20, "4": 3.20, "3": 4.00, "2": 5.00,
    "1": 6.50, "1/0": 8.00, "2/0": 10.00, "3/0": 12.50, "4/0": 15.00,
  };
  const wireUnitCost = wireCostPerFt[wire.awg] ?? 1.50;
  const breakerCost = input.panelUpgrade ? 850 : breakerSize >= 100 ? 120 : 45;

  const mats = [
    material(`Cable THHN/THWN AWG ${wire.awg}`, wireFeet, "ft", wireUnitCost, "Conductores"),
    material(`Breaker ${breakerSize}A`, input.numCircuits, "un", breakerCost / input.numCircuits, "Protección"),
    material("Canaleta/conduit EMT 3/4\"", input.runFeet * input.numCircuits, "ft", 1.20, "Canalización"),
    material("Conectores y accesorios", input.numCircuits * 2, "un", 8.50, "Accesorios"),
    ...(input.outdoorWork
      ? [material("Salidas GFCI exteriores", input.numCircuits, "un", 35, "Seguridad")]
      : []),
    ...(input.panelUpgrade
      ? [material("Panel eléctrico 200A", 1, "un", 420, "Panel")]
      : []),
  ];

  const matCost = materialTotal(mats);

  // 6. Labor
  const baseHours = 2 + (input.runFeet / 50) + (input.numCircuits * 1.5);
  const panelHours = input.panelUpgrade ? 8 : 0;
  const totalHours = baseHours + panelHours;
  const ratePerHour = input.panelUpgrade ? 95 : 80;

  const labor: LaborEstimate = {
    hours: Math.round(totalHours * 10) / 10,
    crewSize: input.panelUpgrade ? 2 : 1,
    days: Math.ceil(totalHours / 8),
    ratePerHour,
    totalCost: Math.round(totalHours * ratePerHour * 100) / 100,
    difficulty: input.panelUpgrade ? "specialist" : input.watts > 10000 ? "complex" : "moderate",
    notes: [
      `Calibre requerido: AWG ${wire.awg} (${wire.maxAmps}A)`,
      `Breaker: ${breakerSize}A`,
      vDropPct > 3
        ? `⚠️ Caída de tensión: ${vDropPct.toFixed(1)}% — supera 3% recomendado por NEC`
        : `Caída de tensión: ${vDropPct.toFixed(1)}% — dentro de límite`,
    ],
  };

  // 7. Costs
  const costs = buildCostSummary(matCost, labor.totalCost);

  // 8. Risk
  const risk = computeRisk([
    factor("high_load",    "Carga > 10kW",             0.25, input.watts > 10000),
    factor("panel_work",   "Trabajo en panel principal", 0.30, input.panelUpgrade),
    factor("outdoor",      "Trabajo exterior (GFCI req)", 0.15, input.outdoorWork),
    factor("long_run",     "Tramo > 100ft",             0.10, input.runFeet > 100),
    factor("volt_drop",    "Caída de tensión > 3%",     0.20, vDropPct > 3),
    factor("three_phase",  "Sistema trifásico",          0.20, input.phase === 3),
    factor("continuous",   "Cargas continuas (125%)",    0.10, input.isContinuous),
  ], {
    requiresPermit: input.panelUpgrade || input.watts > 5000,
    requiresLicense: true,
    requiresInspection: input.panelUpgrade,
    requiresEngineering: input.watts > 20000 || input.phase === 3,
  });

  // 9. Milestones
  const milestones = buildMilestones(
    costs.total,
    risk.level,
    [
      "Inicio: inspección previa + apagado seguro",
      "Instalación de canalización y conductores",
      "Conexiones y pruebas parciales",
      "Prueba de carga completa + etiquetado",
    ],
    [
      ["Foto del panel antes de intervención", "Verificación de equipo de seguridad"],
      ["Foto de canalizaciones instaladas", "Foto de conductores en canaleta"],
      ["Foto de conexiones terminadas", "Medición de continuidad"],
      ["Reporte de prueba de carga", "Foto del panel etiquetado", "Firma del cliente"],
    ]
  );

  // 10. Evidence
  const evidence: EvidenceItem[] = [
    { type: "photo", description: "Estado del panel antes de trabajo", required: true, milestone: 1 },
    { type: "measurement", description: `Corriente medida en circuitos (diseño: ${designAmps.toFixed(1)}A)`, required: true, milestone: 3 },
    { type: "document", description: "Permiso eléctrico (si aplica)", required: risk.requiresPermit, milestone: 1 },
    { type: "inspection", description: "Inspección municipal post-instalación", required: risk.requiresInspection, milestone: 4 },
    { type: "photo", description: "Panel terminado con etiquetas", required: true, milestone: 4 },
  ];

  // 11. Warnings + Recommendations
  const warnings: string[] = [
    ...(vDropPct > 5 ? [`CRÍTICO: Caída de tensión ${vDropPct.toFixed(1)}% excede 5%. Aumentar calibre o reducir tramo.`] : []),
    ...(vDropPct > 3 && vDropPct <= 5 ? [`ADVERTENCIA: Caída de tensión ${vDropPct.toFixed(1)}% supera límite NEC de 3%.`] : []),
    ...(input.panelUpgrade ? ["Trabajo en panel requiere corte de servicio y notificación a la compañía eléctrica."] : []),
    ...(input.outdoorWork ? ["Todas las salidas exteriores requieren GFCI y cajas impermeables (NEC 406.9)."] : []),
  ];

  const recommendations: string[] = [
    `Usar cable AWG ${wire.awg} mínimo. Calibre recomendado para esta carga.`,
    `Breaker ${breakerSize}A adecuado para ${designAmps.toFixed(1)}A de diseño.`,
    "Documentar circuitos en el directorio del panel.",
    ...(input.isContinuous ? ["Aplicar factor 125% a cargas continuas (NEC 210.19)."] : []),
    ...(risk.requiresPermit ? ["Tramitar permiso eléctrico ante autoridad local antes de iniciar."] : []),
  ];

  return {
    toolId: `electrical-${Date.now()}`,
    trade: "electrical",
    projectType: input.panelUpgrade ? "panel-upgrade" : "branch-circuits",
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
      "Precios de materiales basados en mercado EE.UU. promedio 2026.",
      "Mano de obra a tarifa de mercado. Varía por región.",
      "Código NEC 2023. Verificar adopción local.",
      "Temperatura de conductor 60°C. Verificar condiciones reales.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const calculateElectrical = runElectricalEngine;
