import type { SmartIntakeCategory } from "../smart-intake.types.js";

export type SizeScale = {
  /** Question whose first answer picks the scale. */
  questionId: string;
  small: number;
  large: number;
  /** Only questions that offer an "extra_large" option. */
  extraLarge?: number;
};

/**
 * Multipliers applied to fixed-price categories from the scope/size answer.
 * Any answer other than small/large/extra_large (or no answer) scales by 1.
 */
export const SIZE_SCALES: Partial<Record<SmartIntakeCategory, SizeScale>> = {
  bathroom_remodel: { questionId: "bathroom_size", small: 0.65, large: 1.4, extraLarge: 1.9 },
  kitchen_remodel: { questionId: "kitchen_size", small: 0.55, large: 1.4, extraLarge: 1.85 },
  general_carpentry: { questionId: "carpentry_units", small: 0.5, large: 2.1 },
  plumbing_repair: { questionId: "plumbing_scope", small: 0.6, large: 1.8 },
  electrical_work: { questionId: "electrical_scope", small: 0.6, large: 1.9 },
  flooring_installation: { questionId: "flooring_scope", small: 0.6, large: 2.0 },
  landscaping: { questionId: "landscaping_scope", small: 0.6, large: 1.9 },
  roofing: { questionId: "roofing_scope", small: 0.5, large: 2.2 },
  hvac: { questionId: "hvac_scope", small: 0.6, large: 2.0 },
  fencing_decks: { questionId: "fencing_scope", small: 0.5, large: 2.2 },
  handyman: { questionId: "handyman_scope", small: 0.5, large: 2.0 },
  masonry_concrete: { questionId: "masonry_scope", small: 0.5, large: 2.5 },
  demolition: { questionId: "demolition_scope", small: 0.5, large: 2.5 },
  moving: { questionId: "moving_scope", small: 0.6, large: 2.2 },
  pressure_washing: { questionId: "pw_scope", small: 0.5, large: 2.2 },
};

export function resolveSizeScale(category: SmartIntakeCategory, answer: string | null): number {
  const scale = SIZE_SCALES[category];
  if (!scale || !answer) return 1;
  if (answer === "small") return scale.small;
  if (answer === "large") return scale.large;
  if (answer === "extra_large" && scale.extraLarge !== undefined) return scale.extraLarge;
  return 1;
}
