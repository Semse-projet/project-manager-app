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
