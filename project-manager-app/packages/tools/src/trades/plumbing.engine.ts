import { collect, isValid, positive, range, warn } from "../core/validation-engine.js";
import { applyLocation, buildCostSummary, material, materialTotal, priceOf } from "../core/cost-engine.js";
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
  assessHiddenDamageProbability,
  buildInspectionGate,
  buildAlgorithmTrace,
  computeSafeToProceed,
  ALGORITHM_VERSIONS,
} from "../core/extended-metrics.js";

export type PipeType        = "pex" | "cpvc" | "copper" | "galvanized";
export type WaterHeaterType = "tank-gas" | "tank-electric" | "tankless-gas" | "tankless-electric" | "heat-pump-wh";
export type PlumbingScope   = "fixture-service" | "partial-repipe" | "full-repipe" | "new-rough-in";

export type PlumbingInput = {
  scope: PlumbingScope;
  fixtureCount: number;
  pipeType: PipeType;
  supplyLineFeet: number;
  drainLineFeet: number;
  waterHeaterReplace: boolean;
  waterHeaterType: WaterHeaterType;
  waterHeaterGallons: number;
  slabAccess: boolean;
  crawlspaceAccess: boolean;
  gasWork: boolean;
  outdoorWork: boolean;
  backflowPreventer: boolean;
  existingPipeCondition: "good" | "fair" | "poor" | "unknown";
  mode: ToolMode;
  prices?: MaterialPriceMap;
  location?: LocationMultipliers;
};

const PIPE_COST_PER_LF: Record<PipeType, number> = {
  pex:        1.65,
  cpvc:       1.85,
  copper:     4.20,
  galvanized: 3.60,
};

const WATER_HEATER_COST: Record<WaterHeaterType, number> = {
  "tank-gas":           950,
  "tank-electric":      750,
  "tankless-gas":      1650,
  "tankless-electric": 1250,
  "heat-pump-wh":      1800,
};

export function calculatePlumbing(input: PlumbingInput): SemseToolResult {
  const issues = collect(
    positive("fixtureCount",   input.fixtureCount,   "Fixture count"),
    positive("supplyLineFeet", input.supplyLineFeet,  "Supply line footage"),
    range("drainLineFeet",     input.drainLineFeet,   0, 600, "Drain line footage"),
    input.supplyLineFeet > 100 ? warn("supplyLineFeet", "Long run: verify pressure and pipe sizing.") : null,
    input.existingPipeCondition === "poor"    ? warn("existingPipeCondition", "Poor pipe condition: budget for expanded scope.") : null,
    input.existingPipeCondition === "unknown" ? warn("existingPipeCondition", "Pipe condition unknown: camera inspection recommended.") : null,
    input.pipeType === "galvanized" ? warn("pipeType", "Galvanized is end-of-life — consider upgrading to PEX or copper.") : null,
    input.slabAccess ? warn("slabAccess", "Slab access: concrete cutting and restoration add significant cost.") : null,
  );

  const pipeCostPerLf = priceOf(input.prices, `${input.pipeType}-pipe`, PIPE_COST_PER_LF[input.pipeType]);
  const wasteSupply   = input.scope === "full-repipe" ? 0.15 : 0.10;

  const mats = [
    material(`${input.pipeType.toUpperCase()} supply pipe`, Math.ceil(input.supplyLineFeet * (1 + wasteSupply)), "lf", pipeCostPerLf, "Supply"),
    material("PVC drain pipe", Math.ceil(input.drainLineFeet * 1.10), "lf", 2.20, "Drain"),
    material("Shutoff valves", input.fixtureCount + 2, "un", 22, "Valves"),
    material("Fittings, primer & cement", Math.max(3, Math.ceil(input.fixtureCount * 2)), "kit", 28, "Fittings"),
    material("P-traps and drain assemblies", input.fixtureCount, "un", 18, "Drain"),
    ...(input.waterHeaterReplace ? [
      material(`Water heater (${input.waterHeaterType}, ${input.waterHeaterGallons}gal)`, 1, "unit",
        WATER_HEATER_COST[input.waterHeaterType] + (input.waterHeaterGallons > 50 ? 200 : 0), "Water Heater"),
      material("Water heater kit (expansion tank, T&P, flex)", 1, "kit", 185, "Water Heater"),
    ] : []),
    ...(input.slabAccess ? [
      material("Concrete saw & cutting", Math.ceil(input.supplyLineFeet / 20), "lf", 35, "Slab"),
      material("Concrete patch & restore", Math.ceil(input.supplyLineFeet / 20), "lf", 28, "Slab"),
    ] : []),
    ...(input.gasWork ? [material("Gas line fittings & valve", 1, "job", 220, "Gas")] : []),
    ...(input.backflowPreventer ? [material("Backflow preventer assembly", 1, "unit", 185, "Backflow")] : []),
    material("Permits & inspection", 1, "job", 155, "Permits"),
  ];

  const baseHours =
    3
    + input.fixtureCount * 1.8
    + input.supplyLineFeet / 35
    + input.drainLineFeet / 55
    + (input.waterHeaterReplace ? 3.5 : 0)
    + (input.slabAccess ? input.supplyLineFeet / 15 : 0)
    + (input.crawlspaceAccess ? input.supplyLineFeet / 40 : 0)
    + (input.gasWork ? 3.0 : 0)
    + (input.scope === "full-repipe" ? input.fixtureCount * 0.5 : 0);

  const labor = estimateLabor({
    baseHours,
    crewSize: input.slabAccess || input.scope === "full-repipe" ? 2 : 1,
    ratePerHour: 76,
    difficulty: input.slabAccess || input.scope === "full-repipe" || input.gasWork ? "complex" : "moderate",
    notes: [
      `${input.scope} — ${input.fixtureCount} fixture(s)`,
      `${input.pipeType.toUpperCase()}: ${input.supplyLineFeet}ft supply / ${input.drainLineFeet}ft drain`,
      input.waterHeaterReplace ? `Water heater: ${input.waterHeaterType} ${input.waterHeaterGallons}gal` : "",
      input.slabAccess ? "Slab: concrete cutting required" : "",
    ].filter(Boolean),
  });

  const costs = buildCostSummary(
    applyLocation(materialTotal(mats), input.location, "material"),
    applyLocation(labor.totalCost,     input.location, "labor"),
    { overhead: 0.15, profit: 0.20, taxRate: 0.07, semseFeeRate: 0.05 },
  );

  const risk = computeRisk([
    factor("slab",         "Slab penetration",        0.24, input.slabAccess),
    factor("pipe_poor",    "Poor pipe condition",     0.20, input.existingPipeCondition === "poor"),
    factor("pipe_unknown", "Unknown pipe condition",  0.12, input.existingPipeCondition === "unknown"),
    factor("full_repipe",  "Full repipe",             0.16, input.scope === "full-repipe"),
    factor("gas_work",     "Gas line work",           0.18, input.gasWork),
    factor("water_heater", "Water heater replacement",0.10, input.waterHeaterReplace),
    factor("crawlspace",   "Crawlspace access",       0.10, input.crawlspaceAccess),
  ], {
    requiresPermit:     input.waterHeaterReplace || input.slabAccess || input.scope !== "fixture-service",
    requiresLicense:    true,
    requiresInspection: input.waterHeaterReplace || input.slabAccess,
    requiresEngineering: input.scope === "new-rough-in",
  });

  const hiddenDamage = assessHiddenDamageProbability(
    undefined,
    input.existingPipeCondition === "poor",
    input.existingPipeCondition === "poor",
    false,
    false,
    false,
  );

  const confidence = computeConfidenceScore({
    hasMeasurements:      true,
    hasPhotos:            false,
    hasConditionData:     input.existingPipeCondition !== "unknown",
    hasMaterialSelection: true,
    hasScopeConfirmed:    input.existingPipeCondition !== "unknown",
    hasUnknownConditions: input.existingPipeCondition === "unknown",
    extraConfirmedFields: (input.backflowPreventer ? 1 : 0) + (input.waterHeaterReplace ? 1 : 0),
  });

  const readiness = computeReadinessScore({
    measurementsConfirmed:  true,
    materialsAvailable:     false,
    siteAccessConfirmed:    true,
    permitsAddressed:       false,
    scopeApproved:          input.existingPipeCondition !== "unknown",
    depositPaid:            false,
    clientApproval:         false,
    otherTradesCoordinated: false,
  });

  const disputeRisk = computeDisputeRisk({
    scopeAmbiguous:           input.existingPipeCondition === "unknown",
    clientProvidesMaterials:  false,
    noPhotosRequired:         false,
    hasChangeOrderPolicy:     true,
    hasEvidenceRequired:      true,
    hasMilestones:            true,
    hasHighRiskConditions:    input.slabAccess || input.existingPipeCondition !== "good",
    priceIsFixed:             true,
    clientExpectationMismatch: input.slabAccess,
  });

  const priceBands = computePriceBands(
    costs.total,
    0.78,
    input.slabAccess || input.scope === "full-repipe" ? 1.48 : 1.28,
    {
      low:  "Minor fixture service, PEX, good conditions, no slab, no water heater",
      mid:  "Partial repipe, standard access, water heater replacement",
      high: input.slabAccess ? "Slab cut + poor pipe condition + full repipe" : "Full repipe + water heater + crawlspace access",
    },
  );

  const scope = buildScope(
    [
      `${input.scope} — ${input.fixtureCount} fixture(s)`,
      `${input.pipeType.toUpperCase()} supply (${input.supplyLineFeet} ft)`,
      `PVC drain (${input.drainLineFeet} ft)`,
      input.waterHeaterReplace ? `Water heater: ${input.waterHeaterType} ${input.waterHeaterGallons}gal` : "",
      input.slabAccess ? "Concrete saw cut, pipe install, and concrete patch" : "",
      input.gasWork ? "Gas line connection and valve" : "",
      input.backflowPreventer ? "Backflow preventer" : "",
      "Pressure test on all new supply lines",
      "Permit and inspection",
    ].filter(Boolean),
    [
      "Finish restoration beyond concrete patch",
      !input.gasWork ? "Gas line work" : "",
      "Water softener or filtration",
      "Sewer line work beyond building drain",
      "Fixture purchase (client-supplied unless noted)",
    ].filter(Boolean),
    [
      "Adequate water pressure at entry (40-80 PSI)",
      "Existing drain slope meets code (1/4\"/ft min)",
      input.slabAccess ? "Slab ≤6 inches thick; no post-tension cables" : "",
    ].filter(Boolean),
    [
      "Additional corrosion or collapsed pipe discovered",
      "Post-tension cables or rebar blocking slab cut",
      "Hidden water damage requiring remediation",
      "Drain slope non-compliance requiring rerouting",
    ],
  );

  const milestones = buildMilestones(costs.total, risk.level,
    ["Demo & access", "Supply rough-in", "Drain & vent", "Pressure test & close-up"],
    [
      ["Photos of existing conditions", "Shutoff verification"],
      ["Supply line installation photos", "Valve locations"],
      ["Drain install photos", "Slope verification"],
      ["Pressure test gauge photo (80+ PSI / 15 min)", "Inspection sign-off"],
    ]
  );

  const evidence = buildEvidenceChecklist("plumbing", risk, milestones, [
    { type: "photo",       description: "Pre-existing pipe condition",              required: true,  milestone: 1 },
    { type: "photo",       description: "New supply line installed",                required: true,  milestone: 2 },
    { type: "measurement", description: "Pressure test (80+ PSI, 15 min hold)",    required: true,  milestone: 4 },
    { type: "photo",       description: "Water heater installation",               required: input.waterHeaterReplace, milestone: 2 },
    { type: "inspection",  description: "Municipal inspection sign-off",           required: risk.requiresInspection,  milestone: 4 },
  ]);

  const warranty = buildWarranty(365,
    `Labor: 1 year. Water heater manufacturer: ${input.waterHeaterType.startsWith("tankless") ? "10-15 yr heat exchanger" : "6-12 yr tank"}.`,
    ["Freeze damage", "Mechanical damage by client", "Water quality outside normal range"],
  );

  const inspectionGate = buildInspectionGate(
    "After rough-in, before closure of walls, floors, or slab",
    ["Pressure gauge readings", "Photos of all exposed connections"],
    "Additional pipe damage or drain slope failure requiring rerouting",
    "Pressure-test supply lines. Inspect drain slope. Document before any concrete or drywall.",
  );

  const safeToProceed = computeSafeToProceed({
    hasMinimalData:      isValid(issues),
    readinessScore:      readiness.score,
    hasCriticalBlockers: input.existingPipeCondition === "unknown" && input.slabAccess,
    hasMilestones:       true,
    hasEvidencePlan:     true,
    confidenceScore:     confidence.score,
    noCriticalBlockers:  !(input.existingPipeCondition === "unknown" && input.slabAccess),
    scopeIsComplete:     input.existingPipeCondition !== "unknown",
  });

  const explained = buildExplainedOutput(
    `Your ${input.scope} includes ${input.fixtureCount} fixture(s) with ${input.pipeType.toUpperCase()} supply (${input.supplyLineFeet} ft) and PVC drain (${input.drainLineFeet} ft).${input.waterHeaterReplace ? ` New ${input.waterHeaterType} water heater (${input.waterHeaterGallons} gal) included.` : ""} Total: $${costs.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}. Pressure test and permit inspection included.`,
    [
      `${input.pipeType.toUpperCase()} supply / PVC drain — ${input.supplyLineFeet}ft / ${input.drainLineFeet}ft`,
      input.slabAccess ? "⚠ Slab access: confirm no post-tension cables before cutting" : "No slab penetration",
      `Hidden damage risk: ${hiddenDamage.probability} (score: ${hiddenDamage.score}) — ${hiddenDamage.recommendation}`,
      `Confidence ${confidence.score}/100 · Readiness ${readiness.score}/100`,
    ],
  );

  const algorithmTrace = buildAlgorithmTrace(
    ALGORITHM_VERSIONS.plumbing ?? "plumbing-v2.0",
    "plumbing",
    ["scope", "fixtureCount", "pipeType", "supplyLineFeet", "drainLineFeet", "slabAccess", "gasWork"],
    input.existingPipeCondition === "unknown" ? ["pipe condition details"] : [],
    ["Adequate water pressure at supply", "Existing drain slope meets code"],
    [
      { ruleId: "SLAB_PREMIUM",    label: "Slab access surcharge",    triggered: input.slabAccess,                             reason: "Concrete cutting + patch: significant cost and schedule impact", points: 24 },
      { ruleId: "FULL_REPIPE",     label: "Full repipe scope",        triggered: input.scope === "full-repipe",                reason: "All supply lines replaced — maximum scope and labor", points: 16 },
      { ruleId: "GAS_WORK",        label: "Gas work risk",            triggered: input.gasWork,                                reason: "Gas requires licensed plumber and separate inspection", points: 18 },
      { ruleId: "PIPE_CONDITION",  label: "Pipe condition risk",      triggered: input.existingPipeCondition !== "good",       reason: `Condition ${input.existingPipeCondition} — higher scope discovery risk`, points: 20 },
      { ruleId: "GALVANIZED",      label: "Galvanized pipe",          triggered: input.pipeType === "galvanized",              reason: "End-of-life material — advise full repipe upgrade", points: 10 },
    ],
  );

  return {
    toolId: `plumbing-${Date.now()}`,
    trade: "plumbing",
    projectType: input.scope,
    mode: input.mode,
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
      ...(input.slabAccess ? ["Slab: confirm no post-tension cables or embedded conduit before cutting."] : []),
      ...(input.existingPipeCondition === "poor" ? ["Poor pipe condition: budget for additional scope discovery."] : []),
      ...(input.pipeType === "galvanized" ? ["Galvanized: highly corrosion-prone — recommend full repipe upgrade."] : []),
      ...(input.gasWork ? ["Gas work: verify plumber holds gas certification in local jurisdiction."] : []),
    ],
    recommendations: [
      "Pressure test all supply lines before closing walls or slabs.",
      "Camera inspect existing drain lines if age/condition unknown.",
      "Label all shutoff valves and provide diagram to client.",
      input.waterHeaterReplace ? "Register water heater warranty immediately after install." : "",
    ].filter(Boolean),
    assumptions: [
      "Adequate water pressure at main supply entry.",
      "Existing drain slope meets code requirements.",
      "US market pricing — use location multiplier for regional adjustments.",
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

export const runPlumbingEngine = calculatePlumbing;
