import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal, priceOf } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";

export type CarpentryInput = {
  projectType: "cabinet" | "door" | "closet" | "shelf" | "trim" | "table" | "repair" | "custom";
  material: "pine" | "plywood" | "mdf" | "oak" | "treated";
  lengthIn: number;
  widthIn: number;
  thicknessIn: number;
  quantity: number;
  finishType: "none" | "paint" | "stain" | "polyurethane";
  complexity: "basic" | "medium" | "complex";
  hardwareCount: number;
  mode: ToolMode;
  prices?: MaterialPriceMap;
};

const MATERIAL_PRICE: Record<CarpentryInput["material"], number> = {
  pine: 4.2,
  plywood: 7.4,
  mdf: 5.6,
  oak: 11.5,
  treated: 8.8,
};

const FINISH_PRICE: Record<CarpentryInput["finishType"], number> = {
  none: 0,
  paint: 1.9,
  stain: 2.4,
  polyurethane: 2.8,
};

export function calculateCarpentry(input: CarpentryInput): SemseToolResult {
  const issues = collect(
    positive("lengthIn", input.lengthIn, "Largo"),
    positive("widthIn", input.widthIn, "Ancho"),
    positive("thicknessIn", input.thicknessIn, "Espesor"),
    positive("quantity", input.quantity, "Cantidad"),
    range("hardwareCount", input.hardwareCount, 0, 500, "Herrajes"),
    input.material === "mdf" && input.projectType === "door"
      ? warn("material", "MDF para puerta: validar humedad, bordes sellados y uso interior.")
      : null,
    input.projectType === "door" && input.finishType === "none"
      ? warn("finishType", "Puerta sin acabado: se recomienda sellado o terminación.")
      : null,
    input.complexity === "complex" && input.hardwareCount < 4
      ? warn("hardwareCount", "Proyecto complejo con pocos herrajes: revisar ensamblaje y fijaciones.")
      : null,
  );

  const boardFeet = (input.lengthIn * input.widthIn * input.thicknessIn * input.quantity) / 144;
  const surfaceAreaSqFt = (input.lengthIn * input.widthIn * input.quantity) / 144;
  const wasteFactor = input.complexity === "complex" ? 0.18 : input.complexity === "medium" ? 0.12 : 0.08;
  const adjustedBoardFeet = boardFeet * (1 + wasteFactor);
  const materialUnits = Math.max(1, Math.ceil(adjustedBoardFeet / 2));

  const lumberPrice = (input.material === "pine" || input.material === "treated" || input.material === "plywood")
    ? priceOf(input.prices, "lumber-framing", MATERIAL_PRICE[input.material])
    : MATERIAL_PRICE[input.material];
  const mats = [
    material(`${input.material} stock`, materialUnits, "board-ft", lumberPrice, "Wood"),
    material("Hardware pack", Math.max(1, Math.ceil(input.hardwareCount / 4)), "pack", 14.5, "Hardware"),
    ...(input.finishType !== "none"
      ? [material(`${input.finishType} finish`, Math.max(1, Math.ceil(surfaceAreaSqFt / 25)), "qt", FINISH_PRICE[input.finishType] * 12, "Finish")]
      : []),
    ...(input.projectType === "trim" ? [material("Trim fasteners / adhesive", Math.max(1, Math.ceil(surfaceAreaSqFt / 30)), "kit", 11, "Finish")] : []),
    ...(input.projectType === "repair" ? [material("Patch / filler / sanding kit", Math.max(1, Math.ceil(surfaceAreaSqFt / 20)), "kit", 18, "Repair")] : []),
  ];

  const labor = estimateLabor({
    baseHours:
      3 +
      adjustedBoardFeet / 12 +
      input.quantity * 0.6 +
      input.hardwareCount * 0.08 +
      (input.complexity === "medium" ? 2 : 0) +
      (input.complexity === "complex" ? 4 : 0) +
      (input.projectType === "repair" ? 1.5 : 0) +
      (input.projectType === "door" ? 1.25 : 0) +
      (input.projectType === "cabinet" ? 2 : 0),
    crewSize: adjustedBoardFeet > 180 ? 3 : 2,
    ratePerHour: input.projectType === "cabinet" || input.projectType === "door" ? 68 : 58,
    difficulty:
      input.complexity === "complex" || input.projectType === "cabinet" || input.projectType === "door"
        ? "complex"
        : "moderate",
    notes: [
      `Board feet aproximados: ${adjustedBoardFeet.toFixed(1)}`,
      `Piezas: ${input.quantity}`,
      input.finishType !== "none" ? `Acabado: ${input.finishType}` : "Sin acabado final.",
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: input.complexity === "complex" ? 0.17 : 0.14,
    profit: 0.2,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: input.quantity || 1,
  });

  const risk = computeRisk(
    [
      factor("mdf", "MDF", 0.14, input.material === "mdf"),
      factor("oak", "Oak", 0.12, input.material === "oak"),
      factor("finish_none", "No finish", 0.10, input.finishType === "none"),
      factor("cabinet", "Cabinet / built-in", 0.16, input.projectType === "cabinet" || input.projectType === "closet"),
      factor("door", "Door / trim fit", 0.14, input.projectType === "door" || input.projectType === "trim"),
      factor("complex", "Complex project", 0.20, input.complexity === "complex"),
    ],
    {
      requiresPermit: false,
      requiresLicense: false,
      requiresInspection: input.projectType === "door" || input.complexity === "complex",
      requiresEngineering: false,
    }
  );

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    ["Cutting and layout", "Joinery and assembly", "Finish application", "Install / handoff"],
    [
      ["Photos of material selection", "Confirmed measurements"],
      ["Photos of assembled pieces", "Hardware verification"],
      ["Photos of finish coat / stain", "Surface quality check"],
      ["Photos of installed piece", "Client approval"],
    ]
  );

  const evidence = buildEvidenceChecklist("carpentry", risk, milestones, [
    { type: "photo", description: "Material and cut layout", required: true, milestone: 1 },
    { type: "photo", description: "Joinery / assembly", required: true, milestone: 2 },
    { type: "photo", description: "Finish or surface treatment", required: input.finishType !== "none", milestone: 3 },
    { type: "inspection", description: "Final fit and client sign-off", required: true, milestone: 4 },
  ]);

  const warnings: string[] = [
    ...(input.material === "mdf" ? ["MDF: seal edges and avoid moisture exposure."] : []),
    ...(input.projectType === "door" ? ["Doors require tight tolerances and hinge alignment."] : []),
    ...(input.complexity === "complex" ? ["Complex project: expect more setup and alignment time."] : []),
    ...(input.finishType === "none" ? ["No finish selected: consider sealing or painting for durability."] : []),
  ];

  const recommendations: string[] = [
    "Confirm final dimensions and reveal gaps before cutting.",
    "Check grain direction and finish compatibility.",
    "Capture before/after photos for closeout.",
    ...(input.material === "mdf" ? ["Use edge sealer or primer on MDF surfaces."] : []),
  ];

  const evidenceRequired: EvidenceItem[] = evidence.items;

  return {
    toolId: `carpentry-${Date.now()}`,
    trade: "carpentry",
    projectType: input.projectType,
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
      "Dimensions are treated as finished dimensions.",
      "No cabinet hardware specialty or custom millwork included unless requested.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runCarpentryEngine = calculateCarpentry;
