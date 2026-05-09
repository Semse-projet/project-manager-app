import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, SemseToolResult, ToolMode } from "../core/types.js";

export type SolarInput = {
  projectName: string;
  roofAreaSqft: number;
  systemKw: number;
  panelCount: number;
  roofType: "shingle" | "tile" | "metal" | "flat";
  roofCondition: "good" | "fair" | "poor";
  sunExposure: "low" | "medium" | "high";
  batteryIncluded: boolean;
  permitRequired: boolean;
  electricalUpgradeNeeded: boolean;
  mode: ToolMode;
};

const ROOF_FACTOR: Record<SolarInput["roofType"], number> = {
  shingle: 1,
  tile: 1.08,
  metal: 0.96,
  flat: 1.12,
};

export function calculateSolar(input: SolarInput): SemseToolResult {
  const issues = collect(
    positive("roofAreaSqft", input.roofAreaSqft, "Roof area"),
    positive("systemKw", input.systemKw, "System size"),
    range("panelCount", input.panelCount, 1, 200, "Panel count"),
    input.roofCondition === "poor"
      ? warn("roofCondition", "Poor roof condition: repair roof before solar install.")
      : null,
    input.sunExposure === "low"
      ? warn("sunExposure", "Low sun exposure: output may be reduced.")
      : null,
    input.electricalUpgradeNeeded
      ? warn("electricalUpgradeNeeded", "Electrical upgrade needed: coordinate panel and inspection.")
      : null,
    input.batteryIncluded
      ? warn("batteryIncluded", "Battery included: add commissioning and protection steps.")
      : null,
  );

  const effectiveRoof = input.roofAreaSqft * ROOF_FACTOR[input.roofType];
  const recommendedPanels = Math.max(1, Math.ceil(input.systemKw * 2.75));
  const roofShortfall = input.panelCount > 0 ? Math.max(0, input.panelCount - Math.floor(effectiveRoof / 20)) : 0;

  const mats = [
    material("Solar panels", input.panelCount, "ea", 285, "Generation"),
    material("Racking / mounts", Math.max(1, Math.ceil(input.panelCount / 4)), "kit", 175, "Mounting"),
    material("Inverter", Math.max(1, Math.ceil(input.systemKw / 7.5)), "unit", 1250, "Electrical"),
    ...(input.batteryIncluded ? [material("Battery storage", 1, "system", 6500, "Storage")] : []),
    material("Electrical BOS", Math.max(1, Math.ceil(input.systemKw / 3)), "kit", 145, "Electrical"),
    ...(input.permitRequired ? [material("Permit / inspection pack", 1, "set", 185, "Admin")] : []),
    ...(input.roofCondition !== "good" ? [material("Roof repair / flashing", Math.max(1, Math.ceil(input.roofAreaSqft / 300)), "job", 260, "Roof prep")] : []),
  ];

  const labor = estimateLabor({
    baseHours:
      6 +
      input.systemKw * 2.25 +
      input.panelCount * 0.3 +
      input.roofAreaSqft / 320 +
      (input.batteryIncluded ? 6 : 0) +
      (input.electricalUpgradeNeeded ? 5 : 0) +
      (input.roofCondition === "poor" ? 4 : 0),
    crewSize: input.batteryIncluded || input.electricalUpgradeNeeded ? 4 : 3,
    ratePerHour:
      84 +
      (input.batteryIncluded ? 10 : 0) +
      (input.roofType === "tile" ? 8 : 0) +
      (input.roofCondition === "poor" ? 6 : 0),
    difficulty:
      input.batteryIncluded ||
      input.electricalUpgradeNeeded ||
      input.roofCondition === "poor" ||
      input.systemKw > 12
        ? "specialist"
        : "complex",
    notes: [
      `Project: ${input.projectName}`,
      `Recommended panels: ${recommendedPanels}`,
      `Roof factor adjusted area: ${effectiveRoof.toFixed(1)} sqft`,
      input.batteryIncluded ? "Battery included." : "No battery in scope.",
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: input.batteryIncluded || input.electricalUpgradeNeeded ? 0.2 : 0.17,
    profit: 0.18,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: input.systemKw || 1,
  });

  const risk = computeRisk(
    [
      factor("roof", "Roof condition poor", 0.16, input.roofCondition === "poor"),
      factor("roof_type", "Complex roof type", 0.10, input.roofType === "tile" || input.roofType === "flat"),
      factor("sun", "Low sun exposure", 0.12, input.sunExposure === "low"),
      factor("battery", "Battery included", 0.14, input.batteryIncluded),
      factor("permit", "Permit required", 0.12, input.permitRequired),
      factor("electrical", "Electrical upgrade needed", 0.14, input.electricalUpgradeNeeded),
      factor("shortfall", "Roof area shortfall", 0.10, roofShortfall > 0),
    ],
    {
      requiresPermit: input.permitRequired,
      requiresLicense: input.permitRequired || input.electricalUpgradeNeeded,
      requiresInspection: true,
      requiresEngineering: input.systemKw > 15 || input.roofCondition === "poor",
    }
  );

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    ["Roof check and layout", "Mounting and electrical prep", "Panel install and commissioning", "Inspection and PTO"],
    [
      ["Roof condition photos", "Layout confirmation"],
      ["Mount / flashing photos", "Electrical prep evidence"],
      ["Panel / inverter photos", "Commissioning checklist"],
      ["Final photos", "Client / utility approval"],
    ]
  );

  const evidence = buildEvidenceChecklist("solar", risk, milestones, [
    { type: "photo", description: "Roof condition before install", required: true, milestone: 1 },
    { type: "document", description: "Permit / utility paperwork", required: input.permitRequired, milestone: 1 },
    { type: "photo", description: "Mounting / flashing / wiring", required: true, milestone: 2 },
    { type: "document", description: "Commissioning checklist", required: true, milestone: 3 },
    { type: "inspection", description: "Inspection / PTO evidence", required: true, milestone: 4 },
  ]);

  const warnings: string[] = [
    ...(input.roofCondition === "poor" ? ["Roof condition poor: repair before install."] : []),
    ...(input.sunExposure === "low" ? ["Low sun exposure: generation may be reduced."] : []),
    ...(input.electricalUpgradeNeeded ? ["Electrical upgrade needed: coordinate panel capacity and inspection."] : []),
    ...(input.batteryIncluded ? ["Battery included: add extra commissioning and safety checks."] : []),
    ...(roofShortfall > 0 ? ["Roof area shortfall: panel layout may need redesign."] : []),
  ];

  const recommendations: string[] = [
    "Confirm roof suitability before ordering equipment.",
    "Capture roof, wiring and final install photos.",
    "Hold closeout until inspection and PTO are documented.",
    ...(input.permitRequired ? ["Keep permit paperwork attached to the project."] : []),
  ];

  const evidenceRequired: EvidenceItem[] = evidence.items;

  return {
    toolId: `solar-${Date.now()}`,
    trade: "solar",
    projectType: "renewable",
    mode: input.mode,
    inputs: { ...input },
    validationIssues: issues,
    isValid: isValid(issues),
    materials: mats,
    labor,
    costs,
    risk,
    milestones,
    evidenceRequired,
    warnings,
    recommendations,
    assumptions: [
      "Solar pricing is approximate and highly dependent on local labor and equipment.",
      "Utility interconnection, permit and PTO steps vary by jurisdiction.",
      "Roof repairs and electrical upgrades are assumed only when flagged in the scope.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runSolarEngine = calculateSolar;
