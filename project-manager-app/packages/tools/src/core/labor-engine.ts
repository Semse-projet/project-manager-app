import type { LaborEstimate } from "./types.js";

export type LaborProfile = {
  baseHours: number;
  crewSize: number;
  ratePerHour: number;
  difficulty: LaborEstimate["difficulty"];
  notes?: string[];
};

export function estimateLabor(profile: LaborProfile): LaborEstimate {
  const hours = Math.max(0, profile.baseHours);
  return {
    hours: round2(hours),
    crewSize: Math.max(1, Math.round(profile.crewSize)),
    days: Math.max(1, Math.ceil(hours / (8 * Math.max(1, Math.round(profile.crewSize))))),
    ratePerHour: round2(profile.ratePerHour),
    totalCost: round2(hours * Math.max(1, Math.round(profile.crewSize)) * profile.ratePerHour),
    difficulty: profile.difficulty,
    notes: profile.notes ?? [],
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
