/**
 * Extended metrics algorithms for SEMSE ProTools.
 * All engines can call these functions to enrich their output
 * with confidence scoring, dispute risk, scope clarity,
 * production scheduling, price bands, warranty and upsells.
 */

import type { RiskResult, RiskLevel } from "./types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfidenceLevel = "low" | "medium" | "high";
export type ReadinessLevel  = "not_ready" | "preliminary" | "ready" | "contract_ready";

export type ConfidenceScore = {
  /** 0-100 */
  score: number;
  level: ConfidenceLevel;
  /** Factors that reduced confidence */
  missingFactors: string[];
};

export type DisputeRiskScore = {
  /** 0-100 */
  score: number;
  level: RiskLevel;
  reasons: string[];
  /** Specific mitigation recommendations */
  mitigations: string[];
};

export type ReadinessScore = {
  /** 0-100 */
  score: number;
  level: ReadinessLevel;
  /** Things blocking the project from starting */
  blockers: string[];
};

export type ScopeOutput = {
  /** Items explicitly covered in this estimate */
  included: string[];
  /** Items NOT covered — must be written separately */
  excluded: string[];
  /** Things assumed to be true */
  assumptions: string[];
  /** Conditions that auto-generate a change order */
  changeOrderTriggers: string[];
};

export type ProductionPhase = {
  name: string;
  daysMin: number;
  daysMax: number;
  crew: number;
  description: string;
};

export type ProductionSchedule = {
  totalDaysMin: number;
  totalDaysMax: number;
  crewSizeRecommended: number;
  phases: ProductionPhase[];
};

export type PriceBands = {
  /** Minimum plausible outcome (perfect conditions, client materials, no extras) */
  low: number;
  /** Expected / recommended price */
  mid: number;
  /** Maximum with all variables worst-case */
  high: number;
  currency: "USD";
  /** What drives each band */
  notes: { low: string; mid: string; high: string };
};

export type WarrantyTerms = {
  laborDays: number;
  scope: string;
  exclusions: string[];
};

export type UpsellOpportunity = {
  service: string;
  reason: string;
  additionalCostRange?: { min: number; max: number };
};

export type ExplainedOutput = {
  /** 2-3 sentences — plain language for the client */
  clientSummary: string;
  /** Technical notes for the professional */
  professionalNotes: string[];
};

// ─── Confidence Score ─────────────────────────────────────────────────────────

export type ConfidenceInput = {
  hasMeasurements: boolean;
  hasPhotos: boolean;
  hasConditionData: boolean;
  hasMaterialSelection: boolean;
  hasScopeConfirmed: boolean;
  clientProvidesMaterials?: boolean;
  hasUnknownConditions?: boolean;
  extraConfirmedFields?: number; // 0-10
};

export function computeConfidenceScore(input: ConfidenceInput): ConfidenceScore {
  const missing: string[] = [];
  let score = 100;

  if (!input.hasMeasurements)      { score -= 25; missing.push("Measurements not confirmed"); }
  if (!input.hasPhotos)            { score -= 20; missing.push("No site photos provided"); }
  if (!input.hasConditionData)     { score -= 15; missing.push("Surface/site condition unknown"); }
  if (!input.hasMaterialSelection) { score -= 15; missing.push("Material type not selected"); }
  if (!input.hasScopeConfirmed)    { score -= 10; missing.push("Scope not fully confirmed"); }
  if (input.clientProvidesMaterials) { score -= 10; missing.push("Client-provided materials introduce variability"); }
  if (input.hasUnknownConditions)  { score -= 15; missing.push("Unknown hidden conditions suspected"); }

  // Bonus for extra confirmed fields
  const bonus = Math.min(15, (input.extraConfirmedFields ?? 0) * 1.5);
  score = Math.max(0, Math.min(100, Math.round(score + bonus)));

  const level: ConfidenceLevel =
    score >= 75 ? "high" :
    score >= 45 ? "medium" : "low";

  return { score, level, missingFactors: missing };
}

// ─── Dispute Risk ─────────────────────────────────────────────────────────────

export type DisputeRiskInput = {
  scopeAmbiguous: boolean;
  clientProvidesMaterials: boolean;
  noPhotosRequired: boolean;
  hasChangeOrderPolicy: boolean;
  hasEvidenceRequired: boolean;
  hasMilestones: boolean;
  hasHighRiskConditions: boolean;
  priceIsFixed: boolean;
  clientExpectationMismatch?: boolean;
};

export function computeDisputeRisk(input: DisputeRiskInput): DisputeRiskScore {
  const reasons: string[] = [];
  const mitigations: string[] = [];
  let score = 10; // base

  if (input.scopeAmbiguous)            { score += 22; reasons.push("Scope not clearly defined"); mitigations.push("Document exact scope in writing before work begins"); }
  if (input.clientProvidesMaterials)   { score += 15; reasons.push("Client-provided materials reduce control"); mitigations.push("Inspect materials on delivery and document any issues"); }
  if (input.noPhotosRequired)          { score += 12; reasons.push("No before/after photos required"); mitigations.push("Always take photos before and after — non-negotiable"); }
  if (!input.hasChangeOrderPolicy)     { score += 18; reasons.push("No change order process defined"); mitigations.push("Add change order clause to contract"); }
  if (!input.hasEvidenceRequired)      { score += 10; reasons.push("No evidence requirements set"); mitigations.push("Define evidence per milestone"); }
  if (!input.hasMilestones)            { score += 12; reasons.push("No milestone payment structure"); mitigations.push("Break payment into milestone releases"); }
  if (input.hasHighRiskConditions)     { score += 15; reasons.push("High-risk conditions detected"); mitigations.push("Document all pre-existing conditions before starting"); }
  if (input.priceIsFixed && input.scopeAmbiguous) { score += 10; reasons.push("Fixed price with unclear scope"); }
  if (input.clientExpectationMismatch) { score += 18; reasons.push("Client expectation vs scope mismatch"); mitigations.push("Walk client through what is and is NOT included before approval"); }

  score = Math.min(100, Math.round(score));

  const level: RiskLevel =
    score >= 75 ? "critical" :
    score >= 50 ? "high" :
    score >= 25 ? "medium" : "low";

  return { score, level, reasons, mitigations };
}

// ─── Readiness Score ──────────────────────────────────────────────────────────

export type ReadinessInput = {
  measurementsConfirmed: boolean;
  materialsAvailable: boolean;
  siteAccessConfirmed: boolean;
  permitsAddressed: boolean;
  scopeApproved: boolean;
  depositPaid: boolean;
  clientApproval: boolean;
  otherTradesCoordinated?: boolean;
  designApproved?: boolean;
};

export function computeReadinessScore(input: ReadinessInput): ReadinessScore {
  const blockers: string[] = [];
  let score = 0;

  if (input.measurementsConfirmed) score += 20; else blockers.push("Measurements not confirmed");
  if (input.materialsAvailable)    score += 18; else blockers.push("Materials not on site");
  if (input.siteAccessConfirmed)   score += 12;
  if (input.permitsAddressed)      score += 10; else if (score < 20) blockers.push("Permit status unknown");
  if (input.scopeApproved)         score += 20; else blockers.push("Scope not approved by client");
  if (input.depositPaid)           score += 10;
  if (input.clientApproval)        score += 10; else blockers.push("Client approval pending");
  if (input.otherTradesCoordinated) score += 5;
  if (input.designApproved)        score += 5;

  score = Math.min(100, Math.round(score));

  const level: ReadinessLevel =
    score >= 90 ? "contract_ready" :
    score >= 65 ? "ready" :
    score >= 35 ? "preliminary" : "not_ready";

  return { score, level, blockers };
}

// ─── Price Bands ──────────────────────────────────────────────────────────────

export function computePriceBands(
  baseMid: number,
  lowMultiplier = 0.75,
  highMultiplier = 1.40,
  notes?: { low?: string; mid?: string; high?: string }
): PriceBands {
  return {
    low:  Math.round(baseMid * lowMultiplier),
    mid:  Math.round(baseMid),
    high: Math.round(baseMid * highMultiplier),
    currency: "USD",
    notes: {
      low:  notes?.low  ?? "Best case: no hidden damage, standard conditions, client provides some materials.",
      mid:  notes?.mid  ?? "Expected: normal conditions, standard materials, no major surprises.",
      high: notes?.high ?? "Worst case: hidden damage, complex conditions, premium materials, change orders.",
    },
  };
}

// ─── Production Schedule ──────────────────────────────────────────────────────

export function buildProductionSchedule(phases: ProductionPhase[]): ProductionSchedule {
  const totalMin = phases.reduce((s, p) => s + p.daysMin, 0);
  const totalMax = phases.reduce((s, p) => s + p.daysMax, 0);
  const crewMax  = Math.max(...phases.map(p => p.crew), 1);

  return { totalDaysMin: totalMin, totalDaysMax: totalMax, crewSizeRecommended: crewMax, phases };
}

// ─── Warranty ─────────────────────────────────────────────────────────────────

export function buildWarranty(laborDays: number, scope: string, exclusions: string[]): WarrantyTerms {
  return {
    laborDays,
    scope,
    exclusions: [
      ...exclusions,
      "Pre-existing damage or defects",
      "Client-provided materials",
      "Modifications made by third parties after completion",
      "Normal wear and tear",
      "Acts of God, flooding, or structural movement",
    ],
  };
}

// ─── Scope ────────────────────────────────────────────────────────────────────

export function buildScope(
  included: string[],
  excluded: string[],
  assumptions?: string[],
  changeOrderTriggers?: string[]
): ScopeOutput {
  return {
    included,
    excluded,
    assumptions: assumptions ?? [],
    changeOrderTriggers: changeOrderTriggers ?? [],
  };
}

// ─── Client / Professional explanation ────────────────────────────────────────

export function buildExplainedOutput(
  clientSummary: string,
  professionalNotes: string[]
): ExplainedOutput {
  return { clientSummary, professionalNotes };
}

// ─── ROI Estimate (for renovation tools) ──────────────────────────────────────

export type RoiEstimate = {
  investmentAmount: number;
  estimatedValueAdded: number;
  roiPercent: number;
  paybackPeriodMonths?: number;
  notes: string;
};

export function computeRenovationRoi(
  investmentAmount: number,
  valueMultiplier: number, // typical ROI multiplier for the trade
  notes: string,
  paybackMonths?: number
): RoiEstimate {
  const valueAdded = Math.round(investmentAmount * valueMultiplier);
  const roiPercent = Math.round(((valueAdded - investmentAmount) / investmentAmount) * 100);
  return { investmentAmount, estimatedValueAdded: valueAdded, roiPercent, paybackPeriodMonths: paybackMonths, notes };
}

// ─── Enhanced Risk — Hidden Damage Probability ────────────────────────────────

export type HiddenDamageAssessment = {
  probability: "low" | "medium" | "high";
  score: number; // 0-100
  drivers: string[];
  recommendation: string;
};

export function assessHiddenDamageProbability(
  propertyAge?: number,
  hasMoisture?: boolean,
  hasVisibleDamage?: boolean,
  hasPreviousRepairs?: boolean,
  isExteriorWork?: boolean,
  hasOdorOrMold?: boolean
): HiddenDamageAssessment {
  let score = 5;
  const drivers: string[] = [];

  if (propertyAge && propertyAge > 30)   { score += 15; drivers.push(`Property is ${propertyAge} years old`); }
  if (propertyAge && propertyAge > 50)   { score += 15; drivers.push("Older construction — pipes and framing at higher risk"); }
  if (hasMoisture)      { score += 25; drivers.push("Moisture detected"); }
  if (hasVisibleDamage) { score += 20; drivers.push("Visible damage present"); }
  if (hasPreviousRepairs) { score += 10; drivers.push("Previous repairs may indicate recurring issues"); }
  if (isExteriorWork)   { score += 10; drivers.push("Exterior work exposes sheathing and substrate"); }
  if (hasOdorOrMold)    { score += 25; drivers.push("Odor or mold suspected"); }

  score = Math.min(100, score);

  const probability: HiddenDamageAssessment["probability"] =
    score >= 60 ? "high" : score >= 30 ? "medium" : "low";

  const recommendation =
    probability === "high"
      ? "Require exploratory inspection or photos before giving fixed price. Add hidden damage allowance to contract."
      : probability === "medium"
      ? "Include hidden damage allowance in contract. Require photos before closing walls or covering substrate."
      : "Standard scope acceptable. Document pre-existing conditions with photos before starting.";

  return { probability, score, drivers, recommendation };
}

// ─── Schedule Risk ────────────────────────────────────────────────────────────

export type ScheduleRisk = {
  delayProbability: "low" | "medium" | "high";
  bufferDaysRecommended: number;
  delayFactors: string[];
};

export function assessScheduleRisk(params: {
  dependsOnOtherTrades: boolean;
  clientMustDecide: boolean;
  materialsOnSite: boolean;
  weatherDependent: boolean;
  scopeIsLarge: boolean;
  hasComplexDetails: boolean;
}): ScheduleRisk {
  let score = 0;
  const factors: string[] = [];

  if (params.dependsOnOtherTrades)  { score += 3; factors.push("Depends on other trades (plumber, electrician, countertop)"); }
  if (params.clientMustDecide)      { score += 2; factors.push("Client has pending decisions (material, color, design)"); }
  if (!params.materialsOnSite)      { score += 2; factors.push("Materials not on site yet — lead time risk"); }
  if (params.weatherDependent)      { score += 2; factors.push("Exterior work subject to weather delays"); }
  if (params.scopeIsLarge)          { score += 2; factors.push("Large scope increases coordination complexity"); }
  if (params.hasComplexDetails)     { score += 2; factors.push("Complex details require more precision time"); }

  const delayProb: ScheduleRisk["delayProbability"] =
    score >= 8 ? "high" : score >= 4 ? "medium" : "low";

  const bufferDays = score >= 8 ? 5 : score >= 4 ? 3 : 1;

  return { delayProbability: delayProb, bufferDaysRecommended: bufferDays, delayFactors: factors };
}

// ─── Algorithm Versioning ─────────────────────────────────────────────────────

export const ALGORITHM_VERSIONS = {
  shared:        "shared-v1.1.0",
  painting:      "painting-v1.1.0",
  drywall:       "drywall-v1.1.0",
  bathroom:      "bathroom-v1.0.0",
  kitchen:       "kitchen-v1.0.0",
  cleaning:      "cleaning-v1.0.0",
  siding:        "siding-v1.0.0",
  demolition:    "demolition-v2.0.0",
  carpentry:     "carpentry-v2.0.0",
  flooring:      "flooring-v2.0.0",
  roofing:       "roofing-v2.0.0",
  plumbing:      "plumbing-v2.0.0",
  hvac:          "hvac-v2.0.0",
  tile:          "tile-v2.0.0",
  masonry:       "masonry-v2.0.0",
  insulation:    "insulation-v2.0.0",
  solar:         "solar-v2.0.0",
  deck:          "deck-v2.0.0",
  fencing:       "fencing-v2.0.0",
  landscaping:   "landscaping-v2.0.0",
  windows_doors: "windows-doors-v2.0.0",
} as const;

// ─── Task Matrix (for cleaning, demolition, etc.) ─────────────────────────────

export type TaskMatrixItem = {
  task: string;
  phase: "before" | "during" | "after";
  required: boolean;
  evidenceRequired: boolean;
  notes?: string;
};

export type TaskMatrix = {
  tasks: TaskMatrixItem[];
  estimatedMinutes: number;
  complexity: "basic" | "standard" | "detailed" | "specialized";
};

export function buildTaskMatrix(
  tasks: TaskMatrixItem[],
  estimatedMinutes: number,
  complexity: TaskMatrix["complexity"] = "standard"
): TaskMatrix {
  return { tasks, estimatedMinutes, complexity };
}

// ─── Recurring Pricing ────────────────────────────────────────────────────────

export type RecurringPricingOption = {
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly";
  label: string;
  pricePerVisit: number;
  discountPercent: number;
  monthlyValue: number;
  annualValue: number;
  notes: string;
};

export type RecurringPricing = {
  oneTimePrice: number;
  options: RecurringPricingOption[];
  recommendedFrequency?: string;
  savingsNote: string;
};

export function buildRecurringPricing(
  oneTimePrice: number,
  multipliers?: { weekly?: number; biweekly?: number; monthly?: number; quarterly?: number }
): RecurringPricing {
  const weeklyDiscount    = multipliers?.weekly    ?? 0.20;
  const biweeklyDiscount  = multipliers?.biweekly  ?? 0.15;
  const monthlyDiscount   = multipliers?.monthly   ?? 0.10;
  const quarterlyDiscount = multipliers?.quarterly ?? 0.05;

  const weeklyPrice    = Math.round(oneTimePrice * (1 - weeklyDiscount));
  const biweeklyPrice  = Math.round(oneTimePrice * (1 - biweeklyDiscount));
  const monthlyPrice   = Math.round(oneTimePrice * (1 - monthlyDiscount));
  const quarterlyPrice = Math.round(oneTimePrice * (1 - quarterlyDiscount));

  return {
    oneTimePrice,
    options: [
      {
        frequency: "weekly",
        label: "Weekly service",
        pricePerVisit: weeklyPrice,
        discountPercent: Math.round(weeklyDiscount * 100),
        monthlyValue: weeklyPrice * 4,
        annualValue: weeklyPrice * 52,
        notes: "Best value for high-traffic properties",
      },
      {
        frequency: "biweekly",
        label: "Bi-weekly service",
        pricePerVisit: biweeklyPrice,
        discountPercent: Math.round(biweeklyDiscount * 100),
        monthlyValue: biweeklyPrice * 2,
        annualValue: biweeklyPrice * 26,
        notes: "Most popular frequency",
      },
      {
        frequency: "monthly",
        label: "Monthly service",
        pricePerVisit: monthlyPrice,
        discountPercent: Math.round(monthlyDiscount * 100),
        monthlyValue: monthlyPrice,
        annualValue: monthlyPrice * 12,
        notes: "Good for lightly used spaces",
      },
      {
        frequency: "quarterly",
        label: "Quarterly service",
        pricePerVisit: quarterlyPrice,
        discountPercent: Math.round(quarterlyDiscount * 100),
        monthlyValue: Math.round(quarterlyPrice / 3),
        annualValue: quarterlyPrice * 4,
        notes: "Seasonal deep clean",
      },
    ],
    recommendedFrequency: "biweekly",
    savingsNote: `Save up to ${Math.round(weeklyDiscount * 100)}% vs one-time pricing with regular service.`,
  };
}

// ─── Safe To Proceed Gates ────────────────────────────────────────────────────

export type SafeToProceed = {
  canEstimate:             boolean;
  canPublish:              boolean;
  canCreateBuildOpsPlan:   boolean;
  canCreateContract:       boolean;
  canRequestPayment:       boolean;
  reasons:                 string[];
};

export type SafeToProceedInput = {
  hasMinimalData:          boolean;
  readinessScore:          number;
  hasCriticalBlockers:     boolean;
  hasMilestones:           boolean;
  hasEvidencePlan:         boolean;
  confidenceScore:         number;
  noCriticalBlockers:      boolean;
  scopeIsComplete:         boolean;
};

export function computeSafeToProceed(input: SafeToProceedInput): SafeToProceed {
  const reasons: string[] = [];

  const canEstimate = input.hasMinimalData;
  if (!canEstimate) reasons.push("Insufficient information to estimate");

  const canPublish = canEstimate && input.readinessScore >= 40 && !input.hasCriticalBlockers;
  if (!canPublish && canEstimate) {
    if (input.readinessScore < 40) reasons.push(`Readiness score too low (${input.readinessScore}/100 — need 40+)`);
    if (input.hasCriticalBlockers) reasons.push("Critical blockers must be resolved before publishing");
  }

  const canCreateBuildOpsPlan = canPublish && input.hasMilestones && input.hasEvidencePlan;
  if (!canCreateBuildOpsPlan && canPublish) {
    if (!input.hasMilestones) reasons.push("Milestone plan required for BuildOps");
    if (!input.hasEvidencePlan) reasons.push("Evidence plan required for BuildOps");
  }

  const canCreateContract = canCreateBuildOpsPlan && input.confidenceScore >= 65 && input.scopeIsComplete;
  if (!canCreateContract && canCreateBuildOpsPlan) {
    if (input.confidenceScore < 65) reasons.push(`Estimate confidence too low (${input.confidenceScore}/100 — need 65+)`);
    if (!input.scopeIsComplete) reasons.push("Scope must be confirmed before contract");
  }

  const canRequestPayment = false; // Controlled by BuildOps milestone flow, not the tool
  if (reasons.length === 0) reasons.push("Ready to proceed");

  return { canEstimate, canPublish, canCreateBuildOpsPlan, canCreateContract, canRequestPayment, reasons };
}

// ─── Smart Questions (ranked by impact) ──────────────────────────────────────

export type SmartQuestion = {
  id:       string;
  question: string;
  field:    string;
  impact:   "price" | "risk" | "schedule" | "evidence" | "payment";
  priority: number; // 1 = highest
  options?: string[];
  why:      string;
};

export function rankSmartQuestions(questions: SmartQuestion[]): SmartQuestion[] {
  return [...questions].sort((a, b) => a.priority - b.priority);
}

// ─── Inspection Gate ──────────────────────────────────────────────────────────

export type InspectionGate = {
  required:       boolean;
  trigger:        string;
  description:    string;
  evidenceRequired: string[];
  clientMustApprove: boolean;
  blocksPaymentRelease: boolean;
  changeOrderTrigger: string;
};

export function buildInspectionGate(
  trigger: string,
  evidenceRequired: string[],
  changeOrderTrigger: string,
  description?: string
): InspectionGate {
  return {
    required: true,
    trigger,
    description: description ?? `Inspection required: ${trigger}`,
    evidenceRequired,
    clientMustApprove: true,
    blocksPaymentRelease: true,
    changeOrderTrigger,
  };
}

// ─── Algorithm Trace ──────────────────────────────────────────────────────────

export type AlgorithmTraceRule = {
  ruleId:       string;
  label:        string;
  triggered:    boolean;
  points?:      number;
  priceImpact?: number;
  reason:       string;
};

export type AlgorithmTrace = {
  algorithmVersion: string;
  trade:            string;
  inputUsed:        string[];
  missingInputs:    string[];
  assumptions:      string[];
  rulesTriggered:   AlgorithmTraceRule[];
};

export function buildAlgorithmTrace(
  algorithmVersion: string,
  trade: string,
  inputUsed: string[],
  missingInputs: string[],
  assumptions: string[],
  rules: AlgorithmTraceRule[]
): AlgorithmTrace {
  return {
    algorithmVersion,
    trade,
    inputUsed,
    missingInputs,
    assumptions,
    rulesTriggered: rules.filter(r => r.triggered),
  };
}
