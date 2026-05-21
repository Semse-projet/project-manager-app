import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";

export type FlooringInput = {
  lengthFt: number;
  widthFt: number;
  flooringType: "vinyl" | "laminate" | "tile" | "hardwood";
  boxCoverageSqft: number;
  pattern: "straight" | "diagonal" | "herringbone";
  includeUnderlayment: boolean;
  removeOldFloor: boolean;
  floorPrepLevel: "none" | "minor" | "major";
  mode: ToolMode;
  prices?: MaterialPriceMap;
};

const WASTE_BY_PATTERN: Record<FlooringInput["pattern"], number> = {
  straight: 0.08,
  diagonal: 0.12,
  herringbone: 0.18,
};

const MATERIAL_UNIT_COST: Record<FlooringInput["flooringType"], number> = {
  vinyl: 3.6,
  laminate: 4.4,
  tile: 6.8,
  hardwood: 8.9,
};

const UNDERLAYMENT_COST: Record<FlooringInput["flooringType"], number> = {
  vinyl: 0.65,
  laminate: 0.85,
  tile: 1.25,
  hardwood: 1.1,
};

export function calculateFlooring(input: FlooringInput): SemseToolResult {
  const issues = collect(
    positive("lengthFt", input.lengthFt, "Largo"),
    positive("widthFt", input.widthFt, "Ancho"),
    positive("boxCoverageSqft", input.boxCoverageSqft, "Cobertura por caja"),
    warn("pattern", input.pattern === "herringbone" ? "Patrón herringbone: mayor desperdicio y tiempo de instalación." : "Patrón válido."),
    input.flooringType === "hardwood" && !input.includeUnderlayment
      ? warn("includeUnderlayment", "Hardwood sin underlayment: revisar acústica y humedad.")
      : null,
    input.removeOldFloor && input.floorPrepLevel === "none"
      ? warn("floorPrepLevel", "Remoción sin preparación: validar nivelación y adhesión.")
      : null,
  );

  const areaSqFt = input.lengthFt * input.widthFt;
  const wasteFactor = WASTE_BY_PATTERN[input.pattern] + (input.removeOldFloor ? 0.03 : 0);
  const adjustedArea = areaSqFt * (1 + wasteFactor);
  const boxesNeeded = Math.max(1, Math.ceil(adjustedArea / input.boxCoverageSqft));
  const underlaymentSqFt = input.includeUnderlayment ? adjustedArea : 0;
  const prepKitCount = input.floorPrepLevel === "major" ? Math.max(2, Math.ceil(areaSqFt / 120)) : input.floorPrepLevel === "minor" ? Math.max(1, Math.ceil(areaSqFt / 200)) : 0;
  const trimKitCount = input.pattern === "herringbone" ? Math.max(1, Math.ceil(areaSqFt / 180)) : Math.max(1, Math.ceil(areaSqFt / 260));

  const mats = [
    material(`${input.flooringType} flooring`, boxesNeeded, "box", MATERIAL_UNIT_COST[input.flooringType], "Finish"),
    ...(input.includeUnderlayment
      ? [material("Underlayment", Math.max(1, Math.ceil(underlaymentSqFt / 100)), "roll", UNDERLAYMENT_COST[input.flooringType] * 100, "Base")]
      : []),
    ...(input.removeOldFloor ? [material("Old floor removal / disposal", Math.max(1, Math.ceil(areaSqFt / 150)), "job", 38, "Demolition")] : []),
    material("Adhesive / fasteners / spacers", Math.max(1, Math.ceil(areaSqFt / 250)), "kit", 24, "Installation"),
    ...(prepKitCount > 0 ? [material("Subfloor prep materials", prepKitCount, "kit", 32, "Prep")] : []),
    ...(input.pattern === "herringbone" ? [material("Layout / trim extras", trimKitCount, "kit", 26, "Layout")] : []),
  ];

  const labor = estimateLabor({
    baseHours:
      4 +
      adjustedArea / 120 +
      (input.removeOldFloor ? 2.5 : 0) +
      (input.floorPrepLevel === "minor" ? 1.5 : 0) +
      (input.floorPrepLevel === "major" ? 4 : 0) +
      (input.pattern === "diagonal" ? 1.75 : 0) +
      (input.pattern === "herringbone" ? 3.5 : 0) +
      (input.flooringType === "tile" ? 2.25 : 0) +
      (input.flooringType === "hardwood" ? 2 : 0),
    crewSize: adjustedArea > 1000 ? 3 : 2,
    ratePerHour: input.flooringType === "tile" || input.flooringType === "hardwood" ? 62 : 54,
    difficulty:
      input.flooringType === "tile" || input.flooringType === "hardwood" || input.pattern === "herringbone" || input.floorPrepLevel === "major"
        ? "complex"
        : "moderate",
    notes: [
      `Área base: ${areaSqFt.toFixed(1)} sqft`,
      `Área ajustada con desperdicio: ${adjustedArea.toFixed(1)} sqft`,
      input.includeUnderlayment ? "Incluye underlayment." : "Sin underlayment.",
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: input.pattern === "herringbone" || input.floorPrepLevel === "major" ? 0.16 : 0.14,
    profit: 0.2,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: areaSqFt || 1,
  });

  const risk = computeRisk(
    [
      factor("hardwood", "Hardwood", 0.16, input.flooringType === "hardwood"),
      factor("tile", "Tile", 0.14, input.flooringType === "tile"),
      factor("herringbone", "Herringbone", 0.18, input.pattern === "herringbone"),
      factor("remove_old", "Remove old floor", 0.16, input.removeOldFloor),
      factor("major_prep", "Major subfloor prep", 0.20, input.floorPrepLevel === "major"),
      factor("underlayment", "Underlayment required", 0.08, input.includeUnderlayment),
    ],
    {
      requiresPermit: false,
      requiresLicense: false,
      requiresInspection: input.flooringType === "tile" || input.floorPrepLevel === "major",
      requiresEngineering: false,
    }
  );

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    ["Measurement and layout", "Subfloor prep", "Install flooring", "Trim, cleanup and handoff"],
    [
      ["Photos of measurements", "Layout confirmation"],
      ["Photos of prep and underlayment", "Subfloor level check"],
      ["Photos of installed flooring", "Joint / alignment verification"],
      ["Final photos", "Client sign-off"],
    ]
  );

  const evidence = buildEvidenceChecklist("flooring", risk, milestones, [
    { type: "photo", description: "Pre-install room condition", required: true, milestone: 1 },
    { type: "measurement", description: "Subfloor level / moisture check", required: input.flooringType === "hardwood" || input.floorPrepLevel === "major", milestone: 2 },
    { type: "photo", description: "Flooring installed", required: true, milestone: 3 },
    { type: "inspection", description: "Final walkthrough and approval", required: true, milestone: 4 },
  ]);

  const warnings: string[] = [
    ...(input.flooringType === "hardwood" ? ["Hardwood: allow acclimation time before installation."] : []),
    ...(input.pattern === "herringbone" ? ["Herringbone pattern increases waste and layout time."] : []),
    ...(input.removeOldFloor ? ["Remove old floor: verify subfloor condition after demo."] : []),
    ...(input.floorPrepLevel === "major" ? ["Major prep: plan extra labor for leveling and patching."] : []),
  ];

  const recommendations: string[] = [
    "Confirm transitions, trim and baseboard finish before install.",
    "Check moisture / flatness of the subfloor before closing the job.",
    "Capture photos before and after installation for escrow closeout.",
    ...(input.flooringType === "hardwood" ? ["Store hardwood onsite for acclimation before install."] : []),
  ];

  const evidenceRequired: EvidenceItem[] = evidence.items;

  return {
    toolId: `flooring-${Date.now()}`,
    trade: "flooring",
    projectType: input.removeOldFloor ? "floor-remodel" : "floor-install",
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
      "Box coverage is provided by the client or material catalog.",
      "No structural subfloor replacement included.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runFlooringEngine = calculateFlooring;
