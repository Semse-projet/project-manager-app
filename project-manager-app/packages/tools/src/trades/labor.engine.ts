import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";

export type LaborInput = {
  projectName: string;
  dailyWorkType: "demo" | "build" | "finish" | "cleanup" | "delivery" | "service" | "multi";
  crewSize: number;
  shiftHours: number;
  taskCount: number;
  materialMoves: number;
  cleanupHours: number;
  travelMinutes: number;
  safetyChecks: number;
  weatherRisk: "low" | "medium" | "high";
  incidentCount: number;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

export function calculateLabor(input: LaborInput): SemseToolResult {
  const issues = collect(
    positive("crewSize", input.crewSize, "Crew size"),
    range("shiftHours", input.shiftHours, 1, 16, "Shift hours"),
    range("taskCount", input.taskCount, 0, 100, "Task count"),
    range("materialMoves", input.materialMoves, 0, 100, "Material moves"),
    range("cleanupHours", input.cleanupHours, 0, 16, "Cleanup hours"),
    range("travelMinutes", input.travelMinutes, 0, 600, "Travel time"),
    range("safetyChecks", input.safetyChecks, 0, 20, "Safety checks"),
    range("incidentCount", input.incidentCount, 0, 20, "Incidents"),
    input.weatherRisk === "high"
      ? warn("weatherRisk", "High weather risk: protect the site and expect delays.")
      : null,
    input.incidentCount > 0
      ? warn("incidentCount", "Incidents reported: review safety before final handoff.")
      : null,
    input.materialMoves > 6
      ? warn("materialMoves", "Many material moves: keep staging tight and documented.")
      : null,
  );

  const baseHours =
    input.shiftHours +
    input.taskCount * 0.25 +
    input.materialMoves * 0.3 +
    input.cleanupHours +
    input.travelMinutes / 60 +
    input.safetyChecks * 0.2 +
    input.incidentCount * 0.8;

  const mats = [
    material("PPE / safety kit", Math.max(1, Math.ceil(input.crewSize / 2)), "kit", 24, "Safety"),
    material("Cleanup supplies", Math.max(1, Math.ceil(input.cleanupHours || 1)), "kit", 12, "Cleanup"),
    material("Daily log / time sheet", 1, "day", 8, "Admin"),
    ...(input.materialMoves > 0 ? [material("Material staging tickets", Math.max(1, Math.ceil(input.materialMoves / 3)), "set", 6, "Ops")] : []),
  ];

  const labor = estimateLabor({
    baseHours,
    crewSize: Math.max(1, input.crewSize),
    ratePerHour: 38 + (input.weatherRisk === "high" ? 4 : 0) + (input.dailyWorkType === "service" ? 3 : 0),
    difficulty:
      input.weatherRisk === "high" || input.incidentCount > 0 || input.taskCount > 12
        ? "complex"
        : input.taskCount > 5 || input.materialMoves > 4
          ? "moderate"
          : "simple",
    notes: [
      `Project: ${input.projectName}`,
      `Daily work type: ${input.dailyWorkType}`,
      `Tasks: ${input.taskCount}`,
      `Material moves: ${input.materialMoves}`,
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: input.dailyWorkType === "cleanup" || input.weatherRisk === "high" ? 0.16 : 0.13,
    profit: 0.16,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: input.shiftHours || 1,
  });

  const risk = computeRisk(
    [
      factor("weather", "Weather risk high", 0.14, input.weatherRisk === "high"),
      factor("incidents", "Incidents reported", 0.18, input.incidentCount > 0),
      factor("moves", "Many material moves", 0.10, input.materialMoves > 6),
      factor("cleanup", "Long cleanup window", 0.10, input.cleanupHours > 2),
      factor("tasks", "Heavy task load", 0.12, input.taskCount > 10),
      factor("travel", "Long travel time", 0.08, input.travelMinutes > 45),
      factor("service", "Service work", 0.06, input.dailyWorkType === "service"),
    ],
    {
      requiresPermit: false,
      requiresLicense: false,
      requiresInspection: input.incidentCount > 0,
      requiresEngineering: false,
    }
  );

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    ["Crew check-in", "Field tasks and material moves", "Cleanup and safety", "Closeout and sign-off"],
    [
      ["Photo of start of shift", "Crew sign-in"],
      ["Photo of tasks / delivery", "Material move log"],
      ["Cleanup photos", "Safety checklist"],
      ["Final photos", "Supervisor approval"],
    ]
  );

  const evidence = buildEvidenceChecklist("labor", risk, milestones, [
    { type: "photo", description: "Start-of-shift site photo", required: true, milestone: 1 },
    { type: "document", description: "Crew sign-in / time log", required: true, milestone: 1 },
    { type: "photo", description: "Material staging or delivery", required: input.materialMoves > 0, milestone: 2 },
    { type: "document", description: "Safety checklist", required: true, milestone: 3 },
    { type: "photo", description: "Cleanup complete", required: true, milestone: 3 },
    { type: "inspection", description: "Supervisor closeout sign-off", required: true, milestone: 4 },
  ]);

  const warnings: string[] = [
    ...(input.weatherRisk === "high" ? ["High weather risk: site protection and schedule buffer needed."] : []),
    ...(input.incidentCount > 0 ? ["Incidents reported: stop and review before closeout."] : []),
    ...(input.materialMoves > 6 ? ["Many material moves: stage materials carefully to avoid waste."] : []),
    ...(input.cleanupHours > 2 ? ["Cleanup is heavy: do not close out before debris is removed."] : []),
  ];

  const recommendations: string[] = [
    "Keep a daily log with photos and crew sign-in.",
    "Track material moves and cleanup before releasing closeout.",
    "Review safety checklist at the start and end of shift.",
    ...(input.incidentCount > 0 ? ["Escalate incidents to supervisor review before payment release."] : []),
  ];

  const evidenceRequired: EvidenceItem[] = evidence.items;

  return {
    toolId: `labor-${Date.now()}`,
    trade: "labor",
    projectType: "daily-field-ops",
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
      "Labor pricing is approximate and based on daily field support.",
      "Safety logs and crew sign-in are assumed to come from the field.",
      "Travel and cleanup can vary by site access and debris volume.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runLaborEngine = calculateLabor;
