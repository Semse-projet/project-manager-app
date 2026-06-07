import { collect, isValid, oneOf, positive, range, warn } from "../core/validation-engine.js";
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

const HVAC_SYSTEM_TYPES = ["central-ac", "heat-pump", "mini-split", "furnace-only", "package-unit"] as const;
const DUCTWORK_SCOPES = ["none", "partial", "full-replace", "new-install"] as const;
const REFRIGERANT_TYPES = ["R-410A", "R-32", "R-22", "R-454B"] as const;
const TOOL_MODES = ["client", "professional", "admin"] as const;

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

function normalizePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeRange(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function normalizeOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

export function calculateHvac(input: HvacInput): SemseToolResult {
  const issues = collect(
    oneOf("systemType", input.systemType, HVAC_SYSTEM_TYPES, "System type"),
    oneOf("ductworkScope", input.ductworkScope, DUCTWORK_SCOPES, "Ductwork scope"),
    oneOf("refrigerantType", input.refrigerantType, REFRIGERANT_TYPES, "Refrigerant type"),
    oneOf("mode", input.mode, TOOL_MODES, "Mode"),
    positive("tonnage", input.tonnage, "System tonnage"),
    range("tonnage", input.tonnage, 0.5, 20, "Tonnage"),
    range("seerRating", input.seerRating, 13, 26, "SEER rating"),
    range("ductRunFeet", input.ductRunFeet, 0, 1200, "Duct run"),
    positive("zoneCount", input.zoneCount, "Zone count"),
    range("existingEquipmentAge", input.existingEquipmentAge, 0, 60, "Existing equipment age"),
    Number.isFinite(input.tonnage) && input.tonnage >= 10 ? warn("tonnage", "Large commercial system: engineering load calculation required.") : null,
    input.refrigerantType === "R-22" ? warn("refrigerantType", "R-22 is phased out — extremely expensive. Verify availability.") : null,
  );

  const systemType = normalizeOneOf(input.systemType, HVAC_SYSTEM_TYPES, "central-ac");
  const ductworkScope = normalizeOneOf(input.ductworkScope, DUCTWORK_SCOPES, "none");
  const refrigerantType = normalizeOneOf(input.refrigerantType, REFRIGERANT_TYPES, "R-410A");
  const mode = normalizeOneOf(input.mode, TOOL_MODES, "professional");
  const tonnage = normalizeRange(input.tonnage, 0.5, 20, 2.5);
  const seerRating = normalizeRange(input.seerRating, 13, 26, 14);
  const ductRunFeet = normalizeRange(input.ductRunFeet, 0, 1200, 0);
  const zoneCount = Math.max(1, Math.round(normalizePositive(input.zoneCount, 1)));
  const existingEquipmentAge = Math.round(normalizeRange(input.existingEquipmentAge, 0, 60, 0));

  const equip    = EQUIPMENT_BASE[systemType];
  const premium  = seerPremium(seerRating);
  const tonScale = 0.8 + (tonnage / 5) * 0.6;
  const ductCostPerFt = ductworkScope === "full-replace" || ductworkScope === "new-install" ? 6.50 : 4.25;

  const mats = [
    ...(equip.indoor  > 0 ? [material(`${systemType} indoor unit`,    1, "unit", equip.indoor  * tonScale * (1 + premium), "Equipment")] : []),
    ...(equip.outdoor > 0 ? [material(`${systemType} outdoor unit (${seerRating} SEER)`, 1, "unit", equip.outdoor * tonScale * (1 + premium), "Equipment")] : []),
    ...(ductworkScope !== "none" ? [
      material("Flex duct / sheet metal", Math.ceil(ductRunFeet), "ft", ductCostPerFt, "Ductwork"),
      material("Duct fittings & hangers", Math.ceil(ductRunFeet / 10), "set", 18, "Ductwork"),
    ] : []),
    material(`Refrigerant ${refrigerantType}`, Math.ceil(tonnage * 2.5), "lb", refrigerantType === "R-22" ? 85 : 28, "Refrigerant"),
    material("Thermostat", zoneCount, "un", input.thermostatUpgrade ? 285 : 145, "Controls"),
    ...(zoneCount > 1 ? [material("Zone dampers & controllers", zoneCount - 1, "set", 380, "Controls")] : []),
    ...(input.airQualityUpgrade ? [material("Air purifier / UV system", 1, "unit", 650, "Air Quality")] : []),
    ...(input.atticInstall ? [material("Attic platform & safety", 1, "job", 320, "Access")] : []),
    material("Electrical disconnect & wiring", 1, "job", 280, "Electrical"),
    material("Condensate drain & protection", 1, "job", 95, "Plumbing"),
    material("Permits & inspection", 1, "job", 185, "Permits"),
  ];

  const baseHours =
    4 + tonnage * 2.2 + zoneCount * 2.5
    + (ductworkScope === "full-replace" || ductworkScope === "new-install" ? ductRunFeet / 28 : ductRunFeet / 55)
    + (input.atticInstall ? 3.5 : 0)
    + (input.crawlspaceInstall ? 2.5 : 0)
    + (input.airQualityUpgrade ? 1.5 : 0);

  const labor = estimateLabor({
    baseHours,
    crewSize: tonnage >= 5 || zoneCount > 2 ? 3 : 2,
    ratePerHour: 82,
    difficulty: input.atticInstall || input.crawlspaceInstall || tonnage >= 5 ? "complex" : "moderate",
    notes: [
      `${tonnage}T ${systemType} @ ${seerRating} SEER`,
      `Ductwork: ${ductworkScope} (${ductRunFeet} ft)`,
      `${zoneCount} zone(s) — ${refrigerantType}`,
      input.atticInstall ? "Attic: staging required" : "",
    ].filter(Boolean),
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost,     input.location, "labor"),
    { overhead: 0.17, profit: 0.22, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: tonnage },
  );

  const risk = computeRisk([
    factor("large_system",    "Large system (5+ ton)",   0.18, tonnage >= 5),
    factor("r22",             "R-22 refrigerant",        0.22, refrigerantType === "R-22"),
    factor("attic",           "Attic installation",      0.16, input.atticInstall),
    factor("crawlspace",      "Crawlspace install",      0.14, input.crawlspaceInstall),
    factor("full_duct",       "Full duct replacement",   0.12, ductworkScope === "full-replace" || ductworkScope === "new-install"),
    factor("multi_zone",      "Multi-zone (3+)",         0.10, zoneCount > 2),
    factor("old_equip",       "Old equipment (15+ yrs)", 0.08, existingEquipmentAge >= 15),
  ], {
    requiresPermit: true,
    requiresLicense: true,
    requiresInspection: true,
    requiresEngineering: tonnage >= 10 || zoneCount > 4,
  });

  const confidence = computeConfidenceScore({
    hasMeasurements:      true,
    hasPhotos:            false,
    hasConditionData:     existingEquipmentAge > 0,
    hasMaterialSelection: true,
    hasScopeConfirmed:    ductworkScope !== "none",
    hasUnknownConditions: refrigerantType === "R-22",
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
    scopeAmbiguous:           ductworkScope === "none" && systemType === "central-ac",
    clientProvidesMaterials:  false,
    noPhotosRequired:         false,
    hasChangeOrderPolicy:     true,
    hasEvidenceRequired:      true,
    hasMilestones:            true,
    hasHighRiskConditions:    refrigerantType === "R-22" || input.atticInstall || zoneCount > 2,
    priceIsFixed:             true,
    clientExpectationMismatch: zoneCount > 2,
  });

  const priceBands = computePriceBands(
    costs.total,
    0.78,
    ductworkScope === "full-replace" || tonnage >= 5 ? 1.42 : 1.28,
    {
      low:  "Basic swap, existing ducts, 14 SEER, no zones",
      mid:  "Mid-efficiency, partial duct, single zone",
      high: ductworkScope === "full-replace" ? "Full duct + multi-zone + high SEER" : "High SEER + multi-zone + air quality + attic",
    },
  );

  const scope = buildScope(
    [
      `${systemType} installation — ${tonnage}T ${seerRating} SEER`,
      ductworkScope !== "none" ? `Ductwork: ${ductworkScope} (${ductRunFeet} ft)` : "Connection to existing ductwork",
      `${zoneCount} zone thermostat(s) — ${input.thermostatUpgrade ? "smart thermostat" : "standard"}`,
      input.airQualityUpgrade ? "Air quality upgrade (UV/purifier)" : "",
      `${refrigerantType} refrigerant charge`,
      "Electrical disconnect and wiring",
      "Condensate drain and overflow protection",
      "Commissioning, test & balance",
      "Permit and inspection",
    ].filter(Boolean),
    [
      "Electrical panel upgrade or new circuit",
      "Structural modifications for clearance",
      ductworkScope === "none" ? "Duct inspection, cleaning, or sealing" : "",
      "Gas line work (if applicable)",
      "Asbestos abatement on old duct wrap",
    ].filter(Boolean),
    [
      "Existing electrical service adequate for new equipment",
      "Equipment access path clear without major demolition",
      ductworkScope !== "full-replace" ? "Existing ductwork structurally sound" : "",
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
    `Labor: 1 year. Equipment: ${systemType === "heat-pump" ? "10 yr compressor / 5 yr parts" : "5-10 yr depending on brand and registration"}.`,
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
    hasCriticalBlockers: refrigerantType === "R-22",
    hasMilestones:       true,
    hasEvidencePlan:     true,
    confidenceScore:     confidence.score,
    noCriticalBlockers:  refrigerantType !== "R-22",
    scopeIsComplete:     true,
  });

  const explained = buildExplainedOutput(
    `Your ${tonnage}-ton ${systemType} at ${seerRating} SEER includes equipment, ${ductworkScope !== "none" ? `${ductworkScope} ductwork, ` : ""}${zoneCount} zone(s), and full commissioning. Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}. Est. cooling cost savings vs. 14-SEER: ~${Math.round((seerRating / 14 - 1) * 30)}%.`,
    [
      `Equipment: ${systemType} ${tonnage}T @ ${seerRating} SEER — premium: ${(seerPremium(seerRating) * 100).toFixed(0)}%`,
      `Ductwork: ${ductworkScope} — ${ductRunFeet} ft @ $${ductCostPerFt}/ft`,
      `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`,
      refrigerantType === "R-22" ? "⚠ R-22 PHASEOUT: confirm availability and lock price before contract" : `Refrigerant: ${refrigerantType}`,
    ],
  );

  const algorithmTrace = buildAlgorithmTrace(
    ALGORITHM_VERSIONS.hvac ?? "hvac-v2.0",
    "hvac",
    ["tonnage", "systemType", "seerRating", "ductworkScope", "ductRunFeet", "zoneCount", "refrigerantType"],
    [],
    ["Existing electrical service adequate", "US market pricing"],
    [
      { ruleId: "SEER_PREMIUM",  label: "SEER efficiency premium",    triggered: seerPremium(seerRating) > 0, reason: `SEER ${seerRating} adds ${(seerPremium(seerRating) * 100).toFixed(0)}% to equipment`, points: 0 },
      { ruleId: "ATTIC_COMPLEX", label: "Attic install complexity",   triggered: input.atticInstall,               reason: "Safety staging, platform, extra labor hours", points: 16 },
      { ruleId: "R22_COST",      label: "R-22 refrigerant surcharge", triggered: refrigerantType === "R-22", reason: "Phased-out: 3× material cost vs current refrigerants", points: 22 },
      { ruleId: "MULTI_ZONE",    label: "Multi-zone controls",        triggered: zoneCount > 1,              reason: `${zoneCount} zones: zone dampers and controllers added`, points: 10 },
    ],
  );

  return {
    toolId: `hvac-${Date.now()}`,
    trade: "hvac",
    projectType: systemType,
    mode,
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
      ...(refrigerantType === "R-22" ? ["⚠ R-22 phased out — verify availability and cost before pricing."] : []),
      ...(tonnage >= 10 ? ["Commercial system: engineering load calculation required."] : []),
      ...(input.atticInstall  ? ["Attic install: OSHA fall protection and platform required."] : []),
      ...(zoneCount > 3 ? ["Complex zoning: commission each zone before client walkthrough."] : []),
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
