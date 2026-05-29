import { collect, isValid, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";
import {
  buildInspectionGate,
  assessHiddenDamageProbability,
  computeConfidenceScore,
  computeDisputeRisk,
  computeReadinessScore,
  computePriceBands,
  buildProductionSchedule,
  buildScope,
  buildExplainedOutput,
  buildWarranty,
  assessScheduleRisk,
  buildTaskMatrix,
  buildRecurringPricing,
  computeSafeToProceed,
  ALGORITHM_VERSIONS,
  buildAlgorithmTrace,
} from "../core/extended-metrics.js";

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
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
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

  // ── Task matrix by service type ──────────────────────────────────────────
  const TASK_MATRICES: Record<CleaningInput["serviceType"], string[]> = {
    standard:          ["Sweep/vacuum all floors", "Mop floors", "Clean bathrooms", "Wipe kitchen surfaces", "Remove trash", "Dust accessible surfaces"],
    deep:              ["Sweep/vacuum all floors", "Mop floors", "Deep-clean bathrooms", "Clean appliance exteriors", "Wipe baseboards", "Clean cabinet exteriors", "Remove trash", "Dust all surfaces", "Clean mirrors and glass"],
    move_inout:        ["Inside cabinets cleaned", "Inside appliances if selected", "Closets emptied and cleaned", "Baseboards and trim", "Full bathroom/kitchen reset", "Wipe all surfaces", "Floors", "Remove debris"],
    post_construction: ["Construction dust removal — first pass", "Wipe all surfaces", "Clean window sills and frames", "Sweep/vacuum/mop floors", "Clean bathrooms", "Remove light debris", "Final walkthrough — second pass for fine dust"],
    commercial:        ["All floors swept/mopped", "Bathrooms sanitized", "Common areas dusted", "Trash removed", "Kitchen/break room cleaned", "High-touch surfaces disinfected", "Glass/mirrors cleaned"],
  };

  const taskItems = TASK_MATRICES[input.serviceType] ?? TASK_MATRICES.standard;
  const taskMatrix = buildTaskMatrix(
    taskItems.map((task, idx) => ({
      task,
      phase: (idx === 0 ? "before" : idx === taskItems.length - 1 ? "after" : "during") as "before" | "during" | "after",
      required: true,
      evidenceRequired: idx === 0 || idx === taskItems.length - 1,
    })),
    Math.round(estimatedHours * 60),
    input.condition === "post_construction" ? "specialized" as const :
    ["deep", "move_inout"].includes(input.serviceType) ? "detailed" as const : "standard" as const
  );

  // ── Recurring pricing ──────────────────────────────────────────────────────
  const recurringPricing = buildRecurringPricing(costs.total);

  // ── Algorithm trace ────────────────────────────────────────────────────────
  const algorithmTrace = buildAlgorithmTrace(
    ALGORITHM_VERSIONS.cleaning,
    "cleaning",
    ["serviceType", "squareFt", "bedrooms", "bathrooms", "condition", "frequency"],
    input.addOns.length === 0 ? ["addOns — none selected"] : [],
    [
      `Condition multiplier: ${conditionMult}x`,
      `Frequency discount: ${FREQUENCY_MULT[input.frequency]}x`,
      `Base rate: $${BASE_RATE_PER_SQFT[input.serviceType]}/sqft`,
    ],
    [
      { ruleId: "POST_CONSTRUCTION", label: "Post-construction",    triggered: input.serviceType === "post_construction", points: 20, reason: "Requires multiple passes" },
      { ruleId: "HEAVY_CONDITION",   label: "Heavy condition",      triggered: input.condition === "heavy",              points: 18, reason: "Heavy soil increases labor significantly" },
      { ruleId: "MOVE_INOUT",        label: "Move-in/out",          triggered: input.serviceType === "move_inout",       points: 12, reason: "Inside cabinets/appliances add significant time" },
    ]
  );

  // ── Extended metrics ────────────────────────────────────────────────────────
  const confidenceScore = computeConfidenceScore({
    hasMeasurements:      input.squareFt > 0,
    hasPhotos:            false,
    hasConditionData:     input.condition !== undefined,
    hasMaterialSelection: true,
    hasScopeConfirmed:    true,
    clientProvidesMaterials: !input.suppliesIncluded,
    hasUnknownConditions: input.condition === "heavy",
    extraConfirmedFields: input.addOns.length + (input.frequency !== "one_time" ? 1 : 0),
  });

  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous:          false,
    clientProvidesMaterials: !input.suppliesIncluded,
    noPhotosRequired:        false,
    hasChangeOrderPolicy:    true,
    hasEvidenceRequired:     true,
    hasMilestones:           milestones.length > 0,
    hasHighRiskConditions:   input.condition === "heavy" || input.serviceType === "post_construction",
    priceIsFixed:            input.frequency !== "one_time",
    clientExpectationMismatch: input.serviceType === "standard" && input.condition === "heavy",
  });

  const readinessScore = computeReadinessScore({
    measurementsConfirmed:  input.squareFt > 0,
    materialsAvailable:     input.suppliesIncluded,
    siteAccessConfirmed:    true,
    permitsAddressed:       true,
    scopeApproved:          true,
    depositPaid:            false,
    clientApproval:         false,
    otherTradesCoordinated: true,
  });

  const priceBands = computePriceBands(
    costs.total,
    0.80,
    1.45,
    {
      low:  "Light condition, standard cleaning, no add-ons, client provides supplies.",
      mid:  "Moderate condition, selected add-ons, professional supplies.",
      high: "Heavy/post-construction, all add-ons, multiple passes required.",
    }
  );

  const productionSchedule = buildProductionSchedule([
    { name: "Arrival & inspection",        daysMin: 0, daysMax: 0, crew: crewSize, description: "Quick walkthrough, before photos" },
    { name: "Kitchen & bathrooms",         daysMin: 0, daysMax: 0, crew: crewSize, description: "Deep clean high-priority wet areas first" },
    ...(input.serviceType === "post_construction"
      ? [{ name: "Dust removal — first pass", daysMin: 0, daysMax: 0, crew: crewSize, description: "Remove construction dust from all surfaces" }]
      : []),
    { name: "Bedrooms & common areas",     daysMin: 0, daysMax: 0, crew: crewSize, description: "Vacuum, mop, wipe down surfaces" },
    { name: "Floors",                      daysMin: 0, daysMax: 0, crew: crewSize, description: "Sweep, vacuum, mop all floor types" },
    ...(input.addOns.includes("windows")
      ? [{ name: "Window cleaning",        daysMin: 0, daysMax: 0, crew: 1, description: "Interior windows and tracks" }]
      : []),
    { name: "Final walkthrough & photos",  daysMin: 0, daysMax: 0, crew: 1,        description: "Quality check, after photos, client sign-off" },
  ]);

  const addOnList = input.addOns.map(ao => {
    const names: Record<string, string> = {
      windows: "Interior window cleaning", carpet: "Carpet cleaning",
      disinfection: "Disinfection treatment", laundry: "Laundry",
      oven: "Inside oven cleaning", fridge: "Inside refrigerator cleaning",
      extras: "Additional extra services",
    };
    return names[ao] ?? ao;
  });

  const scope = buildScope(
    [
      `${input.serviceType.replace("_", " ")} cleaning — ${input.squareFt} sqft`,
      `${input.bedrooms} bedroom(s), ${input.bathrooms} bathroom(s)`,
      "Kitchen surfaces, appliance exteriors, countertops",
      "Bathroom fixtures, mirrors, floors",
      "All floors (sweep, vacuum, mop)",
      "Dusting of accessible surfaces",
      "Trash removal (from interior bins)",
      ...addOnList,
    ],
    [
      "Moving heavy furniture",
      "Carpet stain removal (requires specialized equipment)",
      "Mold or biohazard treatment",
      "Exterior window cleaning",
      "Organizing or decluttering",
      "Repair or maintenance work",
      ...(input.suppliesIncluded ? [] : ["Professional supplies (client must provide)"]),
      "Post-cleaning odor from external sources",
    ],
    [
      "Water and electricity are available at the property",
      "Property is accessible at the agreed time",
      "Heavy furniture does not need to be moved",
    ],
    [
      "Property is significantly dirtier than described",
      "Client adds rooms or areas not included in original quote",
      "Access is delayed causing crew time loss",
      "Post-construction has multiple layers of dust requiring repeat visits",
      "Mold or biohazard discovered requiring specialized treatment",
    ]
  );

  const freqLabel = input.frequency === "one_time" ? "one-time visit" : `${input.frequency} service`;

  const explained = buildExplainedOutput(
    `Your ${input.serviceType.replace("_", " ")} cleaning (${freqLabel}) for ${input.squareFt} sqft is estimated at $${Math.round(costs.total).toLocaleString()}. ` +
    `The crew of ${crewSize} will complete the work in approximately ${Math.round(estimatedHours)} hours. ` +
    `Before and after photos are required for each visit to protect both client and professional.`,
    [
      `Service: ${input.serviceType} — condition: ${input.condition} — freq: ${input.frequency}`,
      `Area: ${input.squareFt} sqft — ${input.bedrooms} bed / ${input.bathrooms} bath — crew: ${crewSize}`,
      `Est. hours: ${estimatedHours.toFixed(1)} — condition multiplier: ${conditionMult}x`,
      ...(input.addOns.length > 0 ? [`Add-ons: ${input.addOns.join(", ")}`] : []),
      ...(input.condition === "post_construction" ? ["POST-CONSTRUCTION: Plan for 2+ passes. Fine dust resettles after first clean."] : []),
      ...(input.condition === "heavy" ? ["HEAVY CONDITION: On-site inspection recommended before committing to fixed price."] : []),
      "ALWAYS take before photos — critical for dispute prevention on move-out cleans",
    ]
  );

  const warranty = buildWarranty(
    2,
    `${input.serviceType.replace("_", " ")} cleaning service`,
    [
      "Re-soiling after service completion",
      "Odors from structural sources (mold, plumbing)",
      "Stains that cannot be removed with standard cleaning products",
      "Damage caused by existing wear or pre-existing conditions",
    ]
  );

  const scheduleRisk = assessScheduleRisk({
    dependsOnOtherTrades: false,
    clientMustDecide:     false,
    materialsOnSite:      input.suppliesIncluded,
    weatherDependent:     false,
    scopeIsLarge:         input.squareFt > 3000,
    hasComplexDetails:    input.condition === "post_construction",
  });


  const inspectionGate = buildInspectionGate(
    "Before starting — initial walkthrough and condition documentation",
    ["Pre-clean condition photos", "Damage or stain inventory", "Special area flagging"],
    "Pre-existing damage or stain discovered requiring client notification before cleaning",
    "Document all pre-existing damage before starting. No cleaning begins until client acknowledges condition."
  );

  const hiddenDamage = assessHiddenDamageProbability(
    undefined,
    false,
    false,
    false,
    false,
    false
  );

  const upsells = [
    { service: "Recurring maintenance plan", reason: "Lock in recurring revenue — offer biweekly at 15% discount while relationship is fresh." },
    { service: "Carpet deep clean and deodorize", reason: "Crew is on-site with equipment — add carpet treatment for high-margin upsell." },
    { service: "Window interior wash", reason: "Extend clean to windows while crew is already staged — 20-30 min per room." },
  ];

  const roi = {
    investmentAmount:    costs.total,
    estimatedValueAdded: Math.round(costs.total * 1.0),
    roiPercent:          100,
    notes:               "Professional cleaning delivers immediate ROI via time savings, health, and property condition. Recurring contracts compound value.",
  };

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
    // Extended metrics
    confidenceScore,
    disputeRisk,
    readinessScore,
    priceBands,
    productionSchedule,
    scope,
    explained,
    warranty,
    scheduleRisk,
    taskMatrix,
    recurringPricing,
    safeToProceed: {
      canEstimate:           input.squareFt > 0,
      canPublish:            readinessScore.score >= 40,
      canCreateBuildOpsPlan: milestones.length > 0 && evidence.items.length > 0,
      canCreateContract:     confidenceScore.score >= 65,
      canRequestPayment:     false,
      reasons:               readinessScore.blockers,
    },
    algorithmTrace,
    inspectionGate,
    hiddenDamageAssessment: hiddenDamage,
    upsells,
    roi,
    createdAt: new Date().toISOString(),
  };
}

export const runCleaningEngine = calculateCleaning;
