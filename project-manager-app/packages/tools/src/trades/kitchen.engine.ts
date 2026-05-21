import { collect, isValid, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";
import {
  computeConfidenceScore,
  computeDisputeRisk,
  computeReadinessScore,
  computePriceBands,
  buildProductionSchedule,
  buildScope,
  buildExplainedOutput,
  buildWarranty,
  computeRenovationRoi,
  assessScheduleRisk,
} from "../core/extended-metrics.js";

export type KitchenInput = {
  /** Scope of kitchen work */
  scope: "cabinet_update" | "countertops" | "flooring" | "full_remodel";
  /** Kitchen footprint */
  kitchenSize: "small" | "medium" | "large" | "extra_large";
  /** Appliance inclusion */
  appliances: "no_appliances" | "basic_appliances" | "premium_appliances";
  /** Material quality for cabinets / countertops */
  materialQuality: "budget" | "standard" | "premium";
  /** Plumbing or electrical changes */
  plumbingElectrical: "no" | "minor" | "relocate";
  /** Cabinet linear feet (optional override) */
  cabinetLinearFt?: number;
  /** Client already has materials/cabinets */
  clientProvidesMaterials: boolean;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

// ── reference kitchen sizes ────────────────────────────────────────────────────
const KITCHEN_SQ_FT: Record<KitchenInput["kitchenSize"], number> = {
  small:       80,
  medium:     150,
  large:      250,
  extra_large: 380,
};

const CABINET_LINEAR_FT: Record<KitchenInput["kitchenSize"], number> = {
  small:       16,
  medium:      24,
  large:       36,
  extra_large: 48,
};

// ── scope base ranges ──────────────────────────────────────────────────────────
const SCOPE_BASE: Record<KitchenInput["scope"], { min: number; max: number }> = {
  cabinet_update: { min: 2_500,  max: 10_000 },
  countertops:    { min: 1_800,  max: 7_000  },
  flooring:       { min: 1_500,  max: 5_000  },
  full_remodel:   { min: 15_000, max: 60_000 },
};

const MATERIAL_MULTIPLIER: Record<KitchenInput["materialQuality"], number> = {
  budget:   0.60,
  standard: 1.00,
  premium:  1.65,
};

const APPLIANCE_ADDER: Record<KitchenInput["appliances"], number> = {
  no_appliances:    0,
  basic_appliances: 3_500,
  premium_appliances: 9_000,
};

const PLUMBING_ELEC_ADDER: Record<KitchenInput["plumbingElectrical"], number> = {
  no:      0,
  minor:   900,
  relocate: 3_500,
};

const SIZE_FACTOR: Record<KitchenInput["kitchenSize"], number> = {
  small:       0.60,
  medium:      1.00,
  large:       1.45,
  extra_large: 1.90,
};

export function calculateKitchenRemodel(input: KitchenInput): SemseToolResult {
  const sqFt      = KITCHEN_SQ_FT[input.kitchenSize];
  const linearFt  = input.cabinetLinearFt ?? CABINET_LINEAR_FT[input.kitchenSize];
  const base      = SCOPE_BASE[input.scope];

  const issues = collect(
    input.plumbingElectrical === "relocate"
      ? warn("plumbingElectrical", "Reubicación de plomería/electricidad: requiere profesional licenciado y posible permiso.")
      : null,
    input.appliances === "premium_appliances" && input.materialQuality === "budget"
      ? warn("appliances", "Appliances premium con materiales económicos: considerar upgrade de gabinetes para coherencia visual.")
      : null,
    input.clientProvidesMaterials
      ? warn("clientProvidesMaterials", "Materiales del cliente: verificar medidas exactas de gabinetes antes de instalar.")
      : null,
    input.scope === "full_remodel" && input.plumbingElectrical === "no"
      ? warn("plumbingElectrical", "Remodelación completa sin cambios de plomería/electricidad: confirmar que instalaciones actuales están en código.")
      : null,
  );

  // ── cost ─────────────────────────────────────────────────────────────────
  const qualityMult   = MATERIAL_MULTIPLIER[input.materialQuality];
  const sizeFactor    = SIZE_FACTOR[input.kitchenSize];
  const baseMid       = ((base.min + base.max) / 2) * sizeFactor * qualityMult;
  const applianceAdd  = APPLIANCE_ADDER[input.appliances];
  const plumbingAdd   = PLUMBING_ELEC_ADDER[input.plumbingElectrical];

  // Cabinet cost per linear foot depends on material tier
  const cabinetCostPerLF = input.materialQuality === "premium" ? 420 : input.materialQuality === "standard" ? 230 : 110;
  const countertopPerSqFt = input.materialQuality === "premium" ? 85 : input.materialQuality === "standard" ? 45 : 22;
  const countertopSqFt    = Math.round(linearFt * 2.5); // approx counter area

  const mats = input.clientProvidesMaterials
    ? [
        material("Installation labor materials (client cabinets)", 1, "job", baseMid * 0.35, "Labor"),
        material("Hardware, fasteners, shims, misc", 1, "lot", 280, "Misc"),
      ]
    : [
        ...(input.scope !== "flooring" && input.scope !== "countertops"
          ? [material(`Cabinets (${input.materialQuality})`, linearFt, "lin.ft", cabinetCostPerLF, "Cabinets")]
          : []),
        ...(input.scope !== "flooring" && input.scope !== "cabinet_update"
          ? [material(`Countertop (${input.materialQuality})`, countertopSqFt, "sqft", countertopPerSqFt, "Countertop")]
          : []),
        ...(input.scope === "flooring" || input.scope === "full_remodel"
          ? [material("Kitchen flooring", sqFt, "sqft", input.materialQuality === "premium" ? 9 : 5, "Flooring")]
          : []),
        material("Backsplash tile", Math.round(linearFt * 1.5 * 1.5), "sqft", 6, "Finishes"),
        material("Sink, faucet, garbage disposal", 1, "set", 650 * qualityMult, "Fixtures"),
        material("Hardware, fasteners, misc", 1, "lot", 350, "Misc"),
      ];

  const laborHours =
    (linearFt * 1.5) +
    (input.scope === "full_remodel" ? 30 : input.scope === "cabinet_update" ? 12 : 10) +
    (input.plumbingElectrical === "relocate" ? 16 : input.plumbingElectrical === "minor" ? 6 : 0);

  const labor = estimateLabor({
    baseHours:  laborHours,
    crewSize:   input.scope === "full_remodel" ? 3 : 2,
    ratePerHour: 68,
    difficulty: input.scope === "full_remodel" || input.plumbingElectrical === "relocate" ? "complex" : "moderate",
    notes: [
      `Alcance: ${input.scope}`,
      `Tamaño: ${input.kitchenSize} (${sqFt} sqft, ${linearFt} lin.ft de gabinetes)`,
      `Appliances: ${input.appliances}`,
    ],
  });

  const costs = buildCostSummary(
    materialTotal(mats) + applianceAdd + plumbingAdd,
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
      factor("fullRemodel",        "Remodelación completa de cocina",  0.22, input.scope === "full_remodel"),
      factor("plumbingRelocate",   "Reubicación plomería/electricidad",0.22, input.plumbingElectrical === "relocate"),
      factor("premiumAppliances",  "Appliances premium",               0.10, input.appliances === "premium_appliances"),
      factor("premiumMaterials",   "Materiales premium",               0.08, input.materialQuality === "premium"),
      factor("clientMaterials",    "Materiales del cliente",           0.12, input.clientProvidesMaterials),
      factor("minorPlumbing",      "Cambios menores de plomería/elect",0.08, input.plumbingElectrical === "minor"),
    ],
    {
      requiresPermit:     input.plumbingElectrical === "relocate",
      requiresLicense:    input.plumbingElectrical !== "no",
      requiresInspection: input.scope === "full_remodel",
      requiresEngineering: false,
    }
  );

  // ── milestones ────────────────────────────────────────────────────────────
  const milestoneNames = input.scope === "full_remodel"
    ? ["Diseño y aprobación", "Demo y rough-in", "Instalación de gabinetes base", "Gabinetes superiores y countertop", "Backsplash y appliances", "Acabados y entrega"]
    : ["Confirmación de alcance", "Preparación", "Instalación principal", "Acabados y entrega"];

  const milestoneDocs = input.scope === "full_remodel"
    ? [
        ["Layout aprobado", "Materiales seleccionados"],
        ["Fotos de demo", "Fotos de rough-in"],
        ["Fotos de gabinetes base", "Fotos de nivelación"],
        ["Fotos de gabinetes superiores", "Fotos de countertop instalado"],
        ["Fotos de backsplash", "Fotos de appliances conectados"],
        ["Fotos finales", "Aprobación del cliente"],
      ]
    : [
        ["Fotos iniciales", "Confirmación de materiales"],
        ["Fotos área preparada"],
        ["Fotos de avance principal"],
        ["Fotos finales", "Aprobación del cliente"],
      ];

  const milestones = buildMilestones(costs.total, risk.level, milestoneNames, milestoneDocs);

  const evidence = buildEvidenceChecklist("kitchen", risk, milestones, [
    { type: "photo",      description: "Estado inicial de la cocina",        required: true, milestone: 1 },
    { type: "photo",      description: "Demo y rough-in de plomería/elect",  required: input.scope === "full_remodel", milestone: 2 },
    { type: "photo",      description: "Gabinetes instalados",               required: true, milestone: 3 },
    { type: "photo",      description: "Countertop instalado",               required: input.scope !== "flooring", milestone: 4 },
    { type: "inspection", description: "Aprobación final del cliente",       required: true, milestone: milestoneNames.length },
  ] as EvidenceItem[]);

  const warnings: string[] = [
    ...(input.plumbingElectrical === "relocate" ? ["Reubicación de plomería/electricidad: requiere profesional licenciado y posible permiso."] : []),
    ...(input.appliances === "premium_appliances" ? ["Appliances premium: confirmar espacios, conexiones y voltajes antes de instalar gabinetes."] : []),
    ...(input.clientProvidesMaterials ? ["Gabinetes del cliente: verificar medidas y que todos los componentes estén presentes antes de instalar."] : []),
    ...(input.scope === "full_remodel" ? ["Remodelación completa: no cerrar rough-in sin foto aprobada. El template de countertop va después de gabinetes instalados."] : []),
  ];

  // ── Extended metrics ────────────────────────────────────────────────────────
  const confidenceScore = computeConfidenceScore({
    hasMeasurements:      linearFt > 0,
    hasPhotos:            false,
    hasConditionData:     true,
    hasMaterialSelection: input.materialQuality !== undefined,
    hasScopeConfirmed:    input.scope !== undefined,
    clientProvidesMaterials: input.clientProvidesMaterials,
    hasUnknownConditions: input.plumbingElectrical === "relocate",
    extraConfirmedFields: [
      input.appliances !== "no_appliances",
      !input.clientProvidesMaterials,
      input.plumbingElectrical === "no",
    ].filter(Boolean).length,
  });

  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous:          input.scope === "full_remodel" && input.plumbingElectrical !== "no",
    clientProvidesMaterials: input.clientProvidesMaterials,
    noPhotosRequired:        false,
    hasChangeOrderPolicy:    true,
    hasEvidenceRequired:     true,
    hasMilestones:           milestones.length > 0,
    hasHighRiskConditions:   input.plumbingElectrical === "relocate",
    priceIsFixed:            false,
    clientExpectationMismatch: input.appliances === "premium_appliances" && input.materialQuality === "budget",
  });

  const readinessScore = computeReadinessScore({
    measurementsConfirmed:  linearFt > 0,
    materialsAvailable:     !input.clientProvidesMaterials,
    siteAccessConfirmed:    true,
    permitsAddressed:       input.plumbingElectrical === "no",
    scopeApproved:          true,
    depositPaid:            false,
    clientApproval:         false,
    otherTradesCoordinated: input.plumbingElectrical === "no",
    designApproved:         input.scope === "cabinet_update",
  });

  const priceBands = computePriceBands(
    costs.total,
    0.65,
    1.55,
    {
      low:  "Cabinet update only, budget materials, no plumbing/electrical changes.",
      mid:  "Standard scope and materials, minor trade coordination.",
      high: "Full remodel, premium materials, appliances, plumbing/electrical relocation.",
    }
  );

  const productionSchedule = buildProductionSchedule([
    { name: "Measurement & design approval", daysMin: 1, daysMax: 3,  crew: 1, description: "Final measurements, layout, material confirmation" },
    { name: "Material procurement",          daysMin: 3, daysMax: 14, crew: 0, description: "Cabinet lead time — varies by brand" },
    ...(input.scope === "full_remodel" ? [
      { name: "Demo & disposal",             daysMin: 1, daysMax: 3,  crew: 2, description: "Remove existing cabinets, countertops, backsplash" },
      { name: "Rough-in plumbing/electrical",daysMin: 1, daysMax: 4,  crew: 2, description: "Plumbing and electrical rough-in if applicable" },
    ] : []),
    { name: "Cabinet installation",          daysMin: 2, daysMax: 5,  crew: 2, description: "Base and wall cabinet install, leveling, alignment" },
    { name: "Countertop template & install", daysMin: 3, daysMax: 7,  crew: 2, description: "Template after cabinets settled, fabrication, install" },
    { name: "Backsplash & appliances",       daysMin: 1, daysMax: 3,  crew: 2, description: "Tile, appliance connections, sink, faucet" },
    { name: "Punch list & cleanup",          daysMin: 1, daysMax: 1,  crew: 1, description: "Adjustments, final photos, client walkthrough" },
  ]);

  const scope = buildScope(
    [
      `${input.scope === "cabinet_update" ? "Cabinet update" : "Cabinet installation"} (${linearFt} lin.ft)`,
      ...(input.scope !== "flooring" && input.scope !== "cabinet_update" ? ["Countertop installation (countertop template separate)"] : []),
      ...(input.scope === "flooring" || input.scope === "full_remodel" ? ["Kitchen flooring"] : []),
      "Backsplash tile (basic pattern)",
      "Sink, faucet, and garbage disposal connection",
      "Cabinet hardware installation",
      "Basic cleanup and debris removal",
    ],
    [
      "Countertop fabrication lead time (external vendor)",
      "Appliance purchase (unless in scope)",
      "Full room painting",
      "Flooring beyond kitchen area",
      "Electrical panel upgrade",
      ...(input.plumbingElectrical === "no" ? ["Plumbing or electrical relocation"] : []),
      "Structural wall changes",
      "Design services",
      "Permits unless included",
    ],
    [
      "Cabinet dimensions match available space",
      "Appliances are confirmed before cabinet layout is finalized",
      "Countertop template is done after cabinets are leveled and secured",
    ],
    [
      "Client changes layout or cabinet design after order is placed",
      "Hidden plumbing or electrical discovered during demo",
      "Uneven walls or floors requiring extra shimming",
      "Appliance doesn't fit the space as designed",
      "Countertop vendor delay beyond estimated timeline",
    ]
  );

  const explained = buildExplainedOutput(
    `Your kitchen ${input.scope.replace("_", " ")} is estimated at $${Math.round(costs.total).toLocaleString()}. ` +
    `This covers ${linearFt} lin.ft of cabinets, countertop coordination, backsplash, and sink/faucet. ` +
    `${input.appliances !== "no_appliances" ? "Appliance installation is included. " : ""}` +
    `Work is structured in milestones with photos required before each payment release.`,
    [
      `Scope: ${input.scope} — size: ${input.kitchenSize} — ${linearFt} lin.ft cabinets`,
      `Material tier: ${input.materialQuality} — appliances: ${input.appliances}`,
      "CRITICAL: countertop template must be done AFTER cabinets are leveled. Do not rush.",
      ...(input.plumbingElectrical !== "no" ? [`Plumbing/electrical: ${input.plumbingElectrical} — coordinate licensed sub before cabinet day`] : []),
      "Measure appliance spaces 3x before ordering cabinets — wrong size = expensive change order",
      "Client must confirm cabinet door style, hardware, and color BEFORE ordering",
    ]
  );

  const warranty = buildWarranty(
    120,
    `Kitchen ${input.scope.replace("_", " ")} — labor on cabinet installation, alignment, and hardware`,
    [
      "Cabinet manufacturer defects (covered by manufacturer warranty)",
      "Countertop cracks from impact or improper use",
      "Appliance malfunction",
      "Backsplash grout cracking from structural movement",
    ]
  );

  const roi = computeRenovationRoi(
    costs.total,
    input.scope === "full_remodel" ? 1.75 : 1.40,
    "Kitchen renovations typically return 60-80% in home value. Full remodels in Florida market have strong resale appeal.",
    48
  );

  const scheduleRisk = assessScheduleRisk({
    dependsOnOtherTrades: input.plumbingElectrical !== "no",
    clientMustDecide:     input.clientProvidesMaterials || input.scope === "full_remodel",
    materialsOnSite:      !input.clientProvidesMaterials,
    weatherDependent:     false,
    scopeIsLarge:         input.scope === "full_remodel",
    hasComplexDetails:    input.appliances === "premium_appliances",
  });

  return {
    toolId:       `kitchen-${Date.now()}`,
    trade:        "remodeling",
    projectType:  `kitchen-${input.scope}`,
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
      "Confirmar medidas de gabinetes y espacios de appliances antes de comprar.",
      "El template de countertop debe hacerse con gabinetes ya instalados y nivelados.",
      "No instalar backsplash hasta confirmar que el countertop está asentado.",
      ...(input.plumbingElectrical !== "no" ? ["Obtener permiso de plomería/electricidad si el municipio lo requiere."] : []),
    ],
    assumptions: [
      "Precios de referencia EE.UU. / Florida 2026.",
      "Pintura de cocina no incluida en este cálculo.",
      "Diseño/layout debe aprobarse antes de comprar gabinetes.",
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
    scheduleRisk,
    createdAt: new Date().toISOString(),
  };
}

export const runKitchenEngine = calculateKitchenRemodel;
