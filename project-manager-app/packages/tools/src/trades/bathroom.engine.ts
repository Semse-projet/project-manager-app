import { collect, isValid, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";
import {
  buildInspectionGate,
  computeConfidenceScore,
  computeDisputeRisk,
  computeReadinessScore,
  computePriceBands,
  buildProductionSchedule,
  buildScope,
  buildExplainedOutput,
  buildWarranty,
  computeRenovationRoi,
  assessHiddenDamageProbability,
  assessScheduleRisk,
} from "../core/extended-metrics.js";

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
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
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

  // ── Extended metrics ────────────────────────────────────────────────────────
  const confidenceScore = computeConfidenceScore({
    hasMeasurements:      input.bathroomSqFt !== undefined,
    hasPhotos:            false,
    hasConditionData:     true,
    hasMaterialSelection: input.materialQuality !== undefined,
    hasScopeConfirmed:    input.scope !== undefined,
    clientProvidesMaterials: input.clientProvidesMaterials,
    hasUnknownConditions: false,
    extraConfirmedFields: [input.includesShower, input.includesTub, input.demoRequired].filter(Boolean).length,
  });

  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous:             false,
    clientProvidesMaterials:    input.clientProvidesMaterials,
    noPhotosRequired:           false,
    hasChangeOrderPolicy:       true,
    hasEvidenceRequired:        true,
    hasMilestones:              milestones.length > 0,
    hasHighRiskConditions:      input.plumbingWork === "relocate" || input.scope === "full_remodel",
    priceIsFixed:               false,
    clientExpectationMismatch:  input.scope === "full_remodel" && input.materialQuality === "budget",
  });

  const readinessScore = computeReadinessScore({
    measurementsConfirmed:    true,
    materialsAvailable:       !input.clientProvidesMaterials,
    siteAccessConfirmed:      true,
    permitsAddressed:         input.plumbingWork !== "relocate",
    scopeApproved:            true,
    depositPaid:              false,
    clientApproval:           false,
    otherTradesCoordinated:   input.plumbingWork === "no_move",
    designApproved:           input.scope === "cosmetic",
  });

  const priceBands = computePriceBands(
    costs.total,
    0.72,
    1.45,
    {
      low:  "Cosmetic scope, budget materials, no demo, no plumbing changes.",
      mid:  "Standard scope and materials, normal conditions.",
      high: "Full remodel, premium materials, plumbing relocation, hidden damage.",
    }
  );

  const productionSchedule = buildProductionSchedule([
    { name: "Site prep & protection",  daysMin: 0, daysMax: 1, crew: 1, description: "Protect floors and adjacent areas" },
    ...(input.demoRequired ? [{ name: "Demo", daysMin: 1, daysMax: 2, crew: 2, description: "Remove existing fixtures and finishes" }] : []),
    ...(input.plumbingWork !== "no_move" ? [{ name: "Rough-in plumbing", daysMin: 1, daysMax: 3, crew: 2, description: "Plumbing rough-in and inspection" }] : []),
    ...(input.includesShower ? [{ name: "Waterproofing", daysMin: 1, daysMax: 2, crew: 1, description: "Cement board + waterproofing membrane + cure time" }] : []),
    { name: "Tile installation",       daysMin: 2, daysMax: 4, crew: 2, description: "Floor + wall tile, grouting, caulking" },
    { name: "Fixtures & hardware",     daysMin: 1, daysMax: 2, crew: 2, description: "Vanity, toilet, shower, faucets, mirrors" },
    { name: "Punch list & cleanup",    daysMin: 0, daysMax: 1, crew: 1, description: "Touch-ups, final walkthrough, photos" },
  ]);

  const scope = buildScope(
    [
      "Bathroom prep and area protection",
      ...(input.demoRequired ? ["Demo of existing finishes"] : []),
      ...(input.scope !== "cosmetic" ? ["Tile installation (floor and/or walls)"] : []),
      ...(input.includesShower ? ["Shower installation with waterproofing"] : []),
      ...(input.includesTub ? ["Tub installation"] : []),
      ...(!input.clientProvidesMaterials ? ["Vanity, sink, toilet, and basic fixtures"] : []),
      "Grout, caulk, and sealant",
      "Basic cleanup",
    ],
    [
      "Electrical work (GFCI, lighting, exhaust fan) unless specified",
      "Painting of bathroom walls",
      "Structural framing repair",
      "Mold remediation",
      ...(input.plumbingWork === "no_move" ? ["Plumbing relocation"] : []),
      ...(input.clientProvidesMaterials ? [] : ["Specialty or custom fixtures beyond standard"]),
      "Permits (may be required for plumbing — verify locally)",
    ],
    [
      "Wall and floor are structurally sound",
      "Water has been shut off before work begins",
      "Existing plumbing is in functional condition unless noted",
    ],
    [
      "Hidden water damage or rot discovered after demo",
      "Mold found behind existing finishes",
      "Plumbing relocation not included in original scope",
      "Client changes material or scope after approval",
      "Subfloor damage requires repair before tile",
    ]
  );

  const explained = buildExplainedOutput(
    `Your bathroom ${input.scope.replace("_", " ")} is estimated at $${Math.round(costs.total).toLocaleString()}. ` +
    `This covers ${input.includesShower ? "shower, " : ""}tile, vanity, and standard fixtures. ` +
    `${input.plumbingWork === "relocate" ? "Plumbing relocation is included and will require a permit. " : ""}` +
    `Payments are broken into milestones with photo evidence required at each stage to protect both parties.`,
    [
      `Scope: ${input.scope} — size: ${input.bathroomSqFt} — plumbing: ${input.plumbingWork}`,
      `Material tier: ${input.materialQuality} — multiplier: ${MATERIAL_MULTIPLIER[input.materialQuality]}x`,
      ...(input.includesShower ? ["Waterproofing membrane required before tile — photo mandatory before covering"] : []),
      ...(input.plumbingWork === "relocate" ? ["Permit required. Coordinate with licensed plumber before scheduling tile"] : []),
      `Hidden damage probability: ${risk.score > 50 ? "high" : "medium"} — document all pre-existing conditions`,
      "Do not close rough-in without approved photo — this protects against future disputes",
    ]
  );

  const warranty = buildWarranty(
    90,
    `Bathroom ${input.scope.replace("_", " ")} — labor on tile installation, fixture installation, and waterproofing`,
    [
      "Plumbing leaks caused by supply line or manufacturer defect",
      "Grout cracking due to structural settlement",
      "Caulk separation due to building movement",
      "Water damage from client use or external sources",
    ]
  );

  const roi = computeRenovationRoi(
    costs.total,
    input.scope === "full_remodel" ? 1.65 : 1.30,
    `Bathroom ${input.scope.replace("_", " ")} typically recovers 60-80% of investment in home value in Florida market.`,
    36
  );

  const hiddenDamage = assessHiddenDamageProbability(
    undefined,
    false,
    false,
    input.demoRequired,
    false,
    false
  );

  const scheduleRisk = assessScheduleRisk({
    dependsOnOtherTrades: input.plumbingWork !== "no_move",
    clientMustDecide:     input.clientProvidesMaterials,
    materialsOnSite:      !input.clientProvidesMaterials,
    weatherDependent:     false,
    scopeIsLarge:         input.scope === "full_remodel",
    hasComplexDetails:    input.materialQuality === "premium",
  });


  const inspectionGate = buildInspectionGate(
    "After demolition and waterproofing — before tile and fixture installation",
    ["Demo condition photos", "Waterproofing membrane photos", "Plumbing rough-in sign-off"],
    "Hidden damage, mold, or plumbing deficiency found during demo requiring repair",
    "Inspect subfloor, walls, and plumbing rough-in before any waterproofing or tile work begins."
  );

  const upsells = [
    { service: "Heated floor mat (electric radiant)", reason: "Install wire mat before tile — same labor visit, adds comfort and resale appeal." },
    { service: "Frameless glass shower door", reason: "Upgrade from standard door at close of tile work — no extra demo needed." },
    { service: "Smart exhaust fan with humidity sensor", reason: "Prevents mold at the source — replaces standard fan for minimal upcharge." },
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
    // Extended metrics
    confidenceScore,
    disputeRisk,
    readinessScore,
    priceBands,
    productionSchedule,
    scope,
    explained,
    warranty,
    roi,
    hiddenDamageAssessment: hiddenDamage,
    scheduleRisk,
    inspectionGate,
    upsells,
    createdAt: new Date().toISOString(),
  };
}

export const runBathroomEngine = calculateBathroomRemodel;
