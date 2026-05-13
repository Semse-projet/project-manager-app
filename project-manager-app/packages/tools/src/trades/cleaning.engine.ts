import { collect, isValid, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, SemseToolResult, ToolMode } from "../core/types.js";

export type CleaningInput = {
  /** Type of cleaning service */
  serviceType: "standard" | "deep" | "move_inout" | "post_construction" | "commercial";
  /** Total square footage */
  squareFt: number;
  /** Number of bedrooms */
  bedrooms: number;
  /** Number of bathrooms */
  bathrooms: number;
  /** Surface condition / soiling level */
  condition: "light" | "moderate" | "heavy" | "post_construction";
  /** Add-on services */
  addOns: ("windows" | "carpet" | "disinfection" | "laundry" | "oven" | "fridge" | "extras")[];
  /** Service frequency (affects pricing) */
  frequency: "one_time" | "weekly" | "biweekly" | "monthly";
  /** Professional provides supplies */
  suppliesIncluded: boolean;
  mode: ToolMode;
};

// ── base rate per sqft by service type ────────────────────────────────────────
const BASE_RATE_PER_SQFT: Record<CleaningInput["serviceType"], number> = {
  standard:          0.10,
  deep:              0.17,
  move_inout:        0.22,
  post_construction: 0.30,
  commercial:        0.12,
};

// ── condition multipliers ──────────────────────────────────────────────────────
const CONDITION_MULT: Record<CleaningInput["condition"], number> = {
  light:             0.85,
  moderate:          1.00,
  heavy:             1.40,
  post_construction: 1.75,
};

// ── frequency discount ────────────────────────────────────────────────────────
const FREQUENCY_MULT: Record<CleaningInput["frequency"], number> = {
  one_time: 1.00,
  weekly:   0.80,
  biweekly: 0.85,
  monthly:  0.90,
};

// ── add-on costs ──────────────────────────────────────────────────────────────
const ADDON_COST: Record<CleaningInput["addOns"][number], number> = {
  windows:     65,
  carpet:      90,
  disinfection: 55,
  laundry:     45,
  oven:        40,
  fridge:      45,
  extras:      60,
};

// ── minimum crew hours ────────────────────────────────────────────────────────
const MIN_HOURS: Record<CleaningInput["serviceType"], number> = {
  standard:          2,
  deep:              3,
  move_inout:        4,
  post_construction: 5,
  commercial:        3,
};

export function calculateCleaning(input: CleaningInput): SemseToolResult {
  const issues = collect(
    input.squareFt <= 0
      ? warn("squareFt", "Área debe ser mayor que cero.")
      : null,
    input.condition === "post_construction" && input.serviceType === "standard"
      ? warn("condition", "Condición post-construcción requiere servicio profundo, no estándar.")
      : null,
    input.condition === "heavy" && input.frequency !== "one_time"
      ? warn("condition", "Condición pesada: primera visita recurrente puede requerir tarifa de deep cleaning.")
      : null,
  );

  // ── cost calculation ─────────────────────────────────────────────────────
  const baseRate      = BASE_RATE_PER_SQFT[input.serviceType];
  const conditionMult = CONDITION_MULT[input.condition];
  const freqMult      = FREQUENCY_MULT[input.frequency];

  const baseLabor     = Math.max(
    MIN_HOURS[input.serviceType] * 28, // minimum hourly floor
    input.squareFt * baseRate * conditionMult * freqMult
  );

  const bathroomAdder = input.bathrooms * 25 * conditionMult;
  const addOnTotal    = input.addOns.reduce((sum, ao) => sum + (ADDON_COST[ao] ?? 0), 0);
  const suppliesCost  = input.suppliesIncluded ? Math.max(20, input.squareFt * 0.015) : 0;

  const estimatedHours =
    Math.max(MIN_HOURS[input.serviceType],
      (input.squareFt / 400) * conditionMult +
      (input.bedrooms * 0.5) +
      (input.bathrooms * 0.75) +
      (input.condition === "heavy" ? 1.5 : 0) +
      (input.addOns.length * 0.5)
    );

  const crewSize = estimatedHours > 8 ? 3 : estimatedHours > 4 ? 2 : 1;

  const mats = [
    ...(input.suppliesIncluded ? [material("Cleaning supplies & products", 1, "lot", suppliesCost, "Supplies")] : []),
    ...(input.addOns.includes("carpet") ? [material("Carpet cleaning supplies", 1, "lot", 35, "Add-on")] : []),
    ...(input.addOns.includes("disinfection") ? [material("Disinfectant products", 1, "lot", 25, "Add-on")] : []),
    material("Disposal bags, misc consumables", 1, "lot", 15, "Misc"),
  ];

  const labor = estimateLabor({
    baseHours:  estimatedHours,
    crewSize,
    ratePerHour: 28,
    difficulty: input.condition === "heavy" || input.condition === "post_construction" ? "complex" : "moderate",
    notes: [
      `Servicio: ${input.serviceType}`,
      `Área: ${input.squareFt} sqft`,
      `Condición: ${input.condition}`,
      `${input.bathrooms} baños, ${input.bedrooms} habitaciones`,
    ],
  });

  const costs = buildCostSummary(
    materialTotal(mats) + bathroomAdder + addOnTotal + baseLabor - labor.totalCost,
    labor.totalCost,
    {
      overhead:       0.10,
      profit:         0.18,
      taxRate:        0.07,
      semseFeeRate:   0.05,
      perUnitDivisor: input.squareFt || 1,
    }
  );

  // ── risk ─────────────────────────────────────────────────────────────────
  const risk = computeRisk(
    [
      factor("postConstruction",  "Limpieza post-construcción",   0.20, input.serviceType === "post_construction"),
      factor("heavyCondition",    "Condición pesada",             0.18, input.condition === "heavy"),
      factor("moveOut",           "Mudanza / move-in move-out",   0.12, input.serviceType === "move_inout"),
      factor("manyBathrooms",     "3+ baños",                     0.08, input.bathrooms >= 3),
      factor("noSupplies",        "Cliente no provee supplies",   0.05, !input.suppliesIncluded),
    ],
    {
      requiresPermit:      false,
      requiresLicense:     false,
      requiresInspection:  false,
      requiresEngineering: false,
    }
  );

  // ── milestones ────────────────────────────────────────────────────────────
  const isLarge = input.squareFt > 2000 || input.serviceType === "post_construction";

  const milestoneNames = isLarge
    ? ["Inspección inicial y documentación", "Limpieza de cocina y baños", "Áreas generales y pisos", "Revisión final y aprobación"]
    : ["Inicio y fotos previas", "Servicio completado y aprobación"];

  const milestoneDocs = isLarge
    ? [
        ["Fotos del estado inicial", "Áreas de acceso confirmadas"],
        ["Fotos de cocina limpia", "Fotos de baños"],
        ["Fotos de pisos", "Fotos de áreas comunes"],
        ["Fotos finales", "Aprobación del cliente"],
      ]
    : [
        ["Fotos previas del área"],
        ["Fotos finales", "Aprobación del cliente"],
      ];

  const milestones = buildMilestones(costs.total, risk.level, milestoneNames, milestoneDocs);

  const evidence = buildEvidenceChecklist("cleaning", risk, milestones, [
    { type: "photo",      description: "Fotos del estado inicial de cada área", required: true, milestone: 1 },
    { type: "photo",      description: "Fotos finales por área",                required: true, milestone: milestoneNames.length },
    { type: "inspection", description: "Confirmación del cliente",              required: true, milestone: milestoneNames.length },
  ] as EvidenceItem[]);

  const warnings: string[] = [
    ...(input.condition === "post_construction" ? ["Post-construcción puede requerir múltiples pasadas. El polvo fino vuelve tras la primera limpieza."] : []),
    ...(input.condition === "heavy" ? ["Condición pesada: el precio puede ajustarse tras inspección en sitio."] : []),
    ...(input.serviceType === "move_inout" ? ["Move-out: documentar daños existentes con fotos antes de limpiar para proteger a ambas partes."] : []),
    ...(!input.suppliesIncluded ? ["El cliente provee los suministros. Asegurarse de que estén disponibles en el momento del servicio."] : []),
  ];

  return {
    toolId:       `cleaning-${Date.now()}`,
    trade:        "cleaning",
    projectType:  `${input.serviceType}-cleaning`,
    mode:         input.mode,
    inputs:       { ...input },
    validationIssues: issues,
    isValid:      isValid(issues),
    materials:    mats,
    labor,
    costs,
    risk,
    milestones,
    evidenceRequired: evidence.items,
    warnings,
    recommendations: [
      "Confirmar acceso al agua y electricidad antes del servicio.",
      "Tomar fotos del estado inicial para proteger al profesional ante reclamos.",
      "Para post-construcción, planificar al menos 2 visitas.",
      ...(input.frequency !== "one_time" ? ["Servicio recurrente: la primera visita puede requerir limpieza profunda con tarifa mayor."] : []),
    ],
    assumptions: [
      "Precios de referencia EE.UU. / Florida 2026.",
      "No incluye mudanza de muebles pesados, reparaciones ni tratamiento de moho.",
      "Alfombras con manchas severas pueden requerir servicio especializado adicional.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runCleaningEngine = calculateCleaning;
