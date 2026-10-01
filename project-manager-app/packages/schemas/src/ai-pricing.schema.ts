import { z } from "zod";

/**
 * C39 — contrato de alta del catálogo global de precios de modelos de IA
 * (spec: prometeo/ai-pricing-catalog). Solo OPS_ADMIN. Las entradas son
 * inmutables; un cambio de precio cierra la vigencia anterior y abre una nueva.
 */
export const AI_PRICING_SCHEMA_VERSIONS = [1] as const;

const isoDate = z
  .string()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "fecha ISO inválida" });

export const createAiModelPriceSchema = z
  .object({
    provider: z.string().trim().min(1).max(100),
    modelSlug: z.string().trim().min(1).max(100),
    /** Nombre real del modelo que reporta el proveedor (no solo el alias/slug). */
    providerModelName: z.string().trim().min(1).max(200),
    inputPer1K: z.number().finite().min(0),
    outputPer1K: z.number().finite().min(0),
    currency: z.literal("USD").default("USD"),
    effectiveFrom: isoDate,
    effectiveTo: isoDate.nullable().optional(),
    pricingSchemaVersion: z.number().int().refine((v) => (AI_PRICING_SCHEMA_VERSIONS as readonly number[]).includes(v), {
      message: "pricingSchemaVersion no soportada",
    }).default(1),
    /** Validado contra el esquema de su `pricingSchemaVersion` (v1: vacío). */
    metadataJson: z.record(z.unknown()).default({}),
    /** Fuente oficial del proveedor (página/documentación de precios). */
    sourceUrl: z.string().url().refine((u) => u.startsWith("https://"), { message: "sourceUrl debe ser https" }),
    sourcePublishedAt: isoDate.nullable().optional(),
    sourceCheckedAt: isoDate,
  })
  .strict();

export type CreateAiModelPriceInput = z.infer<typeof createAiModelPriceSchema>;
