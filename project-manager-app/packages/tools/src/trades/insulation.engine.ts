import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";

export type InsulationInput = {
  areaSqft: number;
  insulationType: "batts" | "blownIn" | "sprayFoam" | "rigidBoard";
  targetRValue: number;
  accessType: "attic" | "walls" | "crawlspace" | "garage" | "exterior";
  existingInsulation: boolean;
  airSealing: boolean;
  materialCostPerSqft: number;
  laborCostPerSqft: number;
  mode: ToolMode;
  prices?: MaterialPriceMap;
};

const ACCESS_MULTIPLIER: Record<InsulationInput["accessType"], number> = {
  attic: 1,
  walls: 1.15,
  crawlspace: 1.35,
  garage: 1.05,
  exterior: 1.25,
};

const INSULATION_BLOWUP: Record<InsulationInput["insulationType"], number> = {
  batts: 1,
  blownIn: 1.08,
  sprayFoam: 1.26,
  rigidBoard: 1.12,
};

export function calculateInsulation(input: InsulationInput): SemseToolResult {
  const issues = collect(
    positive("areaSqft", input.areaSqft, "Área"),
    positive("targetRValue", input.targetRValue, "R-value objetivo"),
    positive("materialCostPerSqft", input.materialCostPerSqft, "Costo de material por sqft"),
    positive("laborCostPerSqft", input.laborCostPerSqft, "Costo de labor por sqft"),
    warn("targetRValue", input.targetRValue >= 30 ? "R-value alto: revisar espesor, cavidades y ventilación." : "R-value válido."),
    input.insulationType === "sprayFoam" && input.accessType === "crawlspace"
      ? warn("accessType", "Spray foam en crawlspace: validar ventilación, PPE y humedad.")
      : null,
    input.accessType === "walls" && !input.airSealing
      ? warn("airSealing", "Acceso en muros sin air sealing: la eficiencia será menor.")
      : null,
    input.existingInsulation && !input.airSealing
      ? warn("existingInsulation", "Existe insulation previa: considerar sellado de aire para mejor resultado.")
      : null,
  );

  const adjustedArea = input.areaSqft * ACCESS_MULTIPLIER[input.accessType] * INSULATION_BLOWUP[input.insulationType];
  const battBundles = Math.max(1, Math.ceil(adjustedArea / 40));
  const blownInBags = Math.max(1, Math.ceil(adjustedArea / 90));
  const rigidBoards = Math.max(1, Math.ceil(adjustedArea / 32));
  const foamKits = Math.max(1, Math.ceil(adjustedArea / 20));
  const airSealKits = input.airSealing ? Math.max(1, Math.ceil(input.areaSqft / 180)) : 0;

  const mats = [
    ...(input.insulationType === "batts"
      ? [material("Insulation batts", battBundles, "bundle", input.materialCostPerSqft * 40, "Insulation")]
      : []),
    ...(input.insulationType === "blownIn"
      ? [material("Blown-in insulation", blownInBags, "bag", input.materialCostPerSqft * 90, "Insulation")]
      : []),
    ...(input.insulationType === "sprayFoam"
      ? [material("Spray foam kits", foamKits, "kit", input.materialCostPerSqft * 20, "Insulation")]
      : []),
    ...(input.insulationType === "rigidBoard"
      ? [material("Rigid board panels", rigidBoards, "sheet", input.materialCostPerSqft * 32, "Insulation")]
      : []),
    ...(input.airSealing ? [material("Air sealing kit", airSealKits, "kit", 34, "Air sealing")] : []),
    ...(input.existingInsulation ? [material("Removal / patch materials", Math.max(1, Math.ceil(input.areaSqft / 150)), "kit", 18, "Prep")] : []),
  ];

  const labor = estimateLabor({
    baseHours:
      3 +
      adjustedArea * (input.laborCostPerSqft / 35) +
      (input.airSealing ? 1.5 : 0) +
      (input.existingInsulation ? 2 : 0) +
      (input.accessType === "crawlspace" ? 2.5 : 0) +
      (input.accessType === "exterior" ? 2 : 0),
    crewSize: adjustedArea > 1200 ? 3 : 2,
    ratePerHour: input.accessType === "crawlspace" || input.insulationType === "sprayFoam" ? 62 : 54,
    difficulty:
      input.insulationType === "sprayFoam" || input.accessType === "crawlspace" || input.accessType === "exterior"
        ? "complex"
        : "moderate",
    notes: [
      `Área ajustada: ${adjustedArea.toFixed(1)} sqft`,
      `R-value objetivo: ${input.targetRValue}`,
      input.airSealing ? "Incluye air sealing." : "Sin air sealing.",
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: input.insulationType === "sprayFoam" ? 0.17 : 0.14,
    profit: 0.2,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: input.areaSqft || 1,
  });

  const risk = computeRisk(
    [
      factor("spray_foam", "Spray foam", 0.16, input.insulationType === "sprayFoam"),
      factor("crawlspace", "Crawlspace access", 0.18, input.accessType === "crawlspace"),
      factor("exterior", "Exterior access", 0.12, input.accessType === "exterior"),
      factor("air_sealing", "Air sealing", 0.14, input.airSealing),
      factor("existing", "Existing insulation", 0.10, input.existingInsulation),
      factor("high_r_value", "High R-value target", 0.14, input.targetRValue >= 30),
    ],
    {
      requiresPermit: input.accessType === "exterior" || input.insulationType === "sprayFoam",
      requiresLicense: false,
      requiresInspection: input.accessType === "crawlspace" || input.accessType === "exterior",
      requiresEngineering: false,
    }
  );

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    ["Prep / air seal", "Install insulation", "Verify coverage / R-value", "Cleanup and handoff"],
    [
      ["Photos before work", "Cavities / attic condition"],
      ["Photos during install", "Material label confirmation"],
      ["Photos of completed coverage", "R-value / depth check"],
      ["Final photos", "Client sign-off"],
    ]
  );

  const evidence = buildEvidenceChecklist("insulation", risk, milestones, [
    { type: "photo", description: "Pre-work attic / cavity / crawlspace photos", required: true, milestone: 1 },
    { type: "photo", description: "Air sealing completed before cover", required: input.airSealing, milestone: 1 },
    { type: "photo", description: "Insulation installed and labeled", required: true, milestone: 2 },
    { type: "measurement", description: "R-value / depth confirmation", required: true, milestone: 3 },
  ]);

  const warnings: string[] = [
    ...(input.insulationType === "sprayFoam" ? ["Spray foam requires PPE, ventilation and cure-time controls."] : []),
    ...(input.accessType === "crawlspace" ? ["Crawlspace access: monitor moisture and confined-space conditions."] : []),
    ...(input.targetRValue < 20 ? ["Target R-value may be low for comfort/efficiency goals."] : []),
    ...(input.airSealing ? [] : ["Without air sealing, performance may be reduced."]),
  ];

  const recommendations: string[] = [
    "Document insulation type, depth and label before closeout.",
    "Perform air sealing before closing cavities or attic access.",
    "Hold escrow release until photos and measurements are captured.",
    ...(input.insulationType === "sprayFoam" ? ["Confirm ventilation and re-entry / cure timing."] : []),
  ];

  const evidenceRequired: EvidenceItem[] = evidence.items;

  return {
    toolId: `insulation-${Date.now()}`,
    trade: "insulation",
    projectType: input.accessType,
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
      "Prices are approximate for the 2026 U.S. market.",
      "Material and labor costs are user-provided or estimated averages.",
      "No mold remediation or structural repair included.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runInsulationEngine = calculateInsulation;
