import type { TrustOverview } from "@semse/schemas";
import { apiFetch } from "./client";

export async function fetchTrustOverview(): Promise<TrustOverview> {
  return apiFetch<TrustOverview>("/v1/ops/trust-overview");
}
