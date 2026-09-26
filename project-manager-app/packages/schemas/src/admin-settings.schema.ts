import { z } from "zod";

export const adminIntegrationIdSchema = z.enum([
  "openai",
  "github",
  "whatsapp",
  "stripe",
  "hellosign",
]);

export const adminIntegrationStateSchema = z.enum([
  "UNCONFIGURED",
  "SIMULATION",
  "CONFIGURED_UNVERIFIED",
  "VERIFIED",
  "ERROR",
]);

export const adminIntegrationCheckSchema = z.object({
  state: z.enum(["VERIFIED", "ERROR"]),
  checkedAt: z.string().datetime(),
  message: z.string().trim().min(1).max(240),
});

const adminIntegrationChecksSchema = z.object({
  openai: adminIntegrationCheckSchema.optional(),
  github: adminIntegrationCheckSchema.optional(),
  whatsapp: adminIntegrationCheckSchema.optional(),
  stripe: adminIntegrationCheckSchema.optional(),
  hellosign: adminIntegrationCheckSchema.optional(),
}).default({});

export const adminIntegrationStatusSchema = z.object({
  id: adminIntegrationIdSchema,
  label: z.string(),
  purpose: z.string(),
  state: adminIntegrationStateSchema,
  enabledForTenant: z.boolean().nullable(),
  requiredVariables: z.array(z.string()),
  missingVariables: z.array(z.string()),
  checkedAt: z.string().datetime().nullable(),
  message: z.string(),
  canVerify: z.boolean(),
});

export const adminIntegrationStatusesSchema = z.array(adminIntegrationStatusSchema);

export const adminSettingsSchema = z.object({
  language: z.enum(["es", "en"]).default("es"),
  timezone: z.string().default("America/Mexico_City"),
  notifications: z.object({
    email: z.boolean().default(true),
    disputes: z.boolean().default(true),
    payments: z.boolean().default(true),
    system: z.boolean().default(false),
  }).default({}),
  security: z.object({
    mfaRequired: z.boolean().default(false),
    sessionLog: z.boolean().default(true),
  }).default({}),
  integrations: z.object({
    openai: z.boolean().default(false),
    github: z.boolean().default(false),
    checks: adminIntegrationChecksSchema,
  }).default({}),
  proximity: z.object({
    /** Meters — how close a worker must be to a Job/FreeProject site for the
     * Time Tracker to prompt/auto-start the clock. */
    radiusMeters: z.number().int().positive().max(2000).default(150),
    /** Minutes — how long a dismissed/auto-started site is skipped before it
     * can trigger the prompt again. */
    cooldownMinutes: z.number().int().positive().max(240).default(20),
  }).default({}),
});

export const adminSettingsPatchSchema = adminSettingsSchema.partial();

export type AdminSettings = z.infer<typeof adminSettingsSchema>;
export type AdminSettingsPatch = z.infer<typeof adminSettingsPatchSchema>;
export type AdminIntegrationId = z.infer<typeof adminIntegrationIdSchema>;
export type AdminIntegrationCheck = z.infer<typeof adminIntegrationCheckSchema>;
export type AdminIntegrationState = z.infer<typeof adminIntegrationStateSchema>;
export type AdminIntegrationStatus = z.infer<typeof adminIntegrationStatusSchema>;
