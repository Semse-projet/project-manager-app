import { z } from "zod";

export const updateLaborRatesSchema = z.object({
  laborRatePerHr: z.number().min(10).max(250),
  materialMarkup: z.number().min(0).max(1),
  notes: z.string().max(1000).optional()
});

// Matches ContractorRateOverrideView in apps/api/src/modules/pricing/contractor-rate.service.ts —
// the shape returned inside GET/PUT /v1/pricing/labor-rates's `override` field.
export const contractorRateOverrideSchema = z.object({
  userId: z.string().min(1),
  laborRatePerHr: z.number(),
  materialMarkup: z.number(),
  laborMultiplier: z.number(),
  materialMultiplier: z.number(),
  notes: z.string().optional(),
  updatedAt: z.string().min(1)
});

// GET /v1/pricing/labor-rates response.
export const laborRatesResponseSchema = z.object({
  override: contractorRateOverrideSchema.nullable(),
  nationalBaselineHourlyRate: z.number(),
  hasCustomRates: z.boolean()
});

export type UpdateLaborRatesInput = z.infer<typeof updateLaborRatesSchema>;
export type ContractorRateOverrideView = z.infer<typeof contractorRateOverrideSchema>;
export type LaborRatesResponseView = z.infer<typeof laborRatesResponseSchema>;
