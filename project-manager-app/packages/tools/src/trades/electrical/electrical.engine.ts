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
const STANDARD_VOLTAGES = [120, 208, 220, 240, 277, 480] as const;

function selectWire(requiredAmps: number): typeof WIRE_TABLE[0] {
  return WIRE_TABLE.find((w) => w.maxAmps >= requiredAmps) ?? WIRE_TABLE[WIRE_TABLE.length - 1];
}

function selectBreaker(requiredAmps: number): number {
  return BREAKER_SIZES.find((b) => b >= requiredAmps) ?? 200;
}

function voltDrop(amps: number, feet: number, resistancePerFt: number): number {
  return 2 * amps * feet * resistancePerFt; // 2× for round-trip
}

function finiteError(field: string, value: number, label: string) {
  return Number.isFinite(value)
    ? null
    : { field, severity: "error" as const, message: `${label} debe ser un número válido.` };
}

function phaseError(value: number) {
  return value === 1 || value === 3
    ? null
    : { field: "phase", severity: "error" as const, message: "Fase debe ser 1 o 3." };
}

function normalizePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeRange(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function conductorCountFor(voltage: number, phase: 1 | 3): number {
  const currentCarrying = phase === 3 ? 3 : voltage >= 208 ? 2 : 2;
  return currentCarrying + 1; // include equipment grounding conductor for material takeoff
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
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

// ─── Engine ───────────────────────────────────────────────────────────────────

export function runElectricalEngine(input: ElectricalInput): SemseToolResult {
  // 1. Validate
  const issues = collect(
    finiteError("watts", input.watts, "Potencia (W)"),
    positive("watts", input.watts, "Potencia (W)"),
    finiteError("voltage", input.voltage, "Voltaje"),
    range("voltage", input.voltage, 100, 600, "Voltaje"),
    STANDARD_VOLTAGES.includes(input.voltage as (typeof STANDARD_VOLTAGES)[number])
      ? null
      : warn("voltage", "Voltaje no estándar para el selector de la herramienta.", "Usar 120, 208, 220, 240, 277 o 480 si aplica."),
    finiteError("powerFactor", input.powerFactor, "Factor de potencia"),
    range("powerFactor", input.powerFactor, 0.5, 1.0, "Factor de potencia"),
    phaseError(input.phase),
    finiteError("runFeet", input.runFeet, "Longitud del tramo"),
    range("runFeet", input.runFeet, 1, 2000, "Longitud del tramo"),
    finiteError("numCircuits", input.numCircuits, "Número de circuitos"),
    positive("numCircuits", input.numCircuits, "Número de circuitos"),
    input.panelUpgrade && input.watts > 20000
      ? warn("watts", "Carga muy alta para un panel residencial estándar. Verificar con ingeniero.")
      : null,
    input.runFeet > 100
      ? warn("runFeet", "Tramos >100ft aumentan caída de tensión significativamente.")
      : null,
  );

  const watts = normalizePositive(input.watts, 1);
  const voltage = normalizeRange(input.voltage, 100, 600, 120);
  const powerFactor = normalizeRange(input.powerFactor, 0.5, 1.0, 1);
  const phase: 1 | 3 = input.phase === 3 ? 3 : 1;
  const runFeet = normalizeRange(input.runFeet, 1, 2000, 1);
  const numCircuits = Math.max(1, Math.round(normalizePositive(input.numCircuits, 1)));

  // 2. Calculate load
  const sqrtPhase = phase === 3 ? Math.sqrt(3) : 1;
  const baseAmps = watts / (voltage * sqrtPhase * powerFactor);
  const designAmps = input.isContinuous ? baseAmps * 1.25 : baseAmps; // NEC 210.19

  // 3. Wire selection
  const wire = selectWire(designAmps);
  const breakerSize = selectBreaker(designAmps * 1.1); // 10% headroom

  // 4. Voltage drop
  const vDrop = voltDrop(designAmps, runFeet, wire.resistancePerFt);
  const vDropPct = (vDrop / voltage) * 100;

  // 5. Materials
  const conductorCount = conductorCountFor(voltage, phase);
  const wireFeet = runFeet * numCircuits * conductorCount;
  const wireCostPerFt: Record<string, number> = {
    "14": 0.35, "12": 0.55, "10": 0.90, "8": 1.50,
    "6": 2.20, "4": 3.20, "3": 4.00, "2": 5.00,
    "1": 6.50, "1/0": 8.00, "2/0": 10.00, "3/0": 12.50, "4/0": 15.00,
  };
  const wireUnitCost = priceOf(input.prices, "copper-wire", wireCostPerFt[wire.awg] ?? 1.50);
  const breakerCost = input.panelUpgrade ? 850 : breakerSize >= 100 ? 120 : 45;

  const mats = [
    material(`Cable THHN/THWN AWG ${wire.awg}`, wireFeet, "ft", wireUnitCost, "Conductores", `${conductorCount} conductores por circuito`),
    material(`Breaker ${breakerSize}A`, numCircuits, "un", breakerCost / numCircuits, "Protección"),
    material("Canaleta/conduit EMT 3/4\"", runFeet * numCircuits, "ft", 1.20, "Canalización"),
    material("Conectores y accesorios", numCircuits * 2, "un", 8.50, "Accesorios"),
    ...(input.outdoorWork
      ? [material("Salidas GFCI exteriores", numCircuits, "un", 35, "Seguridad")]
      : []),
    ...(input.panelUpgrade
      ? [material("Panel eléctrico 200A", 1, "un", 420, "Panel")]
      : []),
  ];

  const matCost = materialTotal(mats);

  // 6. Labor
  const baseHours = 2 + (runFeet / 50) + (numCircuits * 1.5);
  const panelHours = input.panelUpgrade ? 8 : 0;
  const totalHours = baseHours + panelHours;
  const ratePerHour = input.panelUpgrade ? 95 : 80;

  const labor: LaborEstimate = {
    hours: Math.round(totalHours * 10) / 10,
    crewSize: input.panelUpgrade ? 2 : 1,
    days: Math.ceil(totalHours / 8),
    ratePerHour,
    totalCost: Math.round(totalHours * ratePerHour * 100) / 100,
    difficulty: input.panelUpgrade ? "specialist" : watts > 10000 ? "complex" : "moderate",
    notes: [
      `Calibre requerido: AWG ${wire.awg} (${wire.maxAmps}A)`,
      `Breaker: ${breakerSize}A`,
      vDropPct > 3
        ? `⚠️ Caída de tensión: ${vDropPct.toFixed(1)}% — supera 3% recomendado por NEC`
        : `Caída de tensión: ${vDropPct.toFixed(1)}% — dentro de límite`,
    ],
  };

  // 7. Costs
  const costs = buildCostSummary(applyLocation(matCost, input.location, "material"), applyLocation(labor.totalCost, input.location, "labor"));

  // 8. Risk
  const risk = computeRisk([
    factor("high_load",    "Carga > 10kW",             0.25, watts > 10000),
    factor("panel_work",   "Trabajo en panel principal", 0.30, input.panelUpgrade),
    factor("outdoor",      "Trabajo exterior (GFCI req)", 0.15, input.outdoorWork),
    factor("long_run",     "Tramo > 100ft",             0.10, runFeet > 100),
    factor("volt_drop",    "Caída de tensión > 3%",     0.20, vDropPct > 3),
    factor("three_phase",  "Sistema trifásico",          0.20, phase === 3),
    factor("continuous",   "Cargas continuas (125%)",    0.10, input.isContinuous),
  ], {
    requiresPermit: input.panelUpgrade || watts > 5000,
    requiresLicense: true,
    requiresInspection: input.panelUpgrade || watts > 5000,
    requiresEngineering: watts > 20000 || phase === 3,
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


  const productionSchedule = buildProductionSchedule([
    { name: "Site walkthrough and panel assessment", daysMin: 0, daysMax: 1, crew: 1, description: "Inspect panel, identify circuits, confirm scope" },
    { name: "Rough-in wiring",                       daysMin: 1, daysMax: 3, crew: 2, description: "Pull wire, install boxes, rough conduit runs" },
    { name: "Device and fixture installation",        daysMin: 1, daysMax: 2, crew: 2, description: "Install outlets, switches, fixtures, panels" },
    { name: "Panel connections and labeling",         daysMin: 1, daysMax: 1, crew: 1, description: "Land circuits, label breakers, trim covers" },
    { name: "Testing and inspection",                 daysMin: 0, daysMax: 1, crew: 1, description: "Test all circuits, pass inspection, document" },
  ]);

  const inspectionGate = buildInspectionGate(
    "After rough-in — before any drywall or concealment",
    ["Rough-in wiring photos", "Box placement photos", "Conduit fill and bend radius"],
    "NEC code violation or unsafe wiring found requiring correction before concealment",
    "Rough-in must pass inspection before any walls are closed. No exceptions on electrical."
  );

  const hiddenDamage = assessHiddenDamageProbability(undefined, false, false, false, false, false);

  const scheduleRisk = assessScheduleRisk({
    dependsOnOtherTrades: true,
    clientMustDecide: false,
    materialsOnSite: false,
    weatherDependent: false,
    scopeIsLarge: false,
    hasComplexDetails: true,
  });

  const upsells = [
    { service: "Whole-home surge protector", reason: "Install at panel during rough-in — protects all devices, $150-300 part, minimal labor." },
    { service: "EV charger rough-in (Level 2)", reason: "Add 50A circuit while panel is open — avoids future trench and panel work." },
    { service: "Arc-fault (AFCI) breaker upgrade", reason: "NEC 2020 requires AFCI in most rooms — recommend proactive upgrade for safety." },
  ];

  const roi = {
    investmentAmount:    costs.total,
    estimatedValueAdded: Math.round(costs.total * 1.20),
    roiPercent:          120,
    notes:               "Electrical upgrades return 120% via code compliance, safety, and enabling modern devices (EV, solar, smart home).",
  };

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
    productionSchedule,
    inspectionGate,
    hiddenDamageAssessment: hiddenDamage,
    scheduleRisk,
    upsells,
    roi,
    createdAt: new Date().toISOString(),
  };
}

export const calculateElectrical = runElectricalEngine;
