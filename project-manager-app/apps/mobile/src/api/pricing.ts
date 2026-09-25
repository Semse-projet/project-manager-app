import type { ContractorRateOverrideView, LaborRatesResponseView, UpdateLaborRatesInput } from "@semse/schemas";
import { apiFetch } from "./client";

export async function fetchLaborRates(): Promise<LaborRatesResponseView> {
  return apiFetch<LaborRatesResponseView>("/v1/pricing/labor-rates");
}

/** PUT only echoes back {override, saved} — re-fetch via fetchLaborRates() for the full response (baseline/hasCustomRates). */
export async function saveLaborRates(input: UpdateLaborRatesInput): Promise<{ override: ContractorRateOverrideView; saved: boolean }> {
  return apiFetch<{ override: ContractorRateOverrideView; saved: boolean }>("/v1/pricing/labor-rates", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function resetLaborRates(): Promise<{ deleted: boolean; revertedToBls: boolean }> {
  return apiFetch<{ deleted: boolean; revertedToBls: boolean }>("/v1/pricing/labor-rates", {
    method: "DELETE",
  });
}
