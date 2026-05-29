import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { applyLocation, buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";
import {
  computeConfidenceScore, computeDisputeRisk, computeReadinessScore,
  computePriceBands, buildScope, buildExplainedOutput, buildWarranty,
  buildInspectionGate, buildAlgorithmTrace, computeSafeToProceed, ALGORITHM_VERSIONS,
} from "../core/extended-metrics.js";

export type SolarRoofType  = "shingle" | "tile" | "metal" | "flat";
export type SolarInverter  = "string" | "micro" | "power-optimizer";

export type SolarInput = {
  roofAreaSqft: number;
  systemKw: number;
  panelCount: number;
  roofType: SolarRoofType;
  roofCondition: "good" | "fair" | "poor";
  sunExposure: "low" | "medium" | "high";
  batteryIncluded: boolean;
  batteryKwh: number;
  inverterType: SolarInverter;
  electricalUpgradeNeeded: boolean;
  permitRequired: boolean;
  utilityInterconnect: boolean;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const ROOF_FACTOR: Record<SolarRoofType, number> = { shingle: 1.00, tile: 1.08, metal: 0.96, flat: 1.12 };
const INVERTER_COST: Record<SolarInverter, number> = { string: 1250, micro: 220, "power-optimizer": 380 };

export function calculateSolar(input: SolarInput): SemseToolResult {
  const issues = collect(
    positive("roofAreaSqft", input.roofAreaSqft, "Roof area"),
    positive("systemKw", input.systemKw, "System size"),
    range("panelCount", input.panelCount, 1, 200, "Panel count"),
    input.roofCondition === "poor" ? warn("roofCondition", "Poor roof: repair before solar install.") : null,
    input.sunExposure === "low" ? warn("sunExposure", "Low sun exposure: reduced output — adjust system size.") : null,
    input.electricalUpgradeNeeded ? warn("electricalUpgradeNeeded", "Electrical panel upgrade needed: coordinate before interconnect.") : null,
  );

  const effectiveRoofArea = input.roofAreaSqft * ROOF_FACTOR[input.roofType];
  const maxPanels     = Math.floor(effectiveRoofArea / 20);
  const panelsToUse   = Math.min(input.panelCount, maxPanels);
  const inverterUnits = input.inverterType === "micro" ? panelsToUse : Math.max(1, Math.ceil(input.systemKw / 7.5));
  const inverterCost  = input.inverterType === "micro" ? INVERTER_COST.micro : input.inverterType === "power-optimizer" ? INVERTER_COST["power-optimizer"] * panelsToUse + 1000 : INVERTER_COST.string;

  const mats = [
    material("Solar panels", panelsToUse, "ea", 285, "Generation"),
    material("Racking / mounts", Math.max(1, Math.ceil(panelsToUse / 4)), "kit", 175, "Mounting"),
    material(input.inverterType === "micro" ? "Microinverters" : "String inverter", input.inverterType === "micro" ? panelsToUse : inverterUnits, "unit", input.inverterType === "micro" ? INVERTER_COST.micro : inverterCost, "Electrical"),
    ...(input.batteryIncluded ? [material(`Battery storage (${input.batteryKwh} kWh)`, 1, "system", 1100 * input.batteryKwh, "Storage")] : []),
    material("Electrical BOS (wiring, conduit, breakers)", Math.max(1, Math.ceil(input.systemKw / 3)), "kit", 145, "Electrical"),
    material("Monitoring system", 1, "unit", 250, "Monitoring"),
    ...(input.permitRequired ? [material("Permit / inspection pack", 1, "set", 185, "Admin")] : []),
    ...(input.roofCondition !== "good" ? [material("Roof repair / flashing prep", Math.max(1, Math.ceil(input.roofAreaSqft / 300)), "job", 260, "Roof prep")] : []),
    ...(input.electricalUpgradeNeeded ? [material("Panel upgrade materials", 1, "job", 850, "Electrical")] : []),
  ];

  const labor = estimateLabor({
    baseHours: 6 + input.systemKw * 2.25 + panelsToUse * 0.3 + input.roofAreaSqft / 320
      + (input.batteryIncluded ? 6 : 0) + (input.electricalUpgradeNeeded ? 5 : 0)
      + (input.roofCondition !== "good" ? 4 : 0) + (input.roofType === "tile" ? 3 : 0)
      + (input.utilityInterconnect ? 2 : 0),
    crewSize: input.batteryIncluded || input.electricalUpgradeNeeded ? 4 : 3,
    ratePerHour: 84 + (input.batteryIncluded ? 10 : 0) + (input.roofType === "tile" ? 8 : 0),
    difficulty: input.batteryIncluded || input.electricalUpgradeNeeded || input.roofCondition === "poor" || input.systemKw > 12 ? "specialist" : "complex",
    notes: [`${input.systemKw}kW — ${panelsToUse} panels — ${input.roofType} roof`, input.batteryIncluded ? `Battery: ${input.batteryKwh} kWh` : "No battery", `Sun exposure: ${input.sunExposure}`],
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost, input.location, "labor"),
    { overhead: input.batteryIncluded || input.electricalUpgradeNeeded ? 0.20 : 0.17, profit: 0.18, taxRate: 0.07, semseFeeRate: 0.05, perUnitDivisor: input.systemKw || 1 },
  );

  const risk = computeRisk([
    factor("roof_poor",    "Poor roof condition",    0.16, input.roofCondition === "poor"),
    factor("tile_roof",    "Tile roof",              0.10, input.roofType === "tile"),
    factor("low_sun",      "Low sun exposure",       0.12, input.sunExposure === "low"),
    factor("battery",      "Battery storage",        0.14, input.batteryIncluded),
    factor("elec_upgrade", "Electrical upgrade",     0.14, input.electricalUpgradeNeeded),
    factor("panel_short",  "Roof area shortfall",    0.10, panelsToUse < input.panelCount),
  ], { requiresPermit: input.permitRequired, requiresLicense: true, requiresInspection: true, requiresEngineering: input.systemKw > 15 || input.roofCondition === "poor" || input.batteryIncluded });

  const milestones = buildMilestones(costs.total, risk.level,
    ["Roof assessment and layout", "Mounting and electrical prep", "Panel install and commissioning", "Inspection and PTO"],
    [
      ["Roof condition photos", "Layout confirmation"],
      ["Mount / flashing photos", "Electrical prep"],
      ["Panel / inverter photos", "Commissioning checklist"],
      ["Inspection sign-off", "PTO documentation"],
    ]
  );
  const evidence = buildEvidenceChecklist("solar", risk, milestones, [
    { type: "photo",       description: "Roof condition before install",      required: true, milestone: 1 },
    { type: "document",    description: "Permit / utility paperwork",         required: input.permitRequired, milestone: 1 },
    { type: "photo",       description: "Mounting / flashing / wiring",       required: true, milestone: 2 },
    { type: "document",    description: "Commissioning checklist",            required: true, milestone: 3 },
    { type: "inspection",  description: "Inspection / PTO documentation",     required: true, milestone: 4 },
  ]);

  const annualKwh = input.systemKw * (input.sunExposure === "high" ? 1500 : input.sunExposure === "medium" ? 1200 : 900);
  const paybackYrs = costs.total > 0 ? (costs.total / (annualKwh * 0.15)).toFixed(1) : "N/A";

  const confidence = computeConfidenceScore({
    hasMeasurements: true, hasPhotos: false, hasConditionData: input.roofCondition !== "poor",
    hasMaterialSelection: true, hasScopeConfirmed: input.roofCondition !== "poor",
    hasUnknownConditions: input.roofCondition === "poor", extraConfirmedFields: (input.batteryIncluded ? 1 : 0) + (input.inverterType !== "string" ? 1 : 0),
  });
  const readiness = computeReadinessScore({
    measurementsConfirmed: true, materialsAvailable: false, siteAccessConfirmed: true,
    permitsAddressed: false, scopeApproved: input.roofCondition !== "poor",
    depositPaid: false, clientApproval: false,
  });
  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous: input.roofCondition === "poor", clientProvidesMaterials: false,
    noPhotosRequired: false, hasChangeOrderPolicy: true, hasEvidenceRequired: true,
    hasMilestones: true, hasHighRiskConditions: input.roofCondition !== "good" || input.electricalUpgradeNeeded,
    priceIsFixed: true, clientExpectationMismatch: input.sunExposure === "low",
  });
  const priceBands = computePriceBands(costs.total, 0.82, input.batteryIncluded || input.electricalUpgradeNeeded ? 1.45 : 1.25, {
    low:  "Simple roof, good condition, string inverter, no battery",
    mid:  "Standard system, good roof, micro-inverters",
    high: input.batteryIncluded ? "Battery + electrical upgrade + tile roof + poor condition" : "Electrical upgrade + tile roof + micro-inverters",
  });
  const scope = buildScope(
    [
      `${input.systemKw}kW solar installation (${panelsToUse} panels)`,
      `${input.inverterType} inverter system`, input.batteryIncluded ? `Battery storage: ${input.batteryKwh} kWh` : "",
      input.electricalUpgradeNeeded ? "Electrical panel upgrade" : "",
      "Racking and mounting", "Monitoring system", input.utilityInterconnect ? "Utility interconnect coordination" : "",
      input.permitRequired ? "Permit and inspection" : "",
    ].filter(Boolean),
    [!input.electricalUpgradeNeeded ? "Electrical panel upgrade (if needed)" : "", "Roof repair or replacement", "Tree trimming for shade reduction"].filter(Boolean),
    ["Roof structurally sound for racking loads", "Net metering available from utility"],
    ["Roof repair required before mount", "Electrical panel capacity insufficient", "Utility interconnect delayed"],
  );
  const warranty = buildWarranty(1825, "5-year labor warranty on installation. Panels: 25-year performance. Inverters: 10-12 years. Battery: 10 years.", ["Lightning or surge damage", "Physical damage", "Shading changes after install"]);
  const inspectionGate = buildInspectionGate(
    "After wiring and before energizing system",
    ["Electrical inspection sign-off", "Commissioning checklist", "Inverter startup report"],
    "Electrical or structural issue preventing energization",
    "All wiring, grounding, and inverter connections must pass inspection before PTO.",
  );
  const safeToProceed = computeSafeToProceed({
    hasMinimalData: isValid(issues), readinessScore: readiness.score,
    hasCriticalBlockers: input.roofCondition === "poor",
    hasMilestones: true, hasEvidencePlan: true, confidenceScore: confidence.score,
    noCriticalBlockers: input.roofCondition !== "poor", scopeIsComplete: input.roofCondition !== "poor",
  });
  const explained = buildExplainedOutput(
    `Your ${input.systemKw}kW solar system with ${panelsToUse} panels${input.batteryIncluded ? ` and ${input.batteryKwh}kWh battery` : ""} is estimated to generate ~${annualKwh.toLocaleString()} kWh/yr. Estimated payback at $0.15/kWh: ~${paybackYrs} years. Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
    [
      `Effective roof area: ${effectiveRoofArea.toFixed(0)} sqft (${ROOF_FACTOR[input.roofType]}× factor)`,
      panelsToUse < input.panelCount ? `⚠ Roof fits ${panelsToUse} panels, not ${input.panelCount} requested` : "Roof area sufficient",
      `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`,
    ],
  );
  const algorithmTrace = buildAlgorithmTrace(ALGORITHM_VERSIONS.solar, "solar",
    ["systemKw", "panelCount", "roofType", "roofCondition", "batteryIncluded", "inverterType"],
    [], ["Roof structurally sound", "Net metering available", "US market pricing"],
    [
      { ruleId: "BATTERY_PREMIUM",  label: "Battery storage",        triggered: input.batteryIncluded,             reason: `${input.batteryKwh}kWh @ $1,100/kWh adds significant cost`, points: 14 },
      { ruleId: "ELEC_UPGRADE",     label: "Electrical upgrade",     triggered: input.electricalUpgradeNeeded,     reason: "Panel upgrade required before interconnect", points: 14 },
      { ruleId: "TILE_ROOF",        label: "Tile roof premium",      triggered: input.roofType === "tile",         reason: "1.08× material + extra tile labor", points: 10 },
      { ruleId: "POOR_ROOF",        label: "Roof repair needed",     triggered: input.roofCondition === "poor",    reason: "Roof must be repaired before solar mount", points: 16 },
    ],
  );

  return {
    toolId: `solar-${Date.now()}`, trade: "solar", projectType: "solar-install",
    mode: input.mode, inputs: { ...input }, validationIssues: issues, isValid: isValid(issues),
    materials: mats, labor, costs, risk, milestones, evidenceRequired: evidence.items,
    warnings: [
      ...(input.roofCondition === "poor" ? ["⚠ Repair roof before solar install — mount warranty void on damaged roof."] : []),
      ...(input.sunExposure === "low" ? ["Low sun exposure: generation may be 30-40% below high-sun estimates."] : []),
      ...(panelsToUse < input.panelCount ? [`Roof fits ${panelsToUse} panels max — ${input.panelCount} requested. Adjust system size.`] : []),
      ...(input.electricalUpgradeNeeded ? ["Electrical upgrade: coordinate with utility before energizing."] : []),
    ],
    recommendations: [
      "Confirm roof suitability and age before ordering equipment.",
      "Capture roof, wiring, and final install photos.",
      "Hold closeout until inspection and PTO are documented.",
      ...(input.batteryIncluded ? ["Commission battery with grid utility agreement in place."] : []),
    ],
    assumptions: ["Roof structurally adequate for racking loads.", "Net metering available.", "US market pricing."],
    createdAt: new Date().toISOString(),
    confidenceScore: confidence, readinessScore: readiness, disputeRisk, priceBands,
    safeToProceed, scope, explained, warranty, inspectionGate, algorithmTrace,
  } as SemseToolResult;
}

export const runSolarEngine = calculateSolar;
