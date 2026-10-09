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
 * plumbing_repair  — max ≈ 95
 * threshold = 36
 */
const PLUMBING_PROFILE: CategoryScoringProfile = {
  id: "plumbing_repair",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 36,
  weights: [
    { questionId: "plumbing_type",     label: "Type of work",       exact: 25, notSure: 8, critical: true,  recommended: false },
    { questionId: "plumbing_scope",    label: "Fixtures involved",  exact: 20, notSure: 6, critical: true,  recommended: false },
    { questionId: "plumbing_access",   label: "Access difficulty",  exact: 20, notSure: 6, critical: false, recommended: true  },
    { questionId: "plumbing_material", label: "Material quality",   exact: 10, notSure: 3, critical: false, recommended: true  },
  ],
  riskTriggers: [
    { questionId: "plumbing_type",   value: "structural",   flag: "repiping_required" },
    { questionId: "plumbing_access", value: "underground",  flag: "underground_access" },
  ],
};

/**
 * electrical_work  — max ≈ 95
 * threshold = 36 (higher scrutiny — safety-sensitive trade)
 */
const ELECTRICAL_PROFILE: CategoryScoringProfile = {
  id: "electrical_work",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 36,
  weights: [
    { questionId: "electrical_type",     label: "Type of work",        exact: 25, notSure: 8, critical: true,  recommended: false },
    { questionId: "electrical_scope",    label: "Circuits / points",   exact: 20, notSure: 6, critical: true,  recommended: false },
    { questionId: "electrical_panel",    label: "Panel condition",     exact: 20, notSure: 6, critical: false, recommended: true  },
    { questionId: "electrical_material", label: "Material quality",    exact: 10, notSure: 3, critical: false, recommended: true  },
  ],
  riskTriggers: [
    { questionId: "electrical_type",  value: "structural",  flag: "rewiring_required" },
    { questionId: "electrical_panel", value: "structural",  flag: "panel_replacement_required" },
  ],
};

/**
 * flooring_installation  — max ≈ 95
 * threshold = 36
 */
const FLOORING_PROFILE: CategoryScoringProfile = {
  id: "flooring_installation",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 36,
  weights: [
    { questionId: "flooring_type",     label: "Type of work",     exact: 25, notSure: 8, critical: true,  recommended: false },
    { questionId: "flooring_scope",    label: "Area / rooms",     exact: 20, notSure: 6, critical: true,  recommended: false },
    { questionId: "flooring_material", label: "Material quality", exact: 20, notSure: 6, critical: false, recommended: true  },
    { questionId: "flooring_existing", label: "Removal needed",   exact: 10, notSure: 3, critical: false, recommended: true  },
  ],
  riskTriggers: [
    { questionId: "flooring_existing", value: "significant", flag: "significant_demolition" },
    { questionId: "flooring_material", value: "premium",     flag: "premium_materials" },
  ],
};

/**
 * landscaping  — max ≈ 90
 * threshold = 30 (simpler trade, fewer hidden unknowns)
 */
const LANDSCAPING_PROFILE: CategoryScoringProfile = {
  id: "landscaping",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 30,
  weights: [
    { questionId: "landscaping_type",      label: "Type of work",   exact: 25, notSure: 8, critical: true,  recommended: false },
    { questionId: "landscaping_scope",     label: "Yard size",      exact: 25, notSure: 8, critical: true,  recommended: false },
    { questionId: "landscaping_frequency", label: "Frequency",      exact: 10, notSure: 3, critical: false, recommended: true  },
    { questionId: "landscaping_material",  label: "Material quality", exact: 10, notSure: 3, critical: false, recommended: true },
  ],
  riskTriggers: [
    { questionId: "landscaping_type", value: "structural", flag: "hardscaping_scope" },
  ],
};

/**
 * roofing  — max ≈ 90
 * threshold = 36
 */
const ROOFING_PROFILE: CategoryScoringProfile = {
  id: "roofing",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 36,
  weights: [
    { questionId: "roofing_type",     label: "Type of work",     exact: 25, notSure: 8, critical: true,  recommended: false },
    { questionId: "roofing_scope",    label: "Roof area",        exact: 20, notSure: 6, critical: true,  recommended: false },
    { questionId: "roofing_material", label: "Roof material",    exact: 15, notSure: 5, critical: false, recommended: true  },
    { questionId: "roofing_access",   label: "Slope / height",   exact: 10, notSure: 3, critical: false, recommended: true  },
  ],
  riskTriggers: [
    { questionId: "roofing_type",   value: "structural", flag: "structural_roof_damage" },
    { questionId: "roofing_access", value: "steep",      flag: "elevated_access_required" },
  ],
};

/**
 * hvac  — max ≈ 90
 * threshold = 36
 */
const HVAC_PROFILE: CategoryScoringProfile = {
  id: "hvac",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 36,
  weights: [
    { questionId: "hvac_type",      label: "Type of work",       exact: 25, notSure: 8, critical: true,  recommended: false },
    { questionId: "hvac_scope",     label: "Units / zones",      exact: 20, notSure: 6, critical: true,  recommended: false },
    { questionId: "hvac_access",    label: "Equipment location", exact: 15, notSure: 5, critical: false, recommended: true  },
    { questionId: "hvac_equipment", label: "Equipment tier",     exact: 10, notSure: 3, critical: false, recommended: true  },
  ],
  riskTriggers: [
    { questionId: "hvac_type",   value: "structural", flag: "ductwork_redesign" },
    { questionId: "hvac_access", value: "rooftop",    flag: "elevated_access_required" },
  ],
};

/**
 * fencing_decks  — max ≈ 90
 * threshold = 36
 */
const FENCING_DECKS_PROFILE: CategoryScoringProfile = {
  id: "fencing_decks",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 36,
  weights: [
    { questionId: "fencing_type",     label: "Type of work",     exact: 25, notSure: 8, critical: true,  recommended: false },
    { questionId: "fencing_scope",    label: "Project size",     exact: 20, notSure: 6, critical: true,  recommended: false },
    { questionId: "fencing_material", label: "Material",         exact: 15, notSure: 5, critical: false, recommended: true  },
    { questionId: "fencing_site",     label: "Terrain / access", exact: 10, notSure: 3, critical: false, recommended: true  },
  ],
  riskTriggers: [
    { questionId: "fencing_type", value: "structural",        flag: "permit_likely_required" },
    { questionId: "fencing_site", value: "demolition_needed", flag: "demolition_required" },
  ],
};

/**
 * handyman  — max ≈ 90
 * threshold = 36
 */
const HANDYMAN_PROFILE: CategoryScoringProfile = {
  id: "handyman",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 36,
  weights: [
    { questionId: "handyman_type",      label: "Type of jobs",      exact: 25, notSure: 8, critical: true,  recommended: false },
    { questionId: "handyman_scope",     label: "Amount of work",    exact: 20, notSure: 6, critical: true,  recommended: false },
    { questionId: "handyman_materials", label: "Materials supply",  exact: 10, notSure: 3, critical: false, recommended: true  },
    { questionId: "handyman_access",    label: "Access",            exact: 10, notSure: 3, critical: false, recommended: true  },
  ],
  riskTriggers: [
    { questionId: "handyman_type",   value: "licensed_trade",  flag: "licensed_trade_possible" },
    { questionId: "handyman_access", value: "elevated_access", flag: "elevated_access_required" },
  ],
};

/**
 * masonry_concrete  — max ≈ 90
 * threshold = 36
 */
const MASONRY_CONCRETE_PROFILE: CategoryScoringProfile = {
  id: "masonry_concrete",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 36,
  weights: [
    { questionId: "masonry_type",      label: "Type of work",     exact: 25, notSure: 8, critical: true,  recommended: false },
    { questionId: "masonry_scope",     label: "Job size",         exact: 20, notSure: 6, critical: true,  recommended: false },
    { questionId: "masonry_condition", label: "Site condition",   exact: 15, notSure: 5, critical: false, recommended: true  },
    { questionId: "masonry_access",    label: "Truck / equipment access", exact: 10, notSure: 3, critical: false, recommended: true  },
  ],
  riskTriggers: [
    { questionId: "masonry_type",      value: "structural",        flag: "engineering_review_likely" },
    { questionId: "masonry_condition", value: "demolition_needed", flag: "demolition_required" },
    { questionId: "masonry_access",    value: "pump_required",     flag: "special_equipment_required" },
  ],
};

/**
 * demolition  — max ≈ 90
 * threshold = 36
 */
const DEMOLITION_PROFILE: CategoryScoringProfile = {
  id: "demolition",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 36,
  weights: [
    { questionId: "demolition_type",     label: "What is demolished", exact: 25, notSure: 8, critical: true,  recommended: false },
    { questionId: "demolition_scope",    label: "Demolition size",    exact: 20, notSure: 6, critical: true,  recommended: false },
    { questionId: "demolition_age",      label: "Building age",       exact: 10, notSure: 3, critical: false, recommended: true  },
    { questionId: "demolition_disposal", label: "Debris removal",     exact: 10, notSure: 3, critical: false, recommended: true  },
  ],
  riskTriggers: [
    { questionId: "demolition_type", value: "structural", flag: "structural_assessment_required" },
    { questionId: "demolition_type", value: "structural", flag: "permit_likely_required" },
    { questionId: "demolition_age",  value: "pre_1980",   flag: "hazmat_testing_recommended" },
  ],
};

/**
 * moving  — max ≈ 90
 * threshold = 36
 */
const MOVING_PROFILE: CategoryScoringProfile = {
  id: "moving",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 36,
  weights: [
    { questionId: "moving_type",     label: "Type of move",     exact: 25, notSure: 8, critical: true,  recommended: false },
    { questionId: "moving_scope",    label: "Size of move",     exact: 20, notSure: 6, critical: true,  recommended: false },
    { questionId: "moving_distance", label: "Distance",         exact: 15, notSure: 5, critical: false, recommended: true  },
    { questionId: "moving_access",   label: "Access / items",   exact: 10, notSure: 3, critical: false, recommended: true  },
  ],
  riskTriggers: [
    { questionId: "moving_distance", value: "long_distance", flag: "long_distance_pricing" },
    { questionId: "moving_access",   value: "special_items", flag: "specialty_handling_required" },
    { questionId: "moving_access",   value: "stairs",        flag: "stairs_present" },
  ],
};

/**
 * pressure_washing  — max ≈ 90
 * threshold = 36
 */
const PRESSURE_WASHING_PROFILE: CategoryScoringProfile = {
  id: "pressure_washing",
  rawDescriptionScore: 15,
  imagesScore: 5,
  estimateReadyThreshold: 36,
  weights: [
    { questionId: "pw_surface",   label: "Surface",         exact: 25, notSure: 8, critical: true,  recommended: false },
    { questionId: "pw_scope",     label: "Area size",       exact: 20, notSure: 6, critical: true,  recommended: false },
    { questionId: "pw_condition", label: "Dirt level",      exact: 15, notSure: 5, critical: false, recommended: true  },
    { questionId: "pw_water",     label: "Water / power",   exact: 10, notSure: 3, critical: false, recommended: true  },
  ],
  riskTriggers: [
    { questionId: "pw_surface",   value: "roof",          flag: "roof_soft_wash_required" },
    { questionId: "pw_condition", value: "heavy_staining", flag: "stain_removal_uncertain" },
    { questionId: "pw_water",     value: "no_water",      flag: "water_source_needed" },
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
  plumbing_repair:        PLUMBING_PROFILE,
  electrical_work:        ELECTRICAL_PROFILE,
  flooring_installation:  FLOORING_PROFILE,
  landscaping:            LANDSCAPING_PROFILE,
  roofing:                ROOFING_PROFILE,
  hvac:                   HVAC_PROFILE,
  fencing_decks:          FENCING_DECKS_PROFILE,
  handyman:               HANDYMAN_PROFILE,
  masonry_concrete:       MASONRY_CONCRETE_PROFILE,
  demolition:             DEMOLITION_PROFILE,
  moving:                 MOVING_PROFILE,
  pressure_washing:       PRESSURE_WASHING_PROFILE,
};

export const GENERIC_SCORING_PROFILE: CategoryScoringProfile = GENERIC_PROFILE;

export function getScoringProfile(category: SmartIntakeCategory): CategoryScoringProfile {
  return SCORING_PROFILES[category] ?? GENERIC_PROFILE;
}
