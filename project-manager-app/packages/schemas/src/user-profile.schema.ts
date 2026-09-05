import { z } from "zod";
import { userProfileUpdateBodySchema } from "./api-input.schema.js";

// Mirrors apps/api/src/modules/users/users.repository.ts's literal unions.
// (api-input.schema.ts's userProfileUpdateBodySchema inlines these same
// enums anonymously — these standalone exports are additive, not a
// duplicate of that schema.)
export const proximityCheckInModeSchema = z.enum(["ask", "auto", "off"]);
export const assistantToneSchema = z.enum(["friendly", "formal", "technical", "executive"]);
export const assistantLanguageSchema = z.enum(["es", "en"]);
export const assistantVerbositySchema = z.enum(["short", "balanced", "detailed"]);

export type ProximityCheckInMode = z.infer<typeof proximityCheckInModeSchema>;
export type AssistantTone = z.infer<typeof assistantToneSchema>;
export type AssistantLanguage = z.infer<typeof assistantLanguageSchema>;
export type AssistantVerbosity = z.infer<typeof assistantVerbositySchema>;

// PATCH /v1/users/me/profile body — reuses the canonical schema
// (api-input.schema.ts) rather than redeclaring it; this is just the
// inferred type, for callers (e.g. apps/mobile) that want it by name.
export type UserProfileUpdateInput = z.infer<typeof userProfileUpdateBodySchema>;

// GET/PATCH /v1/users/me/profile response — matches
// apps/api/src/modules/users/users.repository.ts's UserProfileRecord
// (Date serializes to an ISO string over JSON).
export type UserProfileView = {
  userId: string;
  displayName?: string;
  bio?: string;
  location?: string;
  trades: string[];
  availability: boolean;
  assistantTone?: AssistantTone;
  assistantLanguage?: AssistantLanguage;
  assistantVerbosity?: AssistantVerbosity;
  unifiedMode: boolean;
  expertMode: boolean;
  proximityCheckInMode: ProximityCheckInMode;
  updatedAt: string;
};

// GET /v1/auth/me response — the source of truth for role/tenant/org
// resolution on mobile. Do NOT decode the access token client-side to get
// this data: apps/api/src/common/auth-token.ts is a custom 2-part
// base64url+HMAC format, not a standard JWT, and isn't meant to be parsed
// outside apps/api.
export type AuthMeView = {
  userId: string;
  tenantId: string;
  orgId: string;
  roles: string[];
};
