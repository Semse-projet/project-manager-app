import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// @semse/schemas — professional.schema.ts
//
// Zod schemas for the Professional domain.
// TypeScript interfaces live in client.types.ts.
// These schemas are for API input validation & BFF parsing.
// ─────────────────────────────────────────────────────────────────────────────

// ── Skills ────────────────────────────────────────────────────────────────────

export const skillLevelSchema = z.enum(["beginner", "intermediate", "advanced", "expert"]);
export type SkillLevel = z.infer<typeof skillLevelSchema>;

export const skillSchema = z.object({
  id:                z.string().min(1),
  name:              z.string().min(1).max(120),
  category:          z.string().min(1).max(80),
  level:             skillLevelSchema,
  yearsOfExperience: z.number().int().nonnegative().max(50),
  verified:          z.boolean().optional(),
});

// ── Portfolio ─────────────────────────────────────────────────────────────────

export const portfolioItemSchema = z.object({
  id:          z.string().min(1),
  title:       z.string().min(1).max(140),
  description: z.string().max(1000).optional(),
  category:    z.string().max(80).optional(),
  images:      z.array(z.string().url()).max(20).default([]),
  url:         z.string().url().optional(),
  completedAt: z.coerce.date().optional(),
});

// ── Certifications ────────────────────────────────────────────────────────────

export const certificationSchema = z.object({
  id:          z.string().min(1),
  name:        z.string().min(1).max(140),
  issuer:      z.string().max(140).optional(),
  issuedAt:    z.coerce.date().optional(),
  expiresAt:   z.coerce.date().optional(),
  url:         z.string().url().optional(),
  verified:    z.boolean().default(false),
});

// ── Work Experience ───────────────────────────────────────────────────────────

export const workExperienceSchema = z.object({
  id:          z.string().min(1),
  company:     z.string().min(1).max(140),
  role:        z.string().min(1).max(140),
  description: z.string().max(1000).optional(),
  startDate:   z.coerce.date(),
  endDate:     z.coerce.date().optional(),
  current:     z.boolean().default(false),
  location:    z.string().max(140).optional(),
});

// ── Education ─────────────────────────────────────────────────────────────────

export const educationSchema = z.object({
  id:          z.string().min(1),
  institution: z.string().min(1).max(140),
  degree:      z.string().max(140).optional(),
  field:       z.string().max(140).optional(),
  startYear:   z.number().int().min(1950).max(2100).optional(),
  endYear:     z.number().int().min(1950).max(2100).optional(),
});

// ── Language ──────────────────────────────────────────────────────────────────

export const languageProficiencySchema = z.enum(["basic", "intermediate", "advanced", "native"]);

export const languageSchema = z.object({
  code:        z.string().min(2).max(10),
  name:        z.string().min(1).max(80),
  proficiency: languageProficiencySchema,
});

// ── Availability ─────────────────────────────────────────────────────────────

export const availabilityTypeSchema = z.enum(["full_time", "part_time", "freelance", "unavailable"]);

export const availabilitySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6), // 0=Sunday
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM format expected"),
  endTime:   z.string().regex(/^\d{2}:\d{2}$/, "HH:MM format expected"),
});

// ── Tools ─────────────────────────────────────────────────────────────────────

export const toolCategorySchema = z.enum([
  "design",
  "development",
  "communication",
  "project_management",
  "analytics",
  "construction",
  "safety",
  "other",
]);

export const professionalToolSchema = z.object({
  id:          z.string().min(1),
  name:        z.string().min(1).max(100),
  category:    toolCategorySchema,
  proficiency: skillLevelSchema,
  icon:        z.string().max(200).optional(),
});

// ── Filter & Search ───────────────────────────────────────────────────────────

export const professionalFilterSchema = z.object({
  skills:        z.array(z.string()).max(20).optional(),
  categories:    z.array(z.string()).max(10).optional(),
  minRating:     z.number().min(0).max(5).optional(),
  maxHourlyRate: z.number().nonnegative().optional(),
  availability:  availabilityTypeSchema.optional(),
  location:      z.string().max(140).optional(),
  languages:     z.array(z.string()).max(10).optional(),
  verified:      z.boolean().optional(),
  page:          z.number().int().positive().default(1),
  pageSize:      z.number().int().positive().max(50).default(20),
});

export type ProfessionalFilterInput = z.infer<typeof professionalFilterSchema>;

// ── Profile update ────────────────────────────────────────────────────────────

export const updateProfessionalProfileSchema = z.object({
  bio:            z.string().max(2000).optional(),
  phone:          z.string().max(30).optional(),
  location:       z.string().max(140).optional(),
  hourlyRate:     z.number().nonnegative().optional(),
  availability:   availabilityTypeSchema.optional(),
  skills:         z.array(skillSchema).max(50).optional(),
  portfolio:      z.array(portfolioItemSchema).max(30).optional(),
  certifications: z.array(certificationSchema).max(30).optional(),
  experience:     z.array(workExperienceSchema).max(20).optional(),
  education:      z.array(educationSchema).max(10).optional(),
  languages:      z.array(languageSchema).max(15).optional(),
  tools:          z.array(professionalToolSchema).max(40).optional(),
});

export type UpdateProfessionalProfileInput = z.infer<typeof updateProfessionalProfileSchema>;

// ── Dashboard data ────────────────────────────────────────────────────────────

export const earningsPeriodSchema = z.enum(["week", "month", "quarter", "year", "all"]);
export type EarningsPeriod = z.infer<typeof earningsPeriodSchema>;

// ── Exports ───────────────────────────────────────────────────────────────────

export {
  skillSchema     as ProfessionalSkillSchema,
  portfolioItemSchema as PortfolioItemSchema,
  certificationSchema as CertificationSchema,
  workExperienceSchema as WorkExperienceSchema,
  educationSchema as EducationSchema,
  languageSchema  as LanguageSchema,
  availabilitySlotSchema as AvailabilitySlotSchema,
  professionalToolSchema as ProfessionalToolSchema,
  professionalFilterSchema as ProfessionalFilterSchema,
  updateProfessionalProfileSchema as UpdateProfessionalProfileSchema,
};
