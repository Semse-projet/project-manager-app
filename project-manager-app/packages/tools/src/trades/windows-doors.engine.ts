import { collect, isValid, range, positive, warn } from "../core/validation-engine.js";
import { applyLocation, buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";
import {
  buildProductionSchedule,
  assessHiddenDamageProbability,
  assessScheduleRisk,
  computeConfidenceScore, computeDisputeRisk, computeReadinessScore,
  computePriceBands, buildScope, buildExplainedOutput, buildWarranty,
  buildInspectionGate, buildAlgorithmTrace, computeSafeToProceed, ALGORITHM_VERSIONS,
} from "../core/extended-metrics.js";

export type WindowInstallType = "replacement" | "new-construction" | "exterior-door" | "interior-door" | "sliding-door" | "patio-door";

export type WindowsDoorsInput = {
  windows: number;
  doors: number;
  installType: WindowInstallType;
  windowCostEach: number;
  doorCostEach: number;
  windowSizeSqFt: number;
  exteriorWork: boolean;
  flashingRequired: boolean;
  trimIncluded: boolean;
  insulationFoam: boolean;
  roughOpeningRepair: boolean;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const LABOR_PER_UNIT: Record<WindowInstallType, number> = {
  "replacement": 2.5, "new-construction": 3.5, "exterior-door": 4.0,
  "interior-door": 2.0, "sliding-door": 5.0, "patio-door": 5.5,
};

export function calculateWindowsDoors(input: WindowsDoorsInput): SemseToolResult {
  const issues = collect(
    range("windows", input.windows, 0, 50, "Window count"),
    range("doors", input.doors, 0, 20, "Door count"),
    input.windows + input.doors === 0 ? warn("windows", "No units specified.") : null,
    input.exteriorWork && !input.flashingRequired ? warn("flashingRequired", "Exterior work without flashing: high leak risk.") : null,
    input.installType === "new-construction" && !input.trimIncluded ? warn("trimIncluded", "New construction without trim: validate finish and gap closure.") : null,
  );

  const unitCount = input.windows + input.doors;
  const flashingKits = input.flashingRequired && input.exteriorWork ? Math.max(1, Math.ceil(input.windows / 2) + input.doors) : 0;
  const trimKits  = input.trimIncluded ? Math.max(1, Math.ceil(unitCount / 2)) : 0;
  const sealKits  = Math.max(1, Math.ceil(unitCount / 3));

  const mats = [
    ...(input.windows > 0 ? [material("Windows", input.windows, "unit", input.windowCostEach, "Windows")] : []),
    ...(input.doors > 0 ? [material("Doors", input.doors, "unit", input.doorCostEach, "Doors")] : []),
    ...(flashingKits > 0 ? [material("Flashing / weatherproofing kit", flashingKits, "kit", 55, "Weatherproofing")] : []),
    ...(trimKits > 0 ? [material("Trim / casing kit", trimKits, "kit", 42, "Finish")] : []),
    material("Sealant / foam / fasteners", sealKits, "kit", input.exteriorWork ? 28 : 22, "Install"),
    ...(input.insulationFoam ? [material("Expanding foam insulation", Math.max(1, Math.ceil(unitCount / 2)), "can", 12, "Insulation")] : []),
    ...(input.roughOpeningRepair ? [material("Rough opening repair materials", Math.max(1, Math.ceil(unitCount / 3)), "kit", 65, "Framing")] : []),
  ];

  const unitHours = LABOR_PER_UNIT[input.installType];
  const labor = estimateLabor({
    baseHours: 2 + unitCount * unitHours + (input.exteriorWork ? 2 : 0) + (input.flashingRequired ? 1.25 : 0)
      + (input.trimIncluded ? unitCount * 0.4 : 0) + (input.roughOpeningRepair ? unitCount * 0.8 : 0),
    crewSize: unitCount > 6 ? 3 : 2,
    ratePerHour: input.exteriorWork ? 68 : 58,
    difficulty: ["new-construction", "sliding-door", "patio-door"].includes(input.installType) || input.exteriorWork ? "complex" : "moderate",
    notes: [`${unitCount} units (${input.windows}W + ${input.doors}D)`, `Type: ${input.installType}`, input.exteriorWork ? "Exterior work" : "Interior"],
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost, input.location, "labor"),
    { overhead: input.exteriorWork ? 0.16 : 0.14, profit: 0.20, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: unitCount || 1 },
  );

  const risk = computeRisk([
    factor("exterior",      "Exterior work",          0.20, input.exteriorWork),
    factor("flashing",      "Flashing required",      0.18, input.flashingRequired),
    factor("sliding",       "Sliding/patio door",     0.16, input.installType === "sliding-door" || input.installType === "patio-door"),
    factor("new_const",     "New construction",       0.12, input.installType === "new-construction"),
    factor("rough_repair",  "Rough opening repair",   0.14, input.roughOpeningRepair),
    factor("multi_unit",    "Multiple units (5+)",    0.10, unitCount >= 5),
  ], { requiresPermit: input.exteriorWork || input.installType === "new-construction", requiresLicense: false, requiresInspection: input.exteriorWork || input.flashingRequired, requiresEngineering: false });

  const milestones = buildMilestones(costs.total, risk.level,
    ["Measure and prep", "Set units", "Seal / trim", "Final inspection"],
    [
      ["Photos of openings", "Measurement confirmation"],
      ["Photos during install", "Level / plumb check"],
      ["Photos of flashing and trim", "Sealant confirmation"],
      ["Final photos", "Client sign-off"],
    ]
  );
  const evidence = buildEvidenceChecklist("windows-doors", risk, milestones, [
    { type: "photo",       description: "Pre-install openings and framing", required: true, milestone: 1 },
    { type: "photo",       description: "Flashing / seal before cover",     required: input.flashingRequired || input.exteriorWork, milestone: 3 },
    { type: "measurement", description: "Level / plumb / fit check",        required: true, milestone: 2 },
    { type: "inspection",  description: "Final review and approval",        required: true, milestone: 4 },
  ]);

  const confidence = computeConfidenceScore({
    hasMeasurements: true, hasPhotos: false, hasConditionData: !input.roughOpeningRepair,
    hasMaterialSelection: true, hasScopeConfirmed: true, hasUnknownConditions: input.roughOpeningRepair,
    extraConfirmedFields: (input.flashingRequired ? 1 : 0) + (input.trimIncluded ? 1 : 0) + (input.insulationFoam ? 1 : 0),
  });
  const readiness = computeReadinessScore({
    measurementsConfirmed: true, materialsAvailable: false, siteAccessConfirmed: true,
    permitsAddressed: !input.exteriorWork, scopeApproved: !input.roughOpeningRepair,
    depositPaid: false, clientApproval: false,
  });
  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous: input.roughOpeningRepair, clientProvidesMaterials: false,
    noPhotosRequired: false, hasChangeOrderPolicy: true, hasEvidenceRequired: true,
    hasMilestones: true, hasHighRiskConditions: input.exteriorWork && !input.flashingRequired,
    priceIsFixed: true, clientExpectationMismatch: false,
  });
  const priceBands = computePriceBands(costs.total, 0.80, input.roughOpeningRepair || input.installType === "sliding-door" ? 1.40 : 1.25, {
    low:  "Interior doors, no trim, standard fit",
    mid:  "Replacement windows, flashing, trim included",
    high: input.roughOpeningRepair ? "Rough opening repair + new construction + exterior + flashing" : "Sliding/patio door + exterior + flashing + trim",
  });
  const scope = buildScope(
    [
      `${unitCount} units (${input.windows} windows, ${input.doors} doors) — ${input.installType}`,
      input.flashingRequired ? "Flashing and weatherproofing" : "", input.trimIncluded ? "Trim / casing" : "",
      input.insulationFoam ? "Expanding foam insulation" : "", input.roughOpeningRepair ? "Rough opening repair" : "",
      "Sealant and fasteners", "Level, plumb, and square verification",
    ].filter(Boolean),
    [!input.trimIncluded ? "Trim / casing (not included)" : "", "Paint or staining of trim", "Structural framing replacement", "Interior patching around units"].filter(Boolean),
    ["Rough openings correctly sized", "US market pricing"],
    ["Rough opening damage requiring structural repair", "Framing rot found during install"],
  );
  const warranty = buildWarranty(365, "1-year labor warranty. Window/door manufacturer warranty: 5–20 years depending on unit.", ["Seal failure from structural movement", "Client-caused damage"]);
  const inspectionGate = buildInspectionGate(
    "After unit set — before trim and sealant cover", ["Level / plumb photos", "Flashing photos"],
    "Out-of-square rough opening or structural damage requiring correction",
    "Verify level, plumb, and square for all units before final seal.",
  );
  const safeToProceed = computeSafeToProceed({
    hasMinimalData: isValid(issues) && unitCount > 0, readinessScore: readiness.score,
    hasCriticalBlockers: false, hasMilestones: true, hasEvidencePlan: true,
    confidenceScore: confidence.score, noCriticalBlockers: true, scopeIsComplete: !input.roughOpeningRepair,
  });
  const explained = buildExplainedOutput(
    `Your ${input.installType} covers ${input.windows} window(s) and ${input.doors} door(s).${input.flashingRequired ? " Flashing included." : ""}${input.trimIncluded ? " Trim included." : ""} Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
    [`${unitCount} units @ avg ${unitHours}h each — ${input.exteriorWork ? "exterior" : "interior"} work`, `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`],
  );
  const algorithmTrace = buildAlgorithmTrace(ALGORITHM_VERSIONS.windows_doors, "windows-doors",
    ["windows", "doors", "installType", "exteriorWork", "flashingRequired"],
    input.roughOpeningRepair ? ["rough opening condition"] : [], ["Rough openings correctly sized", "US market pricing"],
    [
      { ruleId: "EXTERIOR_RISK",    label: "Exterior work risk",      triggered: input.exteriorWork,                   reason: "Weather exposure, flashing, sealing complexity", points: 20 },
      { ruleId: "SLIDING_PREMIUM",  label: "Sliding/patio premium",   triggered: input.installType === "sliding-door" || input.installType === "patio-door", reason: "Track, level, and drainage complexity", points: 16 },
      { ruleId: "ROUGH_REPAIR",     label: "Rough opening repair",    triggered: input.roughOpeningRepair,             reason: "Hidden framing condition — change-order risk", points: 14 },
    ],
  );


  const productionSchedule = buildProductionSchedule([
    { name: 'Measure and confirm order', daysMin: 1, daysMax: 2, crew: 1, description: 'Verify rough opening dimensions, confirm unit order' },
    { name: 'Site prep and protection', daysMin: 0, daysMax: 1, crew: 2, description: 'Protect interior, stage units, prep tools' },
    { name: 'Unit installation', daysMin: 1, daysMax: 3, crew: 2, description: 'Set units, level/plumb/square, fasten to rough opening' },
    { name: 'Flashing and sealing', daysMin: 1, daysMax: 1, crew: 2, description: 'Install flashing, apply foam, caulk perimeter' },
    { name: 'Trim and hardware', daysMin: 1, daysMax: 2, crew: 2, description: 'Install casing, hardware, weatherstripping, final check' },
  ]);

  const hiddenDamage = assessHiddenDamageProbability(undefined, false, false, false, true, false);

  const scheduleRisk = assessScheduleRisk({
    dependsOnOtherTrades: false,
    clientMustDecide: !input.windowCostEach || !input.doorCostEach,
    materialsOnSite: false,
    weatherDependent: true,
    scopeIsLarge: input.windows + input.doors > 8,
    hasComplexDetails: ['sliding-door','patio-door','new-construction'].includes(input.installType),
  });

  const upsells = [
      { service: 'Interior window sills and extensions', reason: 'Pre-built extensions save client time and look finished.' },
      { service: 'Privacy or solar window film', reason: 'Easy add-on while crews have access — energy and UV protection.' },
      { service: 'Smart lock upgrade (exterior doors)', reason: 'Same labor window to upgrade to keypad/smart deadbolt.' }
  ];

  const roi = {
    investmentAmount:    costs.total,
    estimatedValueAdded: Math.round(costs.total * 0.75),
    roiPercent:          -25,
    notes:               'Window and door replacement returns 70-80% in home value and reduces energy costs 10-15%.',
  };
  return {
    toolId: `windows-doors-${Date.now()}`, trade: "windows-doors", projectType: input.installType,
    mode: input.mode, inputs: { ...input }, validationIssues: issues, isValid: isValid(issues),
    materials: mats, labor, costs, risk, milestones, evidenceRequired: evidence.items,
    warnings: [
      ...(input.exteriorWork && !input.flashingRequired ? ["⚠ Exterior work without flashing: high leak risk."] : []),
      ...(input.installType === "sliding-door" || input.installType === "patio-door" ? ["Sliding/patio door: verify track, level, and drainage."] : []),
      ...(!input.trimIncluded ? ["Trim omitted: closeout may need additional finish work."] : []),
    ],
    recommendations: [
      "Verify rough openings before ordering units.",
      "Document flashing, sealant, and final alignment with photos.",
      "Hold escrow until fit, seal, and finish are approved.",
    ],
    assumptions: ["Rough openings correctly sized — no structural repair needed.", "US market pricing."],
    productionSchedule,
    hiddenDamageAssessment: hiddenDamage,
    scheduleRisk,
    upsells,
    roi,
    createdAt: new Date().toISOString(),
    confidenceScore: confidence, readinessScore: readiness, disputeRisk, priceBands,
    safeToProceed, scope, explained, warranty, inspectionGate, algorithmTrace,
  } as SemseToolResult;
}

export const runWindowsDoorsEngine = calculateWindowsDoors;
