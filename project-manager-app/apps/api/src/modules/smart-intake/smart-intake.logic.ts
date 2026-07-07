import { randomUUID } from "node:crypto";
import { PAINTING_QUESTIONS } from "./config/questions/painting.questions.js";
import { PAINTING_WEIGHTS, type ScoringWeight } from "./config/scoring-weights.js";
import { WARNING_RULES } from "./config/warning-rules.js";
import {
  CATEGORY_REGISTRY,
  detectCategoryFromText,
  getCategoryConfidence,
} from "./config/category-registry.js";
import { getScoringProfile, type CategoryScoringProfile } from "./config/scoring-profiles.js";
import type {
  AccuracyLevel,
  BilingualString,
  EstimatePreference,
  IntakeAnswer,
  IntakeQuestion,
  IntakeWarning,
  LiveSummary,
  PaintingScope,
  ProjectEstimate,
  ProjectIntakeRecord,
  ProjectMilestone,
  SmartIntakeCategory,
} from "./smart-intake.types.js";

type FieldResolution = {
  present: boolean;
  isApproximate: boolean;
  isNotSure: boolean;
};

const AREA_OPTION_RANGES: Record<string, { min: number; max: number; midpoint: number; range: string }> = {
  under_100_sqft: { min: 60, max: 100, midpoint: 80, range: "60-100 sqft" },
  "100_250_sqft": { min: 100, max: 250, midpoint: 175, range: "100-250 sqft" },
  "250_500_sqft": { min: 250, max: 500, midpoint: 375, range: "250-500 sqft" },
  "500_750_sqft": { min: 500, max: 750, midpoint: 625, range: "500-750 sqft" },
  over_750_sqft: { min: 750, max: 1000, midpoint: 875, range: "750-1000 sqft" },
};

const PAINTING_RATES = {
  laborPerSqft: { min: 0.75, max: 1.5 },
  materialsPerSqft: { min: 0.3, max: 0.65 },
  prepPerSqft: { min: 0.1, max: 0.25 },
  contingencyPercent: { low: 0.05, medium: 0.1, high: 0.2 },
  conditionMultiplier: {
    good: 1,
    minor_repairs: 1.15,
    extensive_prep: 1.4,
    peeling_paint: 1.3,
    mold_or_moisture: 1.6,
    not_sure: 1.2,
    other: 1.2,
  },
  coatMultiplier: {
    1: 0.85,
    2: 1,
    3: 1.3,
    4: 1.45,
  },
  areaFallback: { min: 150, max: 400 },
} as const;

const PAINTING_MILESTONE_TEMPLATE: Array<Omit<ProjectMilestone, "id" | "intakeId" | "status" | "dependencies"> & { sourceOrder: number }> = [
  {
    sourceOrder: 1,
    order: 1,
    title: { es: "Confirmacion del alcance", en: "Scope confirmation" },
    description: {
      es: "Cliente y profesional acuerdan area, materiales y condiciones.",
      en: "Client and professional confirm area, materials, and condition.",
    },
    estimatedDurationHours: 1,
    paymentPercentage: 0,
    requiresEvidence: false,
  },
  {
    sourceOrder: 2,
    order: 2,
    title: { es: "Preparacion del area", en: "Area preparation" },
    description: {
      es: "Proteger muebles, cubrir pisos y preparar superficies.",
      en: "Protect furniture, cover floors, and prep surfaces.",
    },
    estimatedDurationHours: 2,
    paymentPercentage: 20,
    requiresEvidence: true,
  },
  {
    sourceOrder: 3,
    order: 3,
    title: { es: "Reparacion de superficie", en: "Surface repair" },
    description: {
      es: "Rellenar grietas, lijar y aplicar tratamiento cuando haga falta.",
      en: "Fill cracks, sand, and apply treatment when needed.",
    },
    estimatedDurationHours: 3,
    paymentPercentage: 20,
    requiresEvidence: true,
  },
  {
    sourceOrder: 4,
    order: 4,
    title: { es: "Aplicacion de primer", en: "Primer application" },
    estimatedDurationHours: 2,
    paymentPercentage: 10,
    requiresEvidence: false,
  },
  {
    sourceOrder: 5,
    order: 5,
    title: { es: "Aplicacion de pintura", en: "Paint application" },
    description: {
      es: "Aplicar las capas acordadas.",
      en: "Apply the agreed coats.",
    },
    estimatedDurationHours: 4,
    paymentPercentage: 30,
    requiresEvidence: true,
  },
  {
    sourceOrder: 6,
    order: 6,
    title: { es: "Secado y revision", en: "Drying and inspection" },
    estimatedDurationHours: 24,
    paymentPercentage: 10,
    requiresEvidence: false,
  },
  {
    sourceOrder: 7,
    order: 7,
    title: { es: "Limpieza final y cierre", en: "Final cleanup and close" },
    description: {
      es: "Retirar protecciones, limpiar area y tomar fotos finales.",
      en: "Remove coverings, clean the area, and take final photos.",
    },
    estimatedDurationHours: 1,
    paymentPercentage: 10,
    requiresEvidence: true,
  },
];

function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function truncateWords(input: string, maxWords: number): string {
  return input.split(/\s+/).filter(Boolean).slice(0, maxWords).join(" ");
}

function findAnswer(answers: IntakeAnswer[], questionId: string): IntakeAnswer | undefined {
  return answers.find((answer) => answer.questionId === questionId);
}

function parseCustomArea(text?: string): number | undefined {
  if (!text) return undefined;
  const matches = text.match(/\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return undefined;
  const values = matches.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) return undefined;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function mapEstimatePreference(answer?: IntakeAnswer): EstimatePreference {
  const value = answer?.selectedValues[0];
  switch (value) {
    case "labor_only":
      return { includeMaterials: false, includeLabor: true, pricingMode: "not_sure" };
    case "materials_only":
      return { includeMaterials: true, includeLabor: false, pricingMode: "not_sure" };
    case "both":
      return { includeMaterials: true, includeLabor: true, pricingMode: "not_sure" };
    case "full_service":
      return { includeMaterials: true, includeLabor: true, pricingMode: "not_sure", cleanupRequested: true };
    default:
      return { includeMaterials: true, includeLabor: true, pricingMode: "not_sure" };
  }
}

export function derivePaintingScope(answers: IntakeAnswer[]): {
  projectScope: PaintingScope;
  estimatePreference: EstimatePreference;
} {
  const areaAnswer = findAnswer(answers, "painting_area");
  const conditionAnswer = findAnswer(answers, "painting_condition");
  const coatsAnswer = findAnswer(answers, "painting_coats");
  const estimateAnswer = findAnswer(answers, "painting_estimate_preference");
  const pricingAnswer = findAnswer(answers, "painting_pricing_mode");
  const durationAnswer = findAnswer(answers, "painting_duration");

  const areaValue = areaAnswer?.selectedValues[0] ? AREA_OPTION_RANGES[areaAnswer.selectedValues[0]] : undefined;
  const customAreaValue = parseCustomArea(areaAnswer?.customText);
  const customAreaRange = areaAnswer?.customText && !customAreaValue ? areaAnswer.customText : undefined;

  const estimatePreference = mapEstimatePreference(estimateAnswer);
  if (pricingAnswer?.selectedValues[0] === "per_area" || pricingAnswer?.selectedValues[0] === "hourly" || pricingAnswer?.selectedValues[0] === "fixed") {
    estimatePreference.pricingMode = pricingAnswer.selectedValues[0];
  } else if (pricingAnswer?.isNotSure) {
    estimatePreference.pricingMode = "not_sure";
  } else if (pricingAnswer?.selectedValues.includes("other")) {
    estimatePreference.pricingMode = "other";
    estimatePreference.customPricingText = pricingAnswer.customText?.trim() || undefined;
  }

  const coatsRaw = coatsAnswer?.selectedValues[0];
  const coatsValue = coatsRaw === "4_plus" ? 4 : coatsRaw ? Number(coatsRaw) : undefined;

  return {
    projectScope: {
      area: areaAnswer
        ? {
            value: customAreaValue ?? areaValue?.midpoint,
            unit: "sqft",
            range: customAreaRange ?? areaValue?.range,
            confidence: areaAnswer.isNotSure
              ? "unknown"
              : customAreaValue
              ? "exact"
              : areaValue
              ? "estimated"
              : "unknown",
            customText: areaAnswer.customText?.trim() || undefined,
          }
        : undefined,
      condition: conditionAnswer
        ? {
            value: (conditionAnswer.selectedValues[0] as NonNullable<PaintingScope["condition"]>["value"]) ?? "not_sure",
            customText: conditionAnswer.customText?.trim() || undefined,
          }
        : undefined,
      paintCoats: coatsAnswer
        ? {
            value: coatsValue,
            notSure: coatsAnswer.isNotSure,
            customText: coatsAnswer.customText?.trim() || undefined,
          }
        : undefined,
      durationPreference: durationAnswer
        ? {
            value: durationAnswer.isNotSure
              ? "not_sure"
              : ((durationAnswer.selectedValues[0] as NonNullable<PaintingScope["durationPreference"]>["value"]) ?? "not_sure"),
            customText: durationAnswer.customText?.trim() || undefined,
          }
        : undefined,
    },
    estimatePreference,
  };
}

function descriptionLooksSpanish(rawDescription: string): boolean {
  const lower = rawDescription.toLowerCase();
  return [" pared", " pintura", " quiero", " necesito", " humedad", " moho "].some((token) => lower.includes(token.trim()));
}

export function detectLanguage(rawDescription: string): "es" | "en" {
  return descriptionLooksSpanish(rawDescription) ? "es" : "en";
}

export function isPaintingCategory(input: {
  selectedCategoryId?: string | null;
  selectedSubcategoryId?: string | null;
  rawDescription: string;
}): boolean {
  const detected = detectCategoryFromText(input);
  return detected === "interior_painting" || detected === "exterior_painting";
}

export function detectCategoryConfidence(input: {
  selectedCategoryId?: string | null;
  selectedSubcategoryId?: string | null;
  rawDescription: string;
}): number {
  const detected = detectCategoryFromText(input);
  return getCategoryConfidence({ ...input, detectedCategory: detected });
}

export function buildNormalizedTitle(input: {
  providedTitle?: string | null;
  rawDescription: string;
  detectedCategory?: SmartIntakeCategory | null;
}): string {
  const titleSource = input.providedTitle?.trim() || truncateWords(input.rawDescription, 8);
  if (titleSource) return titleCase(titleSource);
  const def = input.detectedCategory ? CATEGORY_REGISTRY[input.detectedCategory] : null;
  return def?.label.en ?? "Home Improvement Project";
}

function evaluateShowWhen(
  condition: IntakeQuestion["showWhen"] | undefined,
  intake: ProjectIntakeRecord,
): boolean {
  if (!condition) return true;
  const fieldValue = getFieldValue(intake, condition.field);

  switch (condition.operator) {
    case "equals":
      return fieldValue === condition.value;
    case "includes":
      return Array.isArray(fieldValue) && fieldValue.includes(condition.value);
    case "exists":
      return fieldValue !== undefined && fieldValue !== null;
    case "not_exists":
      return fieldValue === undefined || fieldValue === null;
    default:
      return true;
  }
}

export function getNextQuestion(intake: ProjectIntakeRecord): IntakeQuestion | null {
  const answered = new Set(intake.answers.map((answer) => answer.questionId));
  const questions = getSupportedQuestions(intake.detectedCategory);

  return (
    questions
      .filter((question) => !answered.has(question.id))
      .filter((question) => evaluateShowWhen(question.showWhen, intake))
      .sort((left, right) => left.step - right.step)[0] ?? null
  );
}

function getFieldValue(intake: ProjectIntakeRecord, fieldId: string): unknown {
  switch (fieldId) {
    case "rawDescription":
      return intake.rawDescription.trim();
    case "area":
      return intake.projectScope.area;
    case "condition":
      return intake.projectScope.condition;
    case "paintCoats":
      return intake.projectScope.paintCoats;
    case "estimatePreference":
      return intake.estimatePreference;
    case "pricingMode":
      return intake.estimatePreference.pricingMode;
    case "durationPreference":
      return intake.projectScope.durationPreference;
    case "uploadedImages":
      return intake.uploadedImages;
    default:
      return undefined;
  }
}

function resolveFieldStatus(intake: ProjectIntakeRecord, weight: ScoringWeight): FieldResolution {
  if (weight.fieldId === "rawDescription") {
    const present = intake.rawDescription.trim().length >= 10;
    return { present, isApproximate: false, isNotSure: false };
  }

  if (weight.fieldId === "uploadedImages") {
    const present = intake.uploadedImages.length > 0;
    return { present, isApproximate: false, isNotSure: false };
  }

  if (weight.fieldId === "estimatePreference") {
    const answer = findAnswer(intake.answers, "painting_estimate_preference");
    const hasOtherWithoutText = answer?.selectedValues.includes("other") && !answer.customText?.trim();
    return {
      present: Boolean(answer) && !hasOtherWithoutText,
      isApproximate: false,
      isNotSure: Boolean(answer?.isNotSure),
    };
  }

  if (weight.fieldId === "pricingMode") {
    const answer = findAnswer(intake.answers, "painting_pricing_mode");
    const hasOtherWithoutText = answer?.selectedValues.includes("other") && !answer.customText?.trim();
    return {
      present: Boolean(answer) && !hasOtherWithoutText,
      isApproximate: false,
      isNotSure: Boolean(answer?.isNotSure),
    };
  }

  if (weight.fieldId === "durationPreference") {
    const answer = findAnswer(intake.answers, "painting_duration");
    const hasOtherWithoutText = answer?.selectedValues.includes("other") && !answer.customText?.trim();
    return {
      present: Boolean(answer) && !hasOtherWithoutText,
      isApproximate: false,
      isNotSure: Boolean(answer?.isNotSure),
    };
  }

  if (weight.fieldId === "area") {
    const answer = findAnswer(intake.answers, "painting_area");
    const area = intake.projectScope.area;
    return {
      present: Boolean(answer?.isNotSure || (area && (area.value || area.range || area.customText))),
      isApproximate: Boolean(area?.range && !area?.value),
      isNotSure: Boolean(answer?.isNotSure),
    };
  }

  if (weight.fieldId === "condition") {
    const answer = findAnswer(intake.answers, "painting_condition");
    return {
      present: Boolean(intake.projectScope.condition?.value),
      isApproximate: false,
      isNotSure: Boolean(answer?.isNotSure),
    };
  }

  if (weight.fieldId === "paintCoats") {
    const answer = findAnswer(intake.answers, "painting_coats");
    return {
      present: Boolean(answer?.isNotSure || intake.projectScope.paintCoats?.value || intake.projectScope.paintCoats?.customText),
      isApproximate: false,
      isNotSure: Boolean(answer?.isNotSure),
    };
  }

  return { present: false, isApproximate: false, isNotSure: false };
}

// ── multi-category scoring engine ─────────────────────────────────────────────

function scoreGenericProfile(intake: ProjectIntakeRecord, profile: CategoryScoringProfile): number {
  let score = 0;
  if (intake.rawDescription.trim().length >= 10) score += profile.rawDescriptionScore;
  if (intake.uploadedImages.length > 0) score += profile.imagesScore;
  for (const weight of profile.weights) {
    const answer = findAnswer(intake.answers, weight.questionId);
    if (!answer) continue;
    score += answer.isNotSure ? weight.notSure : weight.exact;
  }
  return Math.min(100, Math.round(score));
}

function resolveGenericMissingFields(
  intake: ProjectIntakeRecord,
  profile: CategoryScoringProfile,
  filterFn: (w: CategoryScoringProfile["weights"][number]) => boolean,
): string[] {
  const missing: string[] = [];
  for (const weight of profile.weights) {
    if (!filterFn(weight)) continue;
    const answer = findAnswer(intake.answers, weight.questionId);
    if (!answer || (answer.selectedValues.length === 0 && !answer.isNotSure)) {
      missing.push(weight.questionId);
    }
  }
  if (intake.uploadedImages.length === 0) missing.push("uploadedImages");
  return missing;
}

function resolveGenericRiskFlags(intake: ProjectIntakeRecord, profile: CategoryScoringProfile): string[] {
  const flags: string[] = [];
  if (!profile.riskTriggers) return flags;
  for (const trigger of profile.riskTriggers) {
    const answer = findAnswer(intake.answers, trigger.questionId);
    if (answer?.selectedValues.includes(trigger.value)) {
      flags.push(trigger.flag);
    }
  }
  return flags;
}

// ── public API ────────────────────────────────────────────────────────────────

export type AccuracyDetail = {
  score: number;
  estimateReady: boolean;
  confidence: "low" | "medium" | "high";
  category: string;
  missingCriticalFields: string[];
  missingRecommendedFields: string[];
  riskFlags: string[];
};

export function calculateAccuracyScore(intake: ProjectIntakeRecord): number {
  if (intake.detectedCategory === "interior_painting" || intake.detectedCategory === "exterior_painting") {
    // Interior painting: detailed field-based scoring (area from scope, condition from scope)
    if (intake.detectedCategory === "interior_painting") {
      let score = 0;
      for (const weight of PAINTING_WEIGHTS) {
        const resolution = resolveFieldStatus(intake, weight);
        if (!resolution.present) continue;
        if (resolution.isNotSure) { score += weight.notSureAnswer ?? 0; continue; }
        if (resolution.isApproximate) { score += weight.approximateMatch ?? weight.exactMatch; continue; }
        score += weight.exactMatch;
      }
      return Math.min(Math.round(score), 100);
    }
    // Exterior painting: use the scoring profile
    return scoreGenericProfile(intake, getScoringProfile("exterior_painting"));
  }
  const profile = getScoringProfile(intake.detectedCategory);
  return scoreGenericProfile(intake, profile);
}

export function getAccuracyDetail(intake: ProjectIntakeRecord): AccuracyDetail {
  const score = calculateAccuracyScore(intake);
  const category = intake.detectedCategory;

  if (category === "interior_painting") {
    const missing = getMissingFields(intake);
    const recommended = getRecommendedFields(intake);
    return {
      score,
      estimateReady: score >= 36,
      confidence: score >= 70 ? "high" : score >= 36 ? "medium" : "low",
      category,
      missingCriticalFields: missing.filter(f => !["pricingMode", "durationPreference", "uploadedImages"].includes(f)),
      missingRecommendedFields: recommended,
      riskFlags: [],
    };
  }

  const profile = getScoringProfile(category);
  const criticalMissing = resolveGenericMissingFields(intake, profile, w => w.critical);
  const recommendedMissing = resolveGenericMissingFields(intake, profile, w => w.recommended && !w.critical);
  const riskFlags = resolveGenericRiskFlags(intake, profile);

  return {
    score,
    estimateReady: score >= profile.estimateReadyThreshold,
    confidence: score >= 70 ? "high" : score >= profile.estimateReadyThreshold ? "medium" : "low",
    category,
    missingCriticalFields: criticalMissing,
    missingRecommendedFields: recommendedMissing,
    riskFlags,
  };
}

export function getAccuracyLevel(score: number): AccuracyLevel {
  if (score <= 35) return "low";
  if (score <= 65) return "medium";
  if (score <= 85) return "good";
  return "high";
}

export function getMissingFields(intake: ProjectIntakeRecord): string[] {
  if (intake.detectedCategory === "interior_painting") {
    const missing: string[] = [];
    if (!intake.projectScope.area || (!intake.projectScope.area.value && !intake.projectScope.area.range && !intake.projectScope.area.customText)) {
      missing.push("area");
    }
    if (!intake.projectScope.condition?.value) {
      missing.push("condition");
    }
    if (!findAnswer(intake.answers, "painting_estimate_preference")) missing.push("estimatePreference");
    if (!findAnswer(intake.answers, "painting_pricing_mode")) missing.push("pricingMode");
    if (!findAnswer(intake.answers, "painting_duration")) missing.push("durationPreference");
    if (intake.uploadedImages.length === 0) missing.push("uploadedImages");
    return missing;
  }
  const profile = getScoringProfile(intake.detectedCategory);
  return resolveGenericMissingFields(intake, profile, () => true);
}

export function getRecommendedFields(intake: ProjectIntakeRecord): string[] {
  if (intake.detectedCategory === "interior_painting") {
    return getMissingFields(intake).filter(f => ["pricingMode", "durationPreference", "uploadedImages"].includes(f));
  }
  const profile = getScoringProfile(intake.detectedCategory);
  return resolveGenericMissingFields(intake, profile, w => w.recommended);
}

function warningById(warningId: string): IntakeWarning | undefined {
  return WARNING_RULES.find((warning) => warning.id === warningId);
}

function hasKeyword(rawDescription: string, keywords: string[]): boolean {
  const lower = rawDescription.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

export function generateWarnings(intake: ProjectIntakeRecord): IntakeWarning[] {
  const warnings = new Map<string, IntakeWarning>();

  const condition = intake.projectScope.condition?.value;
  const estimatePreferenceAnswer = findAnswer(intake.answers, "painting_estimate_preference");
  const pricingModeAnswer = findAnswer(intake.answers, "painting_pricing_mode");
  const areaAnswer = findAnswer(intake.answers, "painting_area");

  if (condition === "mold_or_moisture") {
    const warning = warningById("warning_mold_present");
    if (warning) warnings.set(warning.id, warning);
  }
  if (areaAnswer?.isNotSure) {
    const warning = warningById("warning_area_unknown");
    if (warning) warnings.set(warning.id, warning);
  }
  if (estimatePreferenceAnswer?.selectedValues[0] === "labor_only") {
    const warning = warningById("warning_labor_only_materials");
    if (warning) warnings.set(warning.id, warning);
  }
  if (pricingModeAnswer?.selectedValues[0] === "hourly") {
    const warning = warningById("warning_hourly_pricing");
    if (warning) warnings.set(warning.id, warning);
  }
  if (hasKeyword(intake.rawDescription, ["spark", "breaker", "electrical", "wiring", "short circuit"])) {
    const warning = warningById("warning_electrical_hazard");
    if (warning) warnings.set(warning.id, warning);
  }

  return [...warnings.values()];
}

export function generateTips(intake: ProjectIntakeRecord): BilingualString[] {
  const tips: BilingualString[] = [];
  const missing = intake.missingFields;

  if (intake.rawDescription.trim().split(/\s+/).length < 20) {
    tips.push({
      es: "Agrega un poco mas de contexto. Una descripcion corta abre demasiadas suposiciones.",
      en: "Add a bit more context. A short description leaves too many assumptions open.",
    });
  }

  if (missing.includes("area")) {
    tips.push({
      es: "Agrega el area aproximada o sube una foto. Es el dato con mayor impacto en el presupuesto.",
      en: "Add the approximate area or upload a photo. It has the biggest impact on the estimate.",
    });
  }

  if (missing.includes("condition")) {
    tips.push({
      es: "La condicion actual cambia mucho el trabajo de preparacion y el costo.",
      en: "The current condition heavily affects prep work and cost.",
    });
  }

  if (missing.includes("estimatePreference")) {
    tips.push({
      es: "Indica si quieres materiales, mano de obra o ambos para desbloquear un rango util.",
      en: "Specify materials, labor, or both to unlock a useful range.",
    });
  }

  if (missing.includes("uploadedImages")) {
    tips.push({
      es: "Subir fotos ayuda a cerrar el rango y evita suposiciones innecesarias.",
      en: "Uploading photos narrows the range and avoids unnecessary assumptions.",
    });
  }

  if (intake.projectScope.condition?.value === "mold_or_moisture") {
    tips.push({
      es: "Con moho o humedad presente, el tratamiento previo puede cambiar el alcance.",
      en: "With mold or moisture present, prior treatment can change the scope.",
    });
  }

  return tips.slice(0, 3);
}

function getContingencyRate(score: number): number {
  if (score >= 80) return PAINTING_RATES.contingencyPercent.low;
  if (score >= 50) return PAINTING_RATES.contingencyPercent.medium;
  return PAINTING_RATES.contingencyPercent.high;
}

function getEstimateConfidence(score: number): ProjectEstimate["confidence"] {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function parseAreaRange(text?: string): { min: number; max: number } | null {
  if (!text) return null;
  const matches = text.match(/\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  if (matches.length === 1) {
    const value = Number(matches[0]);
    return { min: Math.round(value * 0.9), max: Math.round(value * 1.1) };
  }
  const values = matches.map(Number).filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (values.length < 2) return null;
  return { min: values[0], max: values[values.length - 1] };
}

function resolveArea(area: PaintingScope["area"]): { min: number; max: number; assumed: boolean } {
  if (area?.value) {
    return { min: Math.round(area.value * 0.9), max: Math.round(area.value * 1.1), assumed: false };
  }
  const parsedRange = parseAreaRange(area?.range ?? area?.customText);
  if (parsedRange) {
    return { ...parsedRange, assumed: false };
  }
  return { ...PAINTING_RATES.areaFallback, assumed: true };
}

function buildIncludesList(preference: EstimatePreference): string[] {
  const includes: string[] = ["Basic surface preparation"];
  if (preference.includeLabor) includes.push("Labor for painting and setup");
  if (preference.includeMaterials) includes.push("Paint and standard consumables");
  if (preference.cleanupRequested) includes.push("Final cleanup");
  return includes;
}

function buildExcludesList(scope: PaintingScope): string[] {
  const excludes = ["Major drywall replacement", "Furniture moving beyond light protection"];
  if (scope.condition?.value === "mold_or_moisture") {
    excludes.push("Mold remediation beyond basic prep");
  }
  return excludes;
}

function buildAssumptionsList(scope: PaintingScope, area: { min: number; max: number; assumed: boolean }): string[] {
  const assumptions: string[] = [];
  if (area.assumed) {
    assumptions.push(`Area assumed ${area.min}-${area.max} sqft because it was not confirmed.`);
  }
  if (!scope.paintCoats?.value) {
    assumptions.push("Two coats assumed because the exact number of coats was not confirmed.");
  }
  if (!scope.condition?.value || scope.condition.value === "not_sure") {
    assumptions.push("Wall condition assumed to need moderate preparation.");
  }
  return assumptions;
}

function buildConfidenceReasons(intake: ProjectIntakeRecord): string[] {
  const reasons: string[] = [];
  if (!intake.projectScope.area?.value && !intake.projectScope.area?.range) {
    reasons.push("Area is still unconfirmed.");
  }
  if (intake.uploadedImages.length === 0) {
    reasons.push("No reference photos were uploaded.");
  }
  if (findAnswer(intake.answers, "painting_condition")?.isNotSure) {
    reasons.push("Wall condition was marked as not sure.");
  }
  if (reasons.length === 0) {
    reasons.push("Area, condition, and estimate preferences were provided.");
  }
  return reasons;
}

// ── generic multi-category estimator ─────────────────────────────────────────

function resolveFirstAnswer(answers: IntakeAnswer[], questionId: string): string | null {
  const a = answers.find(x => x.questionId === questionId);
  if (!a || a.isNotSure) return null;
  return a.selectedValues[0] ?? a.customText ?? null;
}

const HIGH_COMPLEXITY_SIGNALS = new Set([
  "full_remodel", "new_install", "replacement", "structural", "relocate", "scaffolding",
  "post_construction", "premium", "premium_appliances", "full_exterior", "moisture_mold",
  "structural_damage", "water_damage", "pest", "3_plus", "over_2000_sqft", "over_500_sqft",
  "extra_large", "significant",
]);

const LOW_COMPLEXITY_SIGNALS = new Set([
  "cosmetic", "repair_only", "patches", "good", "no_move", "fixtures_only",
  "no_appliances", "budget", "no", "minor", "standard", "one_time", "under_500",
  "under_500_sqft",
]);

function resolveComplexity(intake: ProjectIntakeRecord): "low" | "medium" | "high" {
  for (const answer of intake.answers) {
    for (const val of answer.selectedValues) {
      if (HIGH_COMPLEXITY_SIGNALS.has(val)) return "high";
    }
  }
  for (const answer of intake.answers) {
    for (const val of answer.selectedValues) {
      if (LOW_COMPLEXITY_SIGNALS.has(val)) return "low";
    }
  }
  return "medium";
}

function resolveAreaFromAnswers(intake: ProjectIntakeRecord): { min: number; max: number } {
  // Exterior painting area ranges
  const extArea = resolveFirstAnswer(intake.answers, "ext_painting_area");
  if (extArea) {
    const extRanges: Record<string, { min: number; max: number }> = {
      "under_500_sqft": { min: 200, max: 500 },
      "500_1000_sqft": { min: 500, max: 1000 },
      "1000_2000_sqft": { min: 1000, max: 2000 },
      "over_2000_sqft": { min: 2000, max: 3500 },
    };
    if (extRanges[extArea]) return extRanges[extArea];
  }

  // Drywall area ranges
  const drywallArea = resolveFirstAnswer(intake.answers, "drywall_area");
  if (drywallArea) {
    const drywallRanges: Record<string, { min: number; max: number }> = {
      "patches": { min: 2, max: 10 },
      "10_100_sqft": { min: 10, max: 100 },
      "100_500_sqft": { min: 100, max: 500 },
      "over_500_sqft": { min: 500, max: 900 },
    };
    if (drywallRanges[drywallArea]) return drywallRanges[drywallArea];
  }

  // Painting area (existing scope)
  return resolveArea(intake.projectScope.area);
}

function resolveHoursFromSize(intake: ProjectIntakeRecord): { min: number; max: number } {
  const size = resolveFirstAnswer(intake.answers, "cleaning_size");
  const typeVal = resolveFirstAnswer(intake.answers, "cleaning_type");
  const deepMultiplier = typeVal === "deep" || typeVal === "post_construction" ? 1.6 : 1.0;
  const sizeHours: Record<string, { min: number; max: number }> = {
    "under_500": { min: 2, max: 4 },
    "500_1000": { min: 3, max: 6 },
    "1000_2000": { min: 5, max: 10 },
    "over_2000": { min: 8, max: 16 },
  };
  const base = (size && sizeHours[size]) ? sizeHours[size] : { min: 4, max: 8 };
  return {
    min: Math.round(base.min * deepMultiplier),
    max: Math.round(base.max * deepMultiplier),
  };
}

function resolveSizeMultiplier(intake: ProjectIntakeRecord): number {
  switch (intake.detectedCategory) {
    case "bathroom_remodel": {
      const size = resolveFirstAnswer(intake.answers, "bathroom_size");
      return size === "small" ? 0.65 : size === "large" ? 1.4 : size === "extra_large" ? 1.9 : 1.0;
    }
    case "kitchen_remodel": {
      const size = resolveFirstAnswer(intake.answers, "kitchen_size");
      return size === "small" ? 0.55 : size === "large" ? 1.4 : size === "extra_large" ? 1.85 : 1.0;
    }
    case "general_carpentry": {
      const units = resolveFirstAnswer(intake.answers, "carpentry_units");
      return units === "small" ? 0.5 : units === "large" ? 2.1 : 1.0;
    }
    default:
      return 1.0;
  }
}

function resolveMaterialMultiplier(intake: ProjectIntakeRecord): number {
  for (const answer of intake.answers) {
    for (const val of answer.selectedValues) {
      if (val === "premium" || val === "premium_appliances") return 1.5;
      if (val === "budget") return 0.65;
    }
  }
  return 1.0;
}

function buildGenericAssumptions(intake: ProjectIntakeRecord, complexity: string): string[] {
  const def = CATEGORY_REGISTRY[intake.detectedCategory];
  const assumptions = [`Category: ${def.label.en}`, `Complexity level: ${complexity}`];
  if (intake.uploadedImages.length === 0) {
    assumptions.push("No photos uploaded — estimate may vary after site inspection.");
  }
  if (intake.answers.length < 2) {
    assumptions.push("Limited information provided — ranges are broad.");
  }
  return assumptions;
}

function generateGenericEstimate(intake: ProjectIntakeRecord): ProjectEstimate {
  const def = CATEGORY_REGISTRY[intake.detectedCategory];
  const complexity = resolveComplexity(intake);
  const complexityMult = def.rates.complexityMultiplier[complexity];
  const materialMult = resolveMaterialMultiplier(intake);

  let laborMin: number;
  let laborMax: number;

  if (def.rates.unit === "sqft") {
    const area = resolveAreaFromAnswers(intake);
    const accessAnswer = resolveFirstAnswer(intake.answers, "ext_painting_access");
    const accessMult = accessAnswer === "scaffolding" ? 1.4 : accessAnswer === "ladder" ? 1.15 : 1.0;
    laborMin = Math.round(area.min * def.rates.baseMin * complexityMult * accessMult);
    laborMax = Math.round(area.max * def.rates.baseMax * complexityMult * accessMult);
  } else if (def.rates.unit === "hourly") {
    const hours = resolveHoursFromSize(intake);
    laborMin = Math.round(hours.min * def.rates.baseMin * complexityMult);
    laborMax = Math.round(hours.max * def.rates.baseMax * complexityMult);
  } else {
    // fixed
    const sizeMult = resolveSizeMultiplier(intake);
    laborMin = Math.round(def.rates.baseMin * complexityMult * sizeMult * materialMult);
    laborMax = Math.round(def.rates.baseMax * complexityMult * sizeMult * materialMult);
  }

  // Clamp to fallback minimum
  if (laborMin < def.rates.fallbackMin) {
    laborMin = def.rates.fallbackMin;
    laborMax = Math.max(laborMax, def.rates.fallbackMax);
  }

  const contingencyRate = getContingencyRate(intake.accuracyScore);
  const contingency = {
    min: Math.round(laborMin * contingencyRate),
    max: Math.round(laborMax * contingencyRate),
    currency: "USD" as const,
  };

  return {
    id: randomUUID(),
    intakeId: intake.id,
    totalRange: {
      min: laborMin + contingency.min,
      max: laborMax + contingency.max,
      currency: "USD",
    },
    breakdown: {
      labor: intake.estimatePreference.includeLabor
        ? { min: laborMin, max: laborMax, currency: "USD" }
        : undefined,
      contingency,
    },
    includes: ["Labor", ...(intake.estimatePreference.includeMaterials ? ["Materials"] : [])],
    excludes: ["Permits", "Structural engineering", "Hazardous material removal"],
    assumptions: buildGenericAssumptions(intake, complexity),
    confidence: intake.accuracyScore >= 60 ? "high" : intake.accuracyScore >= 35 ? "medium" : "low",
    confidenceReasons: [
      intake.answers.length >= 3 ? "Multiple questions answered." : "Limited answers — confidence is low.",
      intake.uploadedImages.length > 0 ? "Photos uploaded." : "No photos uploaded.",
    ],
    accuracyScoreAtGeneration: intake.accuracyScore,
    generatedAt: new Date().toISOString(),
    generatedBy: "smart_intake_formula",
  };
}

export function generateEstimate(intake: ProjectIntakeRecord): ProjectEstimate {
  // Painting categories use the detailed painting estimator
  if (intake.detectedCategory === "interior_painting" || intake.detectedCategory === "exterior_painting") {
    return generatePaintingEstimate(intake);
  }
  return generateGenericEstimate(intake);
}

function generatePaintingEstimate(intake: ProjectIntakeRecord): ProjectEstimate {
  const area = resolveArea(intake.projectScope.area);
  const conditionKey = intake.projectScope.condition?.value ?? "not_sure";
  const conditionMultiplier = PAINTING_RATES.conditionMultiplier[conditionKey] ?? PAINTING_RATES.conditionMultiplier.not_sure;
  const paintCoatsValue = intake.projectScope.paintCoats?.value ?? 2;
  const coatsKey = paintCoatsValue >= 4 ? 4 : (paintCoatsValue as 1 | 2 | 3 | 4);
  const coatMultiplier = PAINTING_RATES.coatMultiplier[coatsKey] ?? 1;

  const labor = intake.estimatePreference.includeLabor
    ? {
        min: Math.round(area.min * PAINTING_RATES.laborPerSqft.min * conditionMultiplier * coatMultiplier),
        max: Math.round(area.max * PAINTING_RATES.laborPerSqft.max * conditionMultiplier * coatMultiplier),
        currency: "USD" as const,
      }
    : undefined;

  const materials = intake.estimatePreference.includeMaterials
    ? {
        min: Math.round(area.min * PAINTING_RATES.materialsPerSqft.min * coatMultiplier),
        max: Math.round(area.max * PAINTING_RATES.materialsPerSqft.max * coatMultiplier),
        currency: "USD" as const,
      }
    : undefined;

  const preparation = {
    min: Math.round(area.min * PAINTING_RATES.prepPerSqft.min * conditionMultiplier),
    max: Math.round(area.max * PAINTING_RATES.prepPerSqft.max * conditionMultiplier),
    currency: "USD" as const,
  };

  const subtotalMin = (labor?.min ?? 0) + (materials?.min ?? 0) + preparation.min;
  const subtotalMax = (labor?.max ?? 0) + (materials?.max ?? 0) + preparation.max;
  const contingencyRate = getContingencyRate(intake.accuracyScore);
  const contingency = {
    min: Math.round(subtotalMin * contingencyRate),
    max: Math.round(subtotalMax * contingencyRate),
    currency: "USD" as const,
  };

  return {
    id: randomUUID(),
    intakeId: intake.id,
    totalRange: {
      min: subtotalMin + contingency.min,
      max: subtotalMax + contingency.max,
      currency: "USD",
    },
    breakdown: {
      labor,
      materials,
      preparation,
      contingency,
    },
    includes: buildIncludesList(intake.estimatePreference),
    excludes: buildExcludesList(intake.projectScope),
    assumptions: buildAssumptionsList(intake.projectScope, area),
    confidence: getEstimateConfidence(intake.accuracyScore),
    confidenceReasons: buildConfidenceReasons(intake),
    accuracyScoreAtGeneration: intake.accuracyScore,
    generatedAt: new Date().toISOString(),
    generatedBy: "smart_intake_formula",
  };
}

function rebalancePaymentPercentages(milestones: ProjectMilestone[]): ProjectMilestone[] {
  const total = milestones.reduce((sum, milestone) => sum + (milestone.paymentPercentage ?? 0), 0);
  if (total === 100 || total === 0) return milestones;

  const payingMilestones = milestones.filter((milestone) => (milestone.paymentPercentage ?? 0) > 0);
  if (payingMilestones.length === 0) return milestones;

  let remaining = 100;
  return milestones.map((milestone, index) => {
    const current = milestone.paymentPercentage ?? 0;
    if (current <= 0) {
      return { ...milestone, paymentPercentage: 0 };
    }

    const isLastPaying = payingMilestones[payingMilestones.length - 1]?.id === milestone.id;
    const scaled = isLastPaying ? remaining : Math.round((current / total) * 100);
    remaining -= scaled;
    return { ...milestone, paymentPercentage: scaled };
  }).map((milestone, index, list) => (
    index === list.length - 1 && remaining !== 0 && (milestone.paymentPercentage ?? 0) > 0
      ? { ...milestone, paymentPercentage: (milestone.paymentPercentage ?? 0) + remaining }
      : milestone
  ));
}

export function generateMilestones(intake: ProjectIntakeRecord): ProjectMilestone[] {
  if (intake.detectedCategory === "interior_painting" || intake.detectedCategory === "exterior_painting") {
    return generatePaintingMilestones(intake);
  }
  return generateGenericMilestones(intake);
}

function generatePaintingMilestones(intake: ProjectIntakeRecord): ProjectMilestone[] {
  const condition = intake.projectScope.condition?.value;
  const filteredTemplate = PAINTING_MILESTONE_TEMPLATE.filter((milestone) => {
    if (condition === "good" && (milestone.sourceOrder === 3 || milestone.sourceOrder === 4)) {
      return false;
    }
    return true;
  });

  const preview = filteredTemplate.map((milestone, index) => {
    const id = `milestone_${index + 1}`;
    return {
      id,
      intakeId: intake.id,
      order: index + 1,
      title: milestone.title,
      description: milestone.description,
      estimatedDurationHours: milestone.estimatedDurationHours,
      dependencies: index === 0 ? [] : [`milestone_${index}`],
      paymentPercentage: milestone.paymentPercentage,
      requiresEvidence: milestone.requiresEvidence,
      status: "pending" as const,
    };
  });

  return rebalancePaymentPercentages(preview);
}

function generateGenericMilestones(intake: ProjectIntakeRecord): ProjectMilestone[] {
  const def = CATEGORY_REGISTRY[intake.detectedCategory];
  const templates = def.milestones;

  const preview = templates.map((tmpl, index) => ({
    id: `milestone_${index + 1}`,
    intakeId: intake.id,
    order: tmpl.order,
    title: tmpl.title,
    description: tmpl.description,
    estimatedDurationHours: undefined,
    dependencies: index === 0 ? [] : [`milestone_${index}`],
    paymentPercentage: tmpl.paymentPercentage,
    requiresEvidence: tmpl.requiresEvidence,
    status: "pending" as const,
  }));

  return rebalancePaymentPercentages(preview);
}

export function buildLiveSummary(intake: ProjectIntakeRecord): LiveSummary {
  const area = intake.projectScope.area?.range ?? (intake.projectScope.area?.value ? `${intake.projectScope.area.value} sqft` : undefined);
  const condition = intake.projectScope.condition?.value?.replaceAll("_", " ");
  const coatsValue = intake.projectScope.paintCoats?.value;
  const materials =
    intake.estimatePreference.includeLabor && intake.estimatePreference.includeMaterials
      ? "Materials and labor"
      : intake.estimatePreference.includeLabor
      ? "Labor only"
      : intake.estimatePreference.includeMaterials
      ? "Materials only"
      : undefined;
  const duration = intake.projectScope.durationPreference?.value?.replaceAll("_", " ");

  const categoryLabel = CATEGORY_REGISTRY[intake.detectedCategory]?.label.en ?? "Home Improvement";

  return {
    category: categoryLabel,
    area,
    condition,
    coats: coatsValue ? `${coatsValue} coat${coatsValue > 1 ? "s" : ""}` : undefined,
    materials,
    duration,
    imageCount: intake.uploadedImages.length,
    pendingFields: intake.missingFields,
  };
}

export function refreshDerivedState(intake: ProjectIntakeRecord): ProjectIntakeRecord {
  const score = calculateAccuracyScore(intake);
  const missingFields = getMissingFields(intake);
  const recommendedFields = getRecommendedFields(intake);
  const activeWarnings = generateWarnings(intake);
  const accuracyLevel = getAccuracyLevel(score);

  const nextStatus =
    intake.generatedEstimate
      ? "estimate_generated"
      : score >= 36
      ? "ready_for_estimate"
      : missingFields.length > 0
      ? "needs_more_info"
      : "draft";

  return {
    ...intake,
    accuracyScore: score,
    accuracyLevel,
    missingFields,
    recommendedFields,
    activeWarnings,
    status: nextStatus,
  };
}

export function buildInitialIntake(input: {
  id: string;
  tenantId: string;
  sessionToken: string;
  rawDescription: string;
  providedTitle?: string | null;
  selectedCategoryId?: string | null;
  selectedSubcategoryId?: string | null;
  modality?: "on_site" | "remote" | "hybrid" | null;
  city?: string | null;
  urgency?: "low" | "medium" | "high" | "urgent" | null;
  channel?: string | null;
}): ProjectIntakeRecord {
  const detectedCategory = detectCategoryFromText({
    selectedCategoryId: input.selectedCategoryId ?? null,
    selectedSubcategoryId: input.selectedSubcategoryId ?? null,
    rawDescription: input.rawDescription,
  });

  const intake: ProjectIntakeRecord = {
    id: input.id,
    tenantId: input.tenantId,
    userId: null,
    sessionToken: input.sessionToken,
    publishedJobId: null,
    rawDescription: input.rawDescription,
    providedTitle: input.providedTitle?.trim() || null,
    normalizedTitle: buildNormalizedTitle({
      providedTitle: input.providedTitle ?? null,
      rawDescription: input.rawDescription,
      detectedCategory,
    }),
    selectedCategoryId: input.selectedCategoryId?.trim() || null,
    selectedSubcategoryId: input.selectedSubcategoryId?.trim() || null,
    detectedCategory,
    detectedSubcategory: input.selectedSubcategoryId?.trim() || null,
    modality: input.modality ?? null,
    city: input.city?.trim() || null,
    urgency: input.urgency ?? null,
    detectedLanguage: detectLanguage(input.rawDescription),
    channel: input.channel?.trim() || "web",
    categoryConfidence: detectCategoryConfidence({
      selectedCategoryId: input.selectedCategoryId ?? null,
      selectedSubcategoryId: input.selectedSubcategoryId ?? null,
      rawDescription: input.rawDescription,
    }),
    accuracyScore: 0,
    accuracyLevel: "low",
    missingFields: [],
    recommendedFields: [],
    answers: [],
    uploadedImages: [],
    estimatePreference: { includeMaterials: true, includeLabor: true, pricingMode: "not_sure" },
    projectScope: {},
    generatedEstimate: null,
    generatedMilestones: [],
    activeWarnings: [],
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    claimedAt: null,
    publishedAt: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  return refreshDerivedState(intake);
}

export function updateAnswerSet(answers: IntakeAnswer[], nextAnswer: IntakeAnswer): IntakeAnswer[] {
  return [...answers.filter((answer) => answer.questionId !== nextAnswer.questionId), nextAnswer];
}

export function getSupportedQuestions(category: SmartIntakeCategory): IntakeQuestion[] {
  return CATEGORY_REGISTRY[category]?.questions ?? PAINTING_QUESTIONS;
}

// ── Voice profile (SAT-002) ────────────────────────────────────────────────────

export const VOICE_CHANNELS = new Set(["alexa"]);

/**
 * Prompt hablable para canales de voz: texto plano, sin markdown ni links,
 * ≤ 90 palabras. Devuelve null para canales no-voz.
 */
export function buildVoicePrompt(
  intake: ProjectIntakeRecord,
  nextQuestion: IntakeQuestion | null
): string | null {
  if (!VOICE_CHANNELS.has(intake.channel)) {
    return null;
  }

  const lang = intake.detectedLanguage === "en" ? "en" : "es";

  if (!nextQuestion) {
    return lang === "en"
      ? "Thanks, I have what I need for now. A professional will review your project and contact you soon."
      : "Gracias, ya tengo lo necesario por ahora. Un profesional revisará tu proyecto y te contactará pronto.";
  }

  const parts: string[] = [nextQuestion.label[lang]];

  const options = (nextQuestion.options ?? []).slice(0, 4).map((option) => option.label[lang]);
  if (options.length > 0) {
    parts.push(
      lang === "en"
        ? `You can answer: ${options.join(", ")}.`
        : `Puedes responder: ${options.join(", ")}.`
    );
  }

  const spoken = parts.join(" ").replace(/\s+/g, " ").trim();
  const words = spoken.split(" ");
  return words.length > 90 ? `${words.slice(0, 90).join(" ")}…` : spoken;
}
