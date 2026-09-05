import type { ReputationScoreView } from "@semse/schemas";
import { apiFetch } from "./client";

export async function fetchReputationBatch(): Promise<ReputationScoreView[]> {
  return apiFetch<ReputationScoreView[]>("/v1/ratings/reputation");
}
