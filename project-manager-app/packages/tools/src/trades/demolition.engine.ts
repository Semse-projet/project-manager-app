import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";

export type DemolitionInput = {
  areaSqft: number;
  demolitionType: "drywall" | "flooring" | "concrete" | "cabinets" | "fullInterior";
  difficulty: "basic" | "standard" | "complex" | "critical";
  disposalCostPerYard: number;
  laborRatePerHour: number;
  crewSize: number;
  hazardousMaterialSuspected: boolean;
  utilitiesPresent: boolean;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const DEBRIS_PER_SQFT: Record<DemolitionInput["demolitionType"], number> = {
  drywall: 0.018,
  flooring: 0.012,
  concrete: 0.045,
  cabinets: 0.02,
  fullInterior: 0.06,
};

const DIFFICULTY_MULTIPLIER: Record<DemolitionInput["difficulty"], number> = {
  basic: 1,
  standard: 1.12,
  complex: 1.3,
  critical: 1.55,
};

const LABOR_BONUS: Record<DemolitionInput["demolitionType"], number> = {
  drywall: 0,
  flooring: 0.75,
  concrete: 1.75,
  cabinets: 0.8,
  fullInterior: 2.8,
};

export function calculateDemolition(input: DemolitionInput): SemseToolResult {
  const issues = collect(
    positive("areaSqft", input.areaSqft, "Área"),
    positive("disposalCostPerYard", input.disposalCostPerYard, "Costo de disposal"),
    positive("laborRatePerHour", input.laborRatePerHour, "Tarifa de labor"),
    range("crewSize", input.crewSize, 1, 12, "Crew size"),
    input.hazardousMaterialSuspected
      ? warn(
          "hazardousMaterialSuspected",
          "Material peligroso sospechado: validar inspección previa y plan de abatimiento."
        )
      : null,
    input.utilitiesPresent
      ? warn(
          "utilitiesPresent",
          "Utilities presentes: confirmar shutoff, trazado y lockout/tagout antes de demoler."
        )
      : null,
    input.difficulty === "critical"
      ? warn(
          "difficulty",
          "Dificultad crítica: requerirá más evidencia, control de polvo y revisión operativa."
        )
      : null,
  );

  const debrisVolume = Math.max(0.5, input.areaSqft * DEBRIS_PER_SQFT[input.demolitionType] * DIFFICULTY_MULTIPLIER[input.difficulty]);
  const crewSize = Math.max(1, Math.round(input.crewSize));
  const disposalLoads = Math.max(1, Math.ceil(debrisVolume / 8));
  const containmentKits = Math.max(1, Math.ceil(input.areaSqft / 350));
  const ppeKits = Math.max(1, Math.ceil(crewSize * (input.hazardousMaterialSuspected ? 1.5 : 1)));
  const bladesKits = Math.max(1, Math.ceil(input.areaSqft / 500));

  const mats = [
    material("Debris disposal / haul-off", debrisVolume, "yd³", input.disposalCostPerYard, "Disposal", "Estimated demolition debris volume"),
    material("Containment / dust barrier", containmentKits, "kit", 28, "Protection"),
    material("PPE / respirator kits", ppeKits, "kit", input.hazardousMaterialSuspected ? 42 : 24, "Safety"),
    material("Demo blades / cutting discs", bladesKits, "kit", 18, "Tools"),
    ...(input.utilitiesPresent
      ? [material("Utility lockout / marking supplies", 1, "set", 22, "Safety")]
      : []),
    ...(input.demolitionType === "fullInterior"
      ? [material("Dumpster reservation / staging", disposalLoads, "load", 135, "Disposal")]
      : []),
  ];

  const labor = estimateLabor({
    baseHours:
      4 +
      (input.areaSqft / 85) * DIFFICULTY_MULTIPLIER[input.difficulty] +
      LABOR_BONUS[input.demolitionType] +
      (input.utilitiesPresent ? 1.5 : 0) +
      (input.hazardousMaterialSuspected ? 2.25 : 0) +
      (input.demolitionType === "fullInterior" ? 3 : 0),
    crewSize,
    ratePerHour: input.laborRatePerHour,
    difficulty:
      input.difficulty === "critical" || input.hazardousMaterialSuspected || input.demolitionType === "fullInterior"
        ? "complex"
        : input.difficulty === "complex"
          ? "complex"
          : input.demolitionType === "concrete"
            ? "complex"
            : "moderate",
    notes: [
      `Área base: ${input.areaSqft.toFixed(1)} sqft`,
      `Debris estimado: ${debrisVolume.toFixed(2)} yd³`,
      input.utilitiesPresent ? "Utilities presentes en el sitio." : "No utilities expuestas en el input.",
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: input.difficulty === "critical" || input.hazardousMaterialSuspected ? 0.18 : 0.15,
    profit: 0.2,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: input.areaSqft || 1,
  });

  const risk = computeRisk(
    [
      factor("hazardous", "Possible hazardous material", 0.3, input.hazardousMaterialSuspected),
      factor("utilities", "Utilities present", 0.2, input.utilitiesPresent),
      factor("full_interior", "Full interior demo", 0.22, input.demolitionType === "fullInterior"),
      factor("critical", "Critical difficulty", 0.18, input.difficulty === "critical"),
      factor("concrete", "Concrete demolition", 0.12, input.demolitionType === "concrete"),
      factor("large_area", "Large area", 0.08, input.areaSqft > 1000),
    ],
    {
      requiresPermit: input.hazardousMaterialSuspected || input.demolitionType === "fullInterior" || input.difficulty === "critical",
      requiresLicense: input.hazardousMaterialSuspected || input.difficulty === "critical",
      requiresInspection: true,
      requiresEngineering: input.demolitionType === "fullInterior" || (input.utilitiesPresent && input.difficulty === "critical"),
    }
  );

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    [
      "Site protection and shutoff",
      "Selective demolition",
      "Debris removal and haul-off",
      "Final sweep and prep",
      "Client handoff / clearance",
    ],
    [
      ["Photos of protected site", "Utility shutoff confirmation"],
      ["Photos during demolition", "Utility markers / safety notes"],
      ["Photos of debris staged for haul-off", "Disposal ticket"],
      ["Photos of final cleanup", "Dust and debris clearance"],
      ["Final walkthrough photos", "Client approval"],
    ]
  );

  const evidence = buildEvidenceChecklist("demolition", risk, milestones, [
    { type: "photo", description: "Site protection and containment", required: true, milestone: 1 },
    { type: "inspection", description: "Utility shutoff / lockout verified", required: input.utilitiesPresent, milestone: 1 },
    { type: "photo", description: "Active demolition progress", required: true, milestone: 2 },
    { type: "document", description: "Dump / disposal receipt", required: true, milestone: 3 },
    { type: "inspection", description: "Hazardous material clearance", required: input.hazardousMaterialSuspected, milestone: 4 },
    { type: "inspection", description: "Client approval after final cleanup", required: true, milestone: 5 },
  ]);

  const warnings: string[] = [
    ...(input.hazardousMaterialSuspected ? ["Possible hazardous material: inspect before full demo and keep hold on escrow."] : []),
    ...(input.utilitiesPresent ? ["Utilities present: verify shutoff and hidden lines before cutting." ] : []),
    ...(input.demolitionType === "fullInterior" ? ["Full interior demo: dust containment, disposal and adjacent-surface protection are critical."] : []),
    ...(input.demolitionType === "concrete" ? ["Concrete demo: expect heavy debris, noise and slower production rate."] : []),
    ...(input.difficulty === "critical" ? ["Critical difficulty: require admin review and stronger evidence capture."] : []),
  ];

  const recommendations: string[] = [
    "Protect adjacent surfaces before any tear-out.",
    "Confirm utility shutoff and mark all active lines.",
    "Keep disposal tickets and haul-off receipts attached to closeout.",
    ...(input.hazardousMaterialSuspected ? ["Schedule inspection or abatement review before full production demo."] : []),
    ...(input.demolitionType === "fullInterior" ? ["Break the job into phases so escrow can release only after cleanup and clearance."] : []),
  ];

  const evidenceRequired: EvidenceItem[] = evidence.items;

  return {
    toolId: `demolition-${Date.now()}`,
    trade: "demolition",
    projectType:
      input.demolitionType === "fullInterior"
        ? "full-interior-demolition"
        : `${input.demolitionType}-demolition`,
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
      "Demo pricing is an estimate for U.S. market conditions.",
      "Hazardous-material abatement is not included unless explicitly scoped.",
      "Full interior demolition assumes non-structural interior tear-out only.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runDemolitionEngine = calculateDemolition;
