import { collect, isValid, positive, range, required, warn } from "../core/validation-engine.js";
import { buildCostSummary, material, materialTotal } from "../core/cost-engine.js";
import { computeRisk, factor } from "../core/risk-engine.js";
import { buildMilestones } from "../core/milestone-engine.js";
import { estimateLabor } from "../core/labor-engine.js";
import { buildEvidenceChecklist } from "../core/evidence-engine.js";
import type { EvidenceItem, LocationMultipliers, MaterialPriceMap, SemseToolResult, ToolMode } from "../core/types.js";

export type ProjectManagerInput = {
  projectName: string;
  projectType: "remodel" | "newConstruction" | "repair" | "service" | "multitrade";
  budget: number;
  projectedDurationDays: number;
  crewSize: number;
  activeTrades: number;
  openTasks: number;
  inspectionsDue: number;
  changeOrders: number;
  clientMeetingsPerWeek: number;
  weatherRisk: "low" | "medium" | "high";
  permitRequired: boolean;
  safetyIssues: number;
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

export function calculateProjectManager(input: ProjectManagerInput): SemseToolResult {
  const issues = collect(
    required("projectName", input.projectName),
    positive("budget", input.budget, "Presupuesto"),
    range("projectedDurationDays", input.projectedDurationDays, 1, 3650, "Duración"),
    range("crewSize", input.crewSize, 1, 20, "Crew size"),
    range("activeTrades", input.activeTrades, 1, 20, "Active trades"),
    range("openTasks", input.openTasks, 0, 500, "Open tasks"),
    range("inspectionsDue", input.inspectionsDue, 0, 50, "Inspections"),
    range("changeOrders", input.changeOrders, 0, 100, "Change orders"),
    range("clientMeetingsPerWeek", input.clientMeetingsPerWeek, 0, 30, "Client meetings"),
    range("safetyIssues", input.safetyIssues, 0, 50, "Safety issues"),
    input.weatherRisk === "high"
      ? warn("weatherRisk", "High weather risk: add schedule buffer and site protection.")
      : null,
    input.permitRequired
      ? warn("permitRequired", "Permit required: keep approvals and inspection dates visible.")
      : null,
    input.changeOrders > 0
      ? warn("changeOrders", "Change orders present: document scope changes before release.")
      : null,
    input.safetyIssues > 0
      ? warn("safetyIssues", "Safety issues detected: close them before final handoff.")
      : null,
    input.activeTrades > 4
      ? warn("activeTrades", "Many active trades: coordination risk is rising.")
      : null,
  );

  const mats = [
    material("Supervisor coordination", Math.max(1, Math.ceil(input.projectedDurationDays / 3)), "day", 145, "Management"),
    material("Daily field ops log", Math.max(1, input.projectedDurationDays), "day", 18, "Operations"),
    material("Crew / schedule board", Math.max(1, Math.ceil(input.activeTrades / 2)), "set", 38, "Planning"),
    ...(input.permitRequired || input.inspectionsDue > 0
      ? [material("Permit / inspection packet", Math.max(1, input.inspectionsDue || 1), "set", 62, "Admin")]
      : []),
    ...(input.changeOrders > 0 ? [material("Change order packet", input.changeOrders, "item", 28, "Admin")] : []),
    ...(input.safetyIssues > 0 ? [material("Safety / closeout checklist", Math.max(1, input.safetyIssues), "item", 22, "Safety")] : []),
  ];

  const labor = estimateLabor({
    baseHours:
      3 +
      input.projectedDurationDays * 0.45 +
      input.activeTrades * 0.85 +
      input.openTasks * 0.18 +
      input.inspectionsDue * 0.7 +
      input.changeOrders * 0.65 +
      input.clientMeetingsPerWeek * 0.55 +
      input.safetyIssues * 0.75,
    crewSize: Math.max(1, Math.min(4, input.crewSize)),
    ratePerHour:
      72 +
      (input.weatherRisk === "high" ? 10 : 0) +
      (input.permitRequired ? 8 : 0) +
      (input.projectType === "newConstruction" ? 12 : 0),
    difficulty:
      input.projectType === "newConstruction" ||
      input.weatherRisk === "high" ||
      input.permitRequired ||
      input.activeTrades > 5
        ? "specialist"
        : "complex",
    notes: [
      `Project: ${input.projectName}`,
      `Active trades: ${input.activeTrades}`,
      `Open tasks: ${input.openTasks}`,
      input.permitRequired ? "Permit tracking enabled." : "No permit flag set.",
    ],
  });

  const costs = buildCostSummary(materialTotal(mats), labor.totalCost, {
    overhead: input.projectType === "newConstruction" || input.permitRequired ? 0.22 : 0.18,
    profit: 0.18,
    taxRate: 0.07,
    semseFeeRate: 0.05,
    perUnitDivisor: input.projectedDurationDays || 1,
  });

  const risk = computeRisk(
    [
      factor("permit", "Permit required", 0.14, input.permitRequired),
      factor("weather", "Weather risk high", 0.15, input.weatherRisk === "high"),
      factor("trades", "Multiple trades active", 0.12, input.activeTrades > 3),
      factor("tasks", "Open task backlog", 0.14, input.openTasks > 10),
      factor("change_orders", "Change orders active", 0.14, input.changeOrders > 0),
      factor("safety", "Safety issues open", 0.16, input.safetyIssues > 0),
      factor("inspections", "Inspections pending", 0.10, input.inspectionsDue > 0),
      factor("budget", "Large project budget", 0.12, input.budget > 75000),
    ],
    {
      requiresPermit: input.permitRequired,
      requiresLicense: input.permitRequired || input.projectType === "newConstruction",
      requiresInspection: input.inspectionsDue > 0 || input.permitRequired,
      requiresEngineering: input.projectType === "newConstruction" || input.budget > 100000 || input.activeTrades > 6,
    }
  );

  const milestones = buildMilestones(
    costs.total,
    risk.level,
    ["Kickoff and scope", "Daily field ops", "Inspections and change orders", "Closeout and handoff"],
    [
      ["Project kickoff photos", "Scope confirmation"],
      ["Daily log", "Crew / task board"],
      ["Inspection evidence", "Change order approval"],
      ["Final photos", "Client approval"],
    ]
  );

  const evidence = buildEvidenceChecklist("project-manager", risk, milestones, [
    { type: "document", description: "Project scope / schedule board", required: true, milestone: 1 },
    { type: "photo", description: "Site kickoff condition", required: true, milestone: 1 },
    {
      type: "document",
      description: "Daily log / manpower record",
      required: input.openTasks > 0 || input.activeTrades > 1,
      milestone: 2,
    },
    {
      type: "inspection",
      description: "Permit / inspection record",
      required: input.permitRequired || input.inspectionsDue > 0,
      milestone: 3,
    },
    {
      type: "document",
      description: "Signed change orders",
      required: input.changeOrders > 0,
      milestone: 3,
    },
    { type: "photo", description: "Final closeout photos", required: true, milestone: 4 },
  ]);

  const warnings: string[] = [
    ...(input.weatherRisk === "high"
      ? ["High weather risk: keep buffer days and protect the site."]
      : []),
    ...(input.permitRequired
      ? ["Permit required: do not closeout before inspection evidence is stored."]
      : []),
    ...(input.changeOrders > 0
      ? ["Change orders present: get written approval before next release."]
      : []),
    ...(input.safetyIssues > 0 ? ["Safety issues detected: log and clear them before final handoff."] : []),
    ...(input.activeTrades > 4 ? ["Many active trades: coordination risk is high."] : []),
  ];

  const recommendations: string[] = [
    "Run a daily field log and keep it attached to the project.",
    "Hold photos, approvals and inspection records before escrow release.",
    "Track crew assignments and open tasks every day.",
    ...(input.changeOrders > 0 ? ["Freeze scope changes until the client signs the change order."] : []),
    ...(input.permitRequired ? ["Confirm permit status before final handoff."] : []),
  ];

  const evidenceRequired: EvidenceItem[] = evidence.items;

  return {
    toolId: `project-manager-${Date.now()}`,
    trade: "project-manager",
    projectType: "construction-management",
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
      "Project management pricing is approximate and scales with schedule complexity.",
      "Permit and inspection handling varies by locality and scope.",
      "Daily logs and evidence are assumed to be provided from the field or client workspace.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export const runProjectManagerEngine = calculateProjectManager;
