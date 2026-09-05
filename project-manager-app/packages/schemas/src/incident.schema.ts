import { z } from "zod";

// Matches apps/api/src/modules/incidents/incidents.controller.ts's inline
// createIncidentSchema — kept here too so mobile/web clients get the same
// contract instead of hand-typing it.
export const incidentTypeSchema = z.enum(["safety", "damage", "delay", "material", "other"]);
export const incidentSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

export const createIncidentSchema = z.object({
  jobId: z.string().min(1),
  type: incidentTypeSchema,
  severity: incidentSeveritySchema,
  title: z.string().min(1).max(200),
  description: z.string().max(3000).optional()
});

// Matches IncidentRecord in apps/api/src/modules/incidents/incidents.service.ts —
// the shape returned by GET /v1/incidents, GET /v1/incidents/by-job/:jobId, POST /v1/incidents.
export const incidentRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  jobId: z.string().min(1),
  reportedBy: z.string().min(1),
  type: z.string().min(1),
  severity: z.string().min(1),
  status: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export type IncidentType = z.infer<typeof incidentTypeSchema>;
export type IncidentSeverity = z.infer<typeof incidentSeveritySchema>;
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type IncidentRecordView = z.infer<typeof incidentRecordSchema>;
