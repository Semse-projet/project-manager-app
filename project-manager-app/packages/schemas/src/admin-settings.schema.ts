import { z } from "zod";

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
