import { collect, isValid, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, SemseToolResult, ToolMode } from "../core/types.js";

export type BathroomInput = {
  /** What type of work is needed */
  scope: "cosmetic" | "tile_floor" | "tub_shower" | "full_remodel";
  /** Bathroom footprint */
  bathroomSqFt: "small" | "medium" | "large" | "extra_large";
  /** Plumbing change level */
  plumbingWork: "no_move" | "fixtures_only" | "relocate";
  /** Material quality tier */
  materialQuality: "budget" | "standard" | "premium";
  /** Includes shower work */
  includesShower: boolean;
  /** Includes tub work */
  includesTub: boolean;
  /** Demo of existing finishes required */
  demoRequired: boolean;
  /** Client already has materials */
  clientProvidesMaterials: boolean;
  mode: ToolMode;
};

// ── reference sizes ────────────────────────────────────────────────────────────
const BATHROOM_SQ_FT: Record<BathroomInput["bathroomSqFt"], number> = {
  small: 35,
  medium: 60,
  large: 100,
  extra_large: 140,
};

// ── scope base costs (labor + materials blended estimate) ─────────────────────
const SCOPE_BASE: Record<BathroomInput["scope"], { min: number; max: number }> = {
  cosmetic:     { min: 800,   max: 2_500 },
  tile_floor:   { min: 1_500, max: 4_000 },
  tub_shower:   { min: 3_000, max: 9_000 },
  full_remodel: { min: 6_000, max: 20_000 },
};

const MATERIAL_MULTIPLIER: Record<BathroomInput["materialQuality"], number> = {
  budget:   0.70,
  standard: 1.00,
  premium:  1.55,
};

const PLUMBING_ADDER: Record<BathroomInput["plumbingWork"], number> = {
  no_move:      0,
  fixtures_only: 650,
  relocate:     2_500,
};

const SIZE_FACTOR: Record<BathroomInput["bathroomSqFt"], number> = {
  small:       0.75,
  medium:      1.00,
  large:       1.40,
  extra_large: 1.85,
};

export function calculateBathroomRemodel(input: BathroomInput): SemseToolResult {
  const sqFt = BATHROOM_SQ_FT[input.bathroomSqFt];
  const base  = SCOPE_BASE[input.scope];

  const issues = collect(
    input.plumbingWork === "relocate"
      ? warn("plumbingWork", "Reubicación de plomería: requiere plomero licenciado y posible permiso.")
      : null,
    input.scope === "full_remodel" && !input.demoRequired
      ? warn("demoRequired", "Remodelación completa sin demo declarada: verificar si hay material existente a remover.")
      : null,
    input.clientProvidesMaterials
      ? warn("clientProvidesMaterials", "Materiales proveídos por cliente: validar compatibilidad y dimensiones antes de instalar.")
      : null,
    input.includesShower && input.scope === "cosmetic"
      ? warn("includesShower", "Trabajo de shower en alcance cosmético: puede requerir impermeabilización adicional.")
      : null,
  );

  // ── cost calculation ─────────────────────────────────────────────────────
  const materialQualityMult = MATERIAL_MULTIPLIER[input.materialQuality];
  const sizeFactor           = SIZE_FACTOR[input.bathroomSqFt];
  const plumbingAdder        = PLUMBING_ADDER[input.plumbingWork];
  const demoAdder            = input.demoRequired ? sqFt * 8 : 0;
  const showerAdder          = input.includesShower && input.scope !== "full_remodel" ? 1_200 * materialQualityMult : 0;
  const tubAdder             = input.includesTub && input.scope !== "full_remodel" ? 800 * materialQualityMult : 0;

  const baseMid = ((base.min + base.max) / 2) * sizeFactor * materialQualityMult;

  const mats = [
    material("Tile & grout (floor/walls)", Math.round(sqFt * 1.15), "sqft", input.materialQuality === "premium" ? 8.5 : 5.5, "Finishes"),
    material("Cement board / waterproofing membrane", Math.round(sqFt * 0.8), "sqft", 3.2, "Substrate"),
    material("Thinset & grout", Math.ceil(sqFt / 40), "bag", 28, "Install"),
    ...(input.demoRequired ? [material("Demolition disposal", 1, "job", demoAdder, "Demo")] : []),
    ...(input.includesShower ? [material("Shower kit / fixtures", 1, "set", 650 * materialQualityMult, "Fixtures")] : []),
    ...(input.includesTub ? [material("Tub / tub surround", 1, "unit", 550 * materialQualityMult, "Fixtures")] : []),
    ...(!input.clientProvidesMaterials ? [material("Vanity, sink, faucet, toilet", 1, "set", 800 * materialQualityMult, "Fixtures")] : []),
    material("Caulk, sealant, hardware, misc", 1, "lot", 180, "Misc"),
  ];

  const laborHours =
    (sqFt / 20) * 3 +
    (input.scope === "full_remodel" ? 18 : input.scope === "tub_shower" ? 12 : input.scope === "tile_floor" ? 8 : 4) +
    (input.plumbingWork === "relocate" ? 10 : input.plumbingWork === "fixtures_only" ? 4 : 0) +
    (input.demoRequired ? 4 : 0);

  const labor = estimateLabor({
    baseHours:  laborHours,
    crewSize:   input.scope === "full_remodel" ? 3 : 2,
    ratePerHour: 72,
    difficulty: input.scope === "full_remodel" || input.plumbingWork === "relocate" ? "complex" : "moderate",
    notes: [
      `Alcance: ${input.scope}`,
      `Tamaño: ${input.bathroomSqFt} (${sqFt} sqft aprox.)`,
      `Plomería: ${input.plumbingWork}`,
    ],
  });

  const costs = buildCostSummary(
    materialTotal(mats) + plumbingAdder + showerAdder + tubAdder,
    labor.totalCost,
    {
      overhead:       0.15,
      profit:         0.22,
      taxRate:        0.07,
      semseFeeRate:   0.05,
      perUnitDivisor: sqFt || 1,
    }
  );

  // ── risk ─────────────────────────────────────────────────────────────────
  const risk = computeRisk(
    [
      factor("fullRemodel",       "Remodelación completa",        0.20, input.scope === "full_remodel"),
      factor("plumbingRelocate",  "Reubicación de plomería",      0.22, input.plumbingWork === "relocate"),
      factor("shower",            "Trabajo de shower",            0.12, input.includesShower),
      factor("premium",           "Materiales premium",           0.08, input.materialQuality === "premium"),
      factor("clientMaterials",   "Materiales del cliente",       0.10, input.clientProvidesMaterials),
      factor("demo",              "Demolición requerida",         0.10, input.demoRequired),
    ],
    {
      requiresPermit:      input.plumbingWork === "relocate",
      requiresLicense:     input.plumbingWork !== "no_move",
      requiresInspection:  input.scope === "full_remodel" || input.plumbingWork === "relocate",
      requiresEngineering: false,
    }
  );

  // ── milestones ────────────────────────────────────────────────────────────
  const milestoneNames = input.scope === "full_remodel"
    ? ["Confirmación y depósito", "Demo y rough-in", "Impermeabilización", "Instalación de tile", "Fixtures y acabados", "Entrega final"]
    : ["Confirmación de alcance", "Preparación y demo", "Instalación principal", "Acabados y entrega"];

  const milestoneDocs = input.scope === "full_remodel"
    ? [
        ["Fotos del baño antes", "Selección de materiales"],
        ["Fotos de demo", "Fotos de rough-in plomería"],
        ["Fotos de cement board", "Fotos de membrana impermeabilizante"],
        ["Fotos de tile avance", "Fotos de grout"],
        ["Fotos de vanity, toilet, shower instalados"],
        ["Fotos finales", "Aprobación del cliente"],
      ]
    : [
        ["Fotos iniciales", "Confirmación de materiales"],
        ["Fotos de demo si aplica", "Fotos del área preparada"],
        ["Fotos de avance principal"],
        ["Fotos finales", "Aprobación del cliente"],
      ];

  const milestones = buildMilestones(costs.total, risk.level, milestoneNames, milestoneDocs);

  const evidence = buildEvidenceChecklist("bathroom", risk, milestones, [
    { type: "photo",      description: "Estado inicial del baño",        required: true, milestone: 1 },
    { type: "photo",      description: "Demo completada",                 required: input.demoRequired, milestone: 2 },
    { type: "photo",      description: "Impermeabilización aplicada",     required: input.includesShower, milestone: 3 },
    { type: "photo",      description: "Tile instalado",                  required: true, milestone: 4 },
    { type: "inspection", description: "Aprobación de cliente al cierre", required: true, milestone: milestoneNames.length },
  ] as EvidenceItem[]);

  const warnings: string[] = [
    ...(input.plumbingWork === "relocate" ? ["Reubicación de plomería: requiere plomero licenciado. Cotizar separado o incluir en alcance."] : []),
    ...(input.includesShower ? ["Área de shower: aplicar membrana impermeabilizante antes de tile. Sin foto = sin pago del hito."] : []),
    ...(input.clientProvidesMaterials ? ["Materiales del cliente: verificar dimensiones y compatibilidad antes de instalar."] : []),
    ...(input.scope === "full_remodel" ? ["Remodelación completa: no cerrar paredes sin foto de rough-in."] : []),
  ];

  return {
    toolId:       `bathroom-${Date.now()}`,
    trade:        "remodeling",
    projectType:  `bathroom-${input.scope}`,
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
      "Confirmar medidas de vanity, toilet y shower antes de comprar.",
      "Impermeabilizar área de shower/tub antes de instalar tile.",
      "Documentar rough-in de plomería con fotos antes de cerrar pared.",
      ...(input.plumbingWork !== "no_move" ? ["Solicitar permiso de plomería si el municipio lo requiere."] : []),
    ],
    assumptions: [
      "Precios de referencia EE.UU. / Florida 2026.",
      "Electricidad básica del baño no incluida salvo que esté en alcance.",
      "Pintura de paredes no incluida en este cálculo.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runBathroomEngine = calculateBathroomRemodel;
