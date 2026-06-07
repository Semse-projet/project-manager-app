export type ScoringWeight = {
  fieldId: string;
  exactMatch: number;
  approximateMatch?: number;
  notSureAnswer?: number;
  unanswered: number;
};

export const PAINTING_WEIGHTS: ScoringWeight[] = [
  { fieldId: "rawDescription", exactMatch: 15, unanswered: 0 },
  { fieldId: "area", exactMatch: 20, approximateMatch: 15, notSureAnswer: 5, unanswered: 0 },
  { fieldId: "condition", exactMatch: 20, notSureAnswer: 5, unanswered: 0 },
  { fieldId: "paintCoats", exactMatch: 10, notSureAnswer: 3, unanswered: 0 },
  { fieldId: "estimatePreference", exactMatch: 15, notSureAnswer: 5, unanswered: 0 },
  { fieldId: "pricingMode", exactMatch: 10, notSureAnswer: 3, unanswered: 0 },
  { fieldId: "durationPreference", exactMatch: 5, notSureAnswer: 2, unanswered: 0 },
  { fieldId: "uploadedImages", exactMatch: 5, unanswered: 0 },
];
