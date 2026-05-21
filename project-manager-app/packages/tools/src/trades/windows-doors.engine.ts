import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";

export type WindowsDoorsInput = {
  windows: number;
  doors: number;
  installType: "replacement" | "newConstruction" | "exteriorDoor" | "interiorDoor" | "slidingDoor";
  windowCost: number;
  doorCost: number;
  laborPerUnit: number;
  exteriorWork: boolean;
  flashingRequired: boolean;
  trimIncluded: boolean;
  mode: ToolMode;
  prices?: MaterialPriceMap;
};

export function calculateWindowsDoors(input: WindowsDoorsInput): SemseToolResult {
  const issues = collect(
    range("windows", input.windows, 0, 50, "Ventanas"),
    range("doors", input.doors, 0, 20, "Puertas"),
    positive("windowCost", input.windowCost, "Costo por ventana"),
    positive("doorCost", input.doorCost, "Costo por puerta"),
    positive("laborPerUnit", input.laborPerUnit, "Labor por unidad"),
    input.exteriorWork && !input.flashingRequired
      ? warn("flashingRequired", "Trabajo exterior sin flashing: alto riesgo de filtración.")
      : null,
    input.installType === "newConstruction" && !input.trimIncluded
      ? warn("trimIncluded", "Nueva construcción sin trim: validar acabados y cierre de huecos.")
      : null,
    input.installType === "slidingDoor" && input.exteriorWork
      ? warn("installType", "Puerta corrediza exterior: revisar sello, nivel y drenaje.")
      : null,
  );

  const windowMaterialCount = Math.max(0, input.windows);
  const doorMaterialCount = Math.max(0, input.doors);
  const unitCount = windowMaterialCount + doorMaterialCount;
  const flashingKitCount = input.flashingRequired && input.exteriorWork ? Math.max(1, Math.ceil(windowMaterialCount / 2)) : 0;
  const trimKitCount = input.trimIncluded ? Math.max(1, Math.ceil(unitCount / 2)) : 0;
  const sealantKitCount = input.exteriorWork ? Math.max(1, Math.ceil(unitCount / 3)) : Math.max(1, Math.ceil(unitCount / 4));

  const mats = [
    ...(windowMaterialCount > 0 ? [material("Replacement windows", windowMaterialCount, "unit", input.windowCost, "Windows")] : []),
    ...(doorMaterialCount > 0 ? [material("Doors / slabs", doorMaterialCount, "unit", input.doorCost, "Doors")] : []),
    ...(flashingKitCount > 0 ? [material("Flashing / weatherproofing kit", flashingKitCount, "kit", 55, "Weatherproofing")] : []),
    ...(trimKitCount > 0 ? [material("Trim / casing kit", trimKitCount, "kit", 42, "Finish")] : []),
    material("Sealant / foam / fasteners", sealantKitCount, "kit", input.exteriorWork ? 28 : 22, "Installation"),
  ];

  const labor = estimateLabor({
    baseHours:
      3 +
      unitCount * (input.laborPerUnit / 120) +
      (input.installType === "newConstruction" ? 1.5 : 0) +
      (input.installType === "exteriorDoor" ? 1.25 : 0) +
      (input.installType === "slidingDoor" ? 1.75 : 0) +
      (input.exteriorWork ? 2 : 0) +
      (input.flashingRequired ? 1.25 : 0) +
      (input.trimIncluded ? 1 : 0),
    crewSize: unitCount > 6 ? 3 : 2,
    ratePerHour: input.exteriorWork ? 68 : 58,
    difficulty:
      input.installType === "newConstruction" || input.installType === "slidingDoor" || input.exteriorWork
        ? "complex"
        : "moderate",
    notes: [
      `Unidades totales: ${unitCount}`,
      input.exteriorWork ? "Trabajo exterior activado." : "Trabajo interior principalmente.",
      input.flashingRequired ? "Incluye flashing/weatherproofing." : "Sin flashing marcado.",
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: input.exteriorWork || input.installType === "slidingDoor" ? 0.16 : 0.14,
    profit: 0.2,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: unitCount || 1,
  });

  const risk = computeRisk(
    [
      factor("exterior", "Trabajo exterior", 0.2, input.exteriorWork),
      factor("flashing", "Flashing requerido", 0.18, input.flashingRequired),
      factor("trim", "Trim incluido", 0.08, input.trimIncluded),
      factor("sliding", "Sliding door", 0.16, input.installType === "slidingDoor"),
      factor("new_construction", "New construction", 0.12, input.installType === "newConstruction"),
      factor("window_count", "Multiple windows/doors", 0.12, unitCount >= 5),
    ],
    {
      requiresPermit: input.exteriorWork || input.installType === "newConstruction",
      requiresLicense: false,
      requiresInspection: input.exteriorWork || input.flashingRequired,
      requiresEngineering: false,
    }
  );

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    ["Measure and prep", "Set units", "Seal / trim", "Final inspection and handoff"],
    [
      ["Photos of openings", "Measurement confirmation"],
      ["Photos during install", "Level / plumb check"],
      ["Photos of flashing and trim", "Sealant confirmation"],
      ["Final photos", "Client sign-off"],
    ]
  );

  const evidence = buildEvidenceChecklist("inspection", risk, milestones, [
    { type: "photo", description: "Pre-install openings and framing", required: true, milestone: 1 },
    { type: "photo", description: "Flashing / seal before cover", required: input.flashingRequired || input.exteriorWork, milestone: 3 },
    { type: "measurement", description: "Level / plumb / fit check", required: true, milestone: 2 },
    { type: "inspection", description: "Final review and approval", required: true, milestone: 4 },
  ]);

  const warnings: string[] = [
    ...(input.exteriorWork && !input.flashingRequired ? ["Exterior work without flashing is high risk."] : []),
    ...(input.installType === "slidingDoor" ? ["Sliding door: verify track, level and drainage." ] : []),
    ...(input.installType === "newConstruction" ? ["New construction: confirm rough opening before ordering." ] : []),
    ...(input.trimIncluded ? [] : ["Trim omitted: closeout may need additional finish work."]),
  ];

  const recommendations: string[] = [
    "Verify rough openings and final dimensions before ordering units.",
    "Document flashing, sealant and final alignment with photos.",
    "Hold escrow release until fit, seal and finish are approved.",
    ...(input.exteriorWork ? ["Use weatherproofing evidence for exterior closeout."] : []),
  ];

  const evidenceRequired: EvidenceItem[] = evidence.items;

  return {
    toolId: `windows-doors-${Date.now()}`,
    trade: "inspection",
    projectType: input.installType,
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
      "Window and door unit prices are client-supplied or catalog averages.",
      "No framing repair or structural correction included.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runWindowsDoorsEngine = calculateWindowsDoors;
