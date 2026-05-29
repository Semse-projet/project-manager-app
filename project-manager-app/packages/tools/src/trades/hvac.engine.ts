import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { applyLocation, buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";
import {
  computeConfidenceScore,
  computeDisputeRisk,
  computeReadinessScore,
  computePriceBands,
  buildScope,
  buildExplainedOutput,
  buildWarranty,
  buildInspectionGate,
  buildAlgorithmTrace,
  computeSafeToProceed,
  ALGORITHM_VERSIONS,
} from "../core/extended-metrics.js";

export type HvacSystemType = "central-ac" | "heat-pump" | "mini-split" | "furnace-only" | "package-unit";
export type DuctworkScope  = "none" | "partial" | "full-replace" | "new-install";

export type HvacInput = {
  tonnage: number;
  systemType: HvacSystemType;
  seerRating: number;
  ductworkScope: DuctworkScope;
  ductRunFeet: number;
  zoneCount: number;
  atticInstall: boolean;
  crawlspaceInstall: boolean;
  existingEquipmentAge: number;
  refrigerantType: "R-410A" | "R-32" | "R-22" | "R-454B";
  thermostatUpgrade: boolean;
  airQualityUpgrade: boolean;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const EQUIPMENT_BASE: Record<HvacSystemType, { indoor: number; outdoor: number }> = {
  "central-ac":   { indoor: 1800,  outdoor: 2800 },
  "heat-pump":    { indoor: 2400,  outdoor: 3800 },
  "mini-split":   { indoor: 1200,  outdoor: 2200 },
  "furnace-only": { indoor: 1600,  outdoor: 0    },
  "package-unit": { indoor: 0,     outdoor: 4200 },
};

function seerPremium(seer: number): number {
  if (seer >= 22) return 0.45;
  if (seer >= 20) return 0.30;
  if (seer >= 18) return 0.18;
  if (seer >= 16) return 0.08;
  return 0;
}

export function calculateHvac(input: HvacInput): SemseToolResult {
  const issues = collect(
    positive("tonnage", input.tonnage, "System tonnage"),
    range("tonnage", input.tonnage, 0.5, 20, "Tonnage"),
    range("seerRating", input.seerRating, 13, 26, "SEER rating"),
    range("ductRunFeet", input.ductRunFeet, 0, 1200, "Duct run"),
    positive("zoneCount", input.zoneCount, "Zone count"),
    input.tonnage >= 10 ? warn("tonnage", "Large commercial system: engineering load calculation required.") : null,
    input.refrigerantType === "R-22" ? warn("refrigerantType", "R-22 is phased out — extremely expensive. Verify availability.") : null,
  );

  const equip    = EQUIPMENT_BASE[input.systemType];
  const premium  = seerPremium(input.seerRating);
  const tonScale = 0.8 + (input.tonnage / 5) * 0.6;
  const ductCostPerFt = input.ductworkScope === "full-replace" || input.ductworkScope === "new-install" ? 6.50 : 4.25;

  const mats = [
    ...(equip.indoor  > 0 ? [material(`${input.systemType} indoor unit`,    1, "unit", equip.indoor  * tonScale * (1 + premium), "Equipment")] : []),
    ...(equip.outdoor > 0 ? [material(`${input.systemType} outdoor unit (${input.seerRating} SEER)`, 1, "unit", equip.outdoor * tonScale * (1 + premium), "Equipment")] : []),
    ...(input.ductworkScope !== "none" ? [
      material("Flex duct / sheet metal", Math.ceil(input.ductRunFeet), "ft", ductCostPerFt, "Ductwork"),
      material("Duct fittings & hangers", Math.ceil(input.ductRunFeet / 10), "set", 18, "Ductwork"),
    ] : []),
    material(`Refrigerant ${input.refrigerantType}`, Math.ceil(input.tonnage * 2.5), "lb", input.refrigerantType === "R-22" ? 85 : 28, "Refrigerant"),
    material("Thermostat", input.zoneCount, "un", input.thermostatUpgrade ? 285 : 145, "Controls"),
    ...(input.zoneCount > 1 ? [material("Zone dampers & controllers", input.zoneCount - 1, "set", 380, "Controls")] : []),
    ...(input.airQualityUpgrade ? [material("Air purifier / UV system", 1, "unit", 650, "Air Quality")] : []),
    ...(input.atticInstall ? [material("Attic platform & safety", 1, "job", 320, "Access")] : []),
    material("Electrical disconnect & wiring", 1, "job", 280, "Electrical"),
    material("Condensate drain & protection", 1, "job", 95, "Plumbing"),
    material("Permits & inspection", 1, "job", 185, "Permits"),
  ];

  const baseHours =
    4 + input.tonnage * 2.2 + input.zoneCount * 2.5
    + (input.ductworkScope === "full-replace" || input.ductworkScope === "new-install" ? input.ductRunFeet / 28 : input.ductRunFeet / 55)
    + (input.atticInstall ? 3.5 : 0)
    + (input.crawlspaceInstall ? 2.5 : 0)
    + (input.airQualityUpgrade ? 1.5 : 0);

  const labor = estimateLabor({
    baseHours,
    crewSize: input.tonnage >= 5 || input.zoneCount > 2 ? 3 : 2,
    ratePerHour: 82,
    difficulty: input.atticInstall || input.crawlspaceInstall || input.tonnage >= 5 ? "complex" : "moderate",
    notes: [
      `${input.tonnage}T ${input.systemType} @ ${input.seerRating} SEER`,
      `Ductwork: ${input.ductworkScope} (${input.ductRunFeet} ft)`,
      `${input.zoneCount} zone(s) — ${input.refrigerantType}`,
      input.atticInstall ? "Attic: staging required" : "",
    ].filter(Boolean),
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost,     input.location, "labor"),
    { overhead: 0.17, profit: 0.22, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: input.tonnage },
  );

  const risk = computeRisk([
    factor("large_system",    "Large system (5+ ton)",   0.18, input.tonnage >= 5),
    factor("r22",             "R-22 refrigerant",        0.22, input.refrigerantType === "R-22"),
    factor("attic",           "Attic installation",      0.16, input.atticInstall),
    factor("crawlspace",      "Crawlspace install",      0.14, input.crawlspaceInstall),
    factor("full_duct",       "Full duct replacement",   0.12, input.ductworkScope === "full-replace" || input.ductworkScope === "new-install"),
    factor("multi_zone",      "Multi-zone (3+)",         0.10, input.zoneCount > 2),
    factor("old_equip",       "Old equipment (15+ yrs)", 0.08, input.existingEquipmentAge >= 15),
  ], {
    requiresPermit: true,
    requiresLicense: true,
    requiresInspection: true,
    requiresEngineering: input.tonnage >= 10 || input.zoneCount > 4,
  });

  const confidence = computeConfidenceScore({
    hasMeasurements:      true,
    hasPhotos:            false,
    hasConditionData:     input.existingEquipmentAge > 0,
    hasMaterialSelection: true,
    hasScopeConfirmed:    input.ductworkScope !== "none",
    hasUnknownConditions: input.refrigerantType === "R-22",
    extraConfirmedFields: (input.thermostatUpgrade ? 1 : 0) + (input.airQualityUpgrade ? 1 : 0),
  });

  const readiness = computeReadinessScore({
    measurementsConfirmed:  true,
    materialsAvailable:     false,
    siteAccessConfirmed:    true,
    permitsAddressed:       false,
    scopeApproved:          false,
    depositPaid:            false,
    clientApproval:         false,
    otherTradesCoordinated: false,
  });

  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous:           input.ductworkScope === "none" && input.systemType === "central-ac",
    clientProvidesMaterials:  false,
    noPhotosRequired:         false,
    hasChangeOrderPolicy:     true,
    hasEvidenceRequired:      true,
    hasMilestones:            true,
    hasHighRiskConditions:    input.refrigerantType === "R-22" || input.atticInstall || input.zoneCount > 2,
    priceIsFixed:             true,
    clientExpectationMismatch: input.zoneCount > 2,
  });

  const priceBands = computePriceBands(
    costs.total,
    0.78,
    input.ductworkScope === "full-replace" || input.tonnage >= 5 ? 1.42 : 1.28,
    {
      low:  "Basic swap, existing ducts, 14 SEER, no zones",
      mid:  "Mid-efficiency, partial duct, single zone",
      high: input.ductworkScope === "full-replace" ? "Full duct + multi-zone + high SEER" : "High SEER + multi-zone + air quality + attic",
    },
  );

  const scope = buildScope(
    [
      `${input.systemType} installation — ${input.tonnage}T ${input.seerRating} SEER`,
      input.ductworkScope !== "none" ? `Ductwork: ${input.ductworkScope} (${input.ductRunFeet} ft)` : "Connection to existing ductwork",
      `${input.zoneCount} zone thermostat(s) — ${input.thermostatUpgrade ? "smart thermostat" : "standard"}`,
      input.airQualityUpgrade ? "Air quality upgrade (UV/purifier)" : "",
      `${input.refrigerantType} refrigerant charge`,
      "Electrical disconnect and wiring",
      "Condensate drain and overflow protection",
      "Commissioning, test & balance",
      "Permit and inspection",
    ].filter(Boolean),
    [
      "Electrical panel upgrade or new circuit",
      "Structural modifications for clearance",
      input.ductworkScope === "none" ? "Duct inspection, cleaning, or sealing" : "",
      "Gas line work (if applicable)",
      "Asbestos abatement on old duct wrap",
    ].filter(Boolean),
    [
      "Existing electrical service adequate for new equipment",
      "Equipment access path clear without major demolition",
      input.ductworkScope !== "full-replace" ? "Existing ductwork structurally sound" : "",
    ].filter(Boolean),
    [
      "Electrical panel requires upgrade",
      "Hidden duct damage found during replacement",
      "Refrigerant leak in existing system requiring repair",
      "Structural clearance modifications required",
    ],
  );

  const milestones = buildMilestones(costs.total, risk.level,
    ["Equipment delivery & prep", "Equipment installation", "Ductwork & controls", "Commissioning & balancing"],
    [
      ["Existing system photos", "Equipment delivery confirmation"],
      ["Equipment installation photos", "Electrical connection"],
      ["Ductwork photos", "Thermostat wiring"],
      ["Refrigerant charge log", "Airflow readings per zone", "Client walkthrough"],
    ]
  );

  const evidence = buildEvidenceChecklist("hvac", risk, milestones, [
    { type: "photo",       description: "Existing system condition",          required: true,  milestone: 1 },
    { type: "photo",       description: "New equipment installed",            required: true,  milestone: 2 },
    { type: "measurement", description: "Refrigerant charge weight (lbs)",   required: true,  milestone: 4 },
    { type: "measurement", description: "Airflow per zone (CFM)",            required: true,  milestone: 4 },
    { type: "document",    description: "Commissioning / startup report",    required: true,  milestone: 4 },
    { type: "inspection",  description: "Municipal inspection sign-off",     required: true,  milestone: 4 },
  ]);

  const warranty = buildWarranty(365,
    `Labor: 1 year. Equipment: ${input.systemType === "heat-pump" ? "10 yr compressor / 5 yr parts" : "5-10 yr depending on brand and registration"}.`,
    ["Refrigerant loss from client-caused damage", "Filter neglect", "Power surge damage"],
  );

  const inspectionGate = buildInspectionGate(
    "After refrigerant charge and before final payment",
    ["Refrigerant charge log", "Airflow measurements", "Temperature differential readings"],
    "Refrigerant leak or duct damage requiring repair before commissioning",
    "Verify airflow, refrigerant pressures, and thermostat operation across all zones.",
  );

  const safeToProceed = computeSafeToProceed({
    hasMinimalData:      isValid(issues),
    readinessScore:      readiness.score,
    hasCriticalBlockers: input.refrigerantType === "R-22",
    hasMilestones:       true,
    hasEvidencePlan:     true,
    confidenceScore:     confidence.score,
    noCriticalBlockers:  input.refrigerantType !== "R-22",
    scopeIsComplete:     true,
  });

  const explained = buildExplainedOutput(
    `Your ${input.tonnage}-ton ${input.systemType} at ${input.seerRating} SEER includes equipment, ${input.ductworkScope !== "none" ? `${input.ductworkScope} ductwork, ` : ""}${input.zoneCount} zone(s), and full commissioning. Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}. Est. cooling cost savings vs. 14-SEER: ~${Math.round((input.seerRating / 14 - 1) * 30)}%.`,
    [
      `Equipment: ${input.systemType} ${input.tonnage}T @ ${input.seerRating} SEER — premium: ${(seerPremium(input.seerRating) * 100).toFixed(0)}%`,
      `Ductwork: ${input.ductworkScope} — ${input.ductRunFeet} ft @ $${ductCostPerFt}/ft`,
      `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`,
      input.refrigerantType === "R-22" ? "⚠ R-22 PHASEOUT: confirm availability and lock price before contract" : `Refrigerant: ${input.refrigerantType}`,
    ],
  );

  const algorithmTrace = buildAlgorithmTrace(
    ALGORITHM_VERSIONS.hvac ?? "hvac-v2.0",
    "hvac",
    ["tonnage", "systemType", "seerRating", "ductworkScope", "ductRunFeet", "zoneCount", "refrigerantType"],
    [],
    ["Existing electrical service adequate", "US market pricing"],
    [
      { ruleId: "SEER_PREMIUM",  label: "SEER efficiency premium",    triggered: seerPremium(input.seerRating) > 0, reason: `SEER ${input.seerRating} adds ${(seerPremium(input.seerRating) * 100).toFixed(0)}% to equipment`, points: 0 },
      { ruleId: "ATTIC_COMPLEX", label: "Attic install complexity",   triggered: input.atticInstall,               reason: "Safety staging, platform, extra labor hours", points: 16 },
      { ruleId: "R22_COST",      label: "R-22 refrigerant surcharge", triggered: input.refrigerantType === "R-22", reason: "Phased-out: 3× material cost vs current refrigerants", points: 22 },
      { ruleId: "MULTI_ZONE",    label: "Multi-zone controls",        triggered: input.zoneCount > 1,              reason: `${input.zoneCount} zones: zone dampers and controllers added`, points: 10 },
    ],
  );

  return {
    toolId: `hvac-${Date.now()}`,
    trade: "hvac",
    projectType: input.systemType,
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
      ...(input.refrigerantType === "R-22" ? ["⚠ R-22 phased out — verify availability and cost before pricing."] : []),
      ...(input.tonnage >= 10 ? ["Commercial system: engineering load calculation required."] : []),
      ...(input.atticInstall  ? ["Attic install: OSHA fall protection and platform required."] : []),
      ...(input.zoneCount > 3 ? ["Complex zoning: commission each zone before client walkthrough."] : []),
    ],
    recommendations: [
      "Perform Manual J load calculation before final equipment selection.",
      "Test and balance all zones — document CFM readings.",
      "Register equipment warranty immediately after startup.",
      "Provide client with filter maintenance schedule.",
    ],
    assumptions: [
      "Existing electrical service supports new equipment.",
      "Equipment access path does not require structural modification.",
      "US market pricing — use location multiplier.",
    ],
    createdAt: new Date().toISOString(),
    confidenceScore: confidence,
    readinessScore:  readiness,
    disputeRisk,
    priceBands,
    safeToProceed,
    scope,
    explained,
    warranty,
    inspectionGate,
    algorithmTrace,
  } as SemseToolResult;
}

export const runHvacEngine = calculateHvac;
