import { z } from "zod";

export const browserMissionStatusSchema = z.enum([
  "DRAFT",
  "PLANNED",
  "WAITING_POLICY",
  "WAITING_APPROVAL",
  "QUEUED",
  "RUNNING",
  "WAITING_HUMAN",
  "VERIFYING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "CANCELLED",
  "EXPIRED"
]);

export const browserEngineSchema = z.enum([
  "DIRECT_API",
  "OBSCURA",
  "PLAYWRIGHT",
  "HUMAN"
]);

export const browserMissionStepActionSchema = z.enum([
  "navigate",
  "click",
  "fill",
  "select",
  "type",
  "press_key",
  "wait",
  "extract",
  "download"
]);

export const browserMissionStepStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED"
]);

export const browserMissionSchema = z.object({
  id: z.string().cuid().optional(),
  tenantId: z.string(),
  actorId: z.string(),
  status: browserMissionStatusSchema,
  goal: z.string().min(1),
  budgetLimit: z.number().nonnegative(),
  budgetSpent: z.number().nonnegative().default(0),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

export const browserMissionStepSchema = z.object({
  id: z.string().cuid().optional(),
  missionId: z.string(),
  stepNumber: z.number().int().positive(),
  actionType: browserMissionStepActionSchema,
  parameters: z.record(z.unknown()),
  engineUsed: browserEngineSchema,
  status: browserMissionStepStatusSchema,
  error: z.string().nullable().optional(),
  evidenceRef: z.string().nullable().optional(),
  createdAt: z.date().optional()
});

export const browserSessionSchema = z.object({
  id: z.string().cuid().optional(),
  missionId: z.string(),
  engine: browserEngineSchema,
  startedAt: z.date().optional(),
  closedAt: z.date().nullable().optional(),
  cookiesRef: z.string().nullable().optional(),
  logs: z.record(z.unknown()).nullable().optional()
});

export type BrowserMissionStatus = z.infer<typeof browserMissionStatusSchema>;
export type BrowserEngine = z.infer<typeof browserEngineSchema>;
export type BrowserMissionStepAction = z.infer<typeof browserMissionStepActionSchema>;
export type BrowserMissionStepStatus = z.infer<typeof browserMissionStepStatusSchema>;
export type BrowserMission = z.infer<typeof browserMissionSchema>;
export type BrowserMissionStep = z.infer<typeof browserMissionStepSchema>;
export type BrowserSession = z.infer<typeof browserSessionSchema>;
