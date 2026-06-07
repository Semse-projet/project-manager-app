import type { SmartIntakeCategory } from "../smart-intake.types.js";

// ── types ─────────────────────────────────────────────────────────────────────

export type FieldScoringWeight = {
  /** ID of the question (maps to IntakeAnswer.questionId) */
  questionId: string;
  /** Short human-readable label for missing-field reports */
  label: string;
  /** Score when the question is answered with a concrete value */
  exact: number;
  /** Score when the question is answered with "not sure" */
  notSure: number;
  /** Field shown in missingCriticalFields when unanswered */
  critical: boolean;
  /** Field shown in missingRecommendedFields when unanswered */
  recommended: boolean;
};

export type CategoryScoringProfile = {
  id: SmartIntakeCategory | "generic";
  /** Score for rawDescription present (>= 10 chars) */
  rawDescriptionScore: number;
  /** Score for at least one uploaded image */
  imagesScore: number;
  /** Per-question weights */
  weights: FieldScoringWeight[];
  /** Minimum score to unlock estimate generation */
  estimateReadyThreshold: number;
  /** Risk flags: answers that indicate possible hidden complexity */
  riskTriggers?: Array<{ questionId: string; value: string; flag: string }>;
};

// ── profiles ──────────────────────────────────────────────────────────────────

/**
 * exterior_painting  — max ≈ 95
 * threshold = 36 (same as interior — comparable complexity)
 */
const EXTERIOR_PAINTING_PROFILE: CategoryScoringProfile = {
  id: "exterior_painting",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 36,
  weights: [
    { questionId: "ext_painting_surface",   label: "Surface type",         exact: 20, notSure: 6, critical: true,  recommended: false },
    { questionId: "ext_painting_area",       label: "Area / sq ft",         exact: 20, notSure: 8, critical: true,  recommended: false },
    { questionId: "ext_painting_condition",  label: "Surface condition",    exact: 15, notSure: 5, critical: true,  recommended: false },
    { questionId: "ext_painting_coats",      label: "Coats needed",         exact: 10, notSure: 3, critical: false, recommended: true  },
    { questionId: "ext_painting_access",     label: "Access / height",      exact: 10, notSure: 3, critical: false, recommended: true  },
  ],
  riskTriggers: [
    { questionId: "ext_painting_condition", value: "structural_damage", flag: "possible_structural_damage" },
    { questionId: "ext_painting_condition", value: "moisture_mold",     flag: "moisture_damage_present" },
    { questionId: "ext_painting_access",    value: "scaffolding",       flag: "elevated_access_required" },
  ],
};

/**
 * drywall_repair  — max ≈ 90
 * threshold = 36 (comparable to painting)
 */
const DRYWALL_PROFILE: CategoryScoringProfile = {
  id: "drywall_repair",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 36,
  weights: [
    { questionId: "drywall_type",      label: "Type of work",      exact: 25, notSure: 8,  critical: true,  recommended: false },
    { questionId: "drywall_area",      label: "Area / sq ft",      exact: 25, notSure: 8,  critical: true,  recommended: false },
    { questionId: "drywall_condition", label: "Cause of damage",   exact: 15, notSure: 5,  critical: true,  recommended: false },
    { questionId: "drywall_finish",    label: "Finish level",      exact: 10, notSure: 3,  critical: false, recommended: true  },
  ],
  riskTriggers: [
    { questionId: "drywall_condition", value: "structural",    flag: "structural_crack_risk" },
    { questionId: "drywall_condition", value: "water_damage",  flag: "moisture_damage_present" },
    { questionId: "drywall_condition", value: "pest",          flag: "pest_damage_present" },
  ],
};

/**
 * bathroom_remodel  — max ≈ 100
 * threshold = 45 (higher risk — hidden plumbing surprises common)
 */
const BATHROOM_PROFILE: CategoryScoringProfile = {
  id: "bathroom_remodel",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 45,
  weights: [
    { questionId: "bathroom_scope",    label: "Remodel scope",       exact: 25, notSure: 8,  critical: true,  recommended: false },
    { questionId: "bathroom_size",     label: "Bathroom size",       exact: 20, notSure: 6,  critical: true,  recommended: false },
    { questionId: "bathroom_plumbing", label: "Plumbing changes",    exact: 20, notSure: 6,  critical: true,  recommended: false },
    { questionId: "bathroom_materials",label: "Material quality",    exact: 10, notSure: 3,  critical: false, recommended: true  },
    { questionId: "bathroom_timeline", label: "Timeline",            exact:  5, notSure: 2,  critical: false, recommended: true  },
  ],
  riskTriggers: [
    { questionId: "bathroom_plumbing", value: "relocate",      flag: "plumbing_relocation" },
    { questionId: "bathroom_scope",    value: "full_remodel",  flag: "high_scope_bathroom" },
    { questionId: "bathroom_materials",value: "premium",       flag: "premium_materials" },
  ],
};

/**
 * kitchen_remodel  — max ≈ 100
 * threshold = 45 (complex trade, many unknowns)
 */
const KITCHEN_PROFILE: CategoryScoringProfile = {
  id: "kitchen_remodel",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 45,
  weights: [
    { questionId: "kitchen_scope",    label: "Kitchen scope",         exact: 25, notSure: 8, critical: true,  recommended: false },
    { questionId: "kitchen_size",     label: "Kitchen size",          exact: 20, notSure: 6, critical: true,  recommended: false },
    { questionId: "kitchen_appliances",label: "Appliances included",  exact: 15, notSure: 5, critical: true,  recommended: false },
    { questionId: "kitchen_materials",label: "Material quality",      exact: 10, notSure: 3, critical: true,  recommended: false },
    { questionId: "kitchen_plumbing", label: "Plumbing / electrical", exact: 10, notSure: 3, critical: false, recommended: true  },
  ],
  riskTriggers: [
    { questionId: "kitchen_plumbing",  value: "relocate",               flag: "plumbing_relocation" },
    { questionId: "kitchen_appliances",value: "premium_appliances",      flag: "premium_appliances" },
    { questionId: "kitchen_scope",     value: "full_remodel",            flag: "high_scope_kitchen" },
    { questionId: "kitchen_materials", value: "premium",                 flag: "premium_materials" },
  ],
};

/**
 * cleaning  — max ≈ 90
 * threshold = 30 (simpler service, fewer unknowns)
 */
const CLEANING_PROFILE: CategoryScoringProfile = {
  id: "cleaning",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 30,
  weights: [
    { questionId: "cleaning_type",      label: "Cleaning type",   exact: 25, notSure: 8, critical: true,  recommended: false },
    { questionId: "cleaning_size",      label: "Space size",       exact: 25, notSure: 8, critical: true,  recommended: false },
    { questionId: "cleaning_frequency", label: "Frequency",        exact: 10, notSure: 3, critical: false, recommended: true  },
    { questionId: "cleaning_extras",    label: "Extra services",   exact: 10, notSure: 3, critical: false, recommended: true  },
  ],
  riskTriggers: [
    { questionId: "cleaning_type", value: "post_construction", flag: "post_construction_cleanup" },
    { questionId: "cleaning_type", value: "commercial",        flag: "commercial_space" },
  ],
};

/**
 * general_carpentry  — max ≈ 95
 * threshold = 36
 */
const CARPENTRY_PROFILE: CategoryScoringProfile = {
  id: "general_carpentry",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 36,
  weights: [
    { questionId: "carpentry_type",     label: "Work type",         exact: 25, notSure: 8, critical: true,  recommended: false },
    { questionId: "carpentry_units",    label: "Units / area",      exact: 20, notSure: 6, critical: true,  recommended: false },
    { questionId: "carpentry_material", label: "Material quality",  exact: 20, notSure: 5, critical: false, recommended: true  },
    { questionId: "carpentry_existing", label: "Demolition needed", exact: 10, notSure: 3, critical: false, recommended: true  },
  ],
  riskTriggers: [
    { questionId: "carpentry_existing", value: "significant", flag: "significant_demolition" },
    { questionId: "carpentry_material", value: "premium",     flag: "premium_materials" },
  ],
};

/**
 * generic  — fallback for unrecognised categories
 * threshold = 36
 */
const GENERIC_PROFILE: CategoryScoringProfile = {
  id: "generic",
  rawDescriptionScore: 20,
  imagesScore: 10,
  estimateReadyThreshold: 36,
  weights: [],
};

// ── registry ──────────────────────────────────────────────────────────────────

export const SCORING_PROFILES: Partial<Record<SmartIntakeCategory | "generic", CategoryScoringProfile>> = {
  exterior_painting: EXTERIOR_PAINTING_PROFILE,
  drywall_repair:    DRYWALL_PROFILE,
  bathroom_remodel:  BATHROOM_PROFILE,
  kitchen_remodel:   KITCHEN_PROFILE,
  cleaning:          CLEANING_PROFILE,
  general_carpentry: CARPENTRY_PROFILE,
};

export const GENERIC_SCORING_PROFILE: CategoryScoringProfile = GENERIC_PROFILE;

export function getScoringProfile(category: SmartIntakeCategory): CategoryScoringProfile {
  return SCORING_PROFILES[category] ?? GENERIC_PROFILE;
}
