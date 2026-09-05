import { z } from "zod";

export const createMaterialRequestSchema = z.object({
  jobId: z.string().min(1),
  milestone: z.string().min(1).optional(),
  item: z.string().min(1).max(200),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(40),
  estimatedCost: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional()
});

// Matches MaterialRequestRecord in apps/api/src/modules/materials/materials.service.ts —
// the shape returned by GET /v1/materials, GET /v1/materials/by-job/:jobId, POST /v1/materials.
export const materialRequestRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  jobId: z.string().min(1),
  requestedBy: z.string().min(1),
  milestone: z.string().nullable(),
  item: z.string().min(1),
  quantity: z.number(),
  unit: z.string().min(1),
  estimatedCost: z.number().nullable(),
  status: z.string().min(1),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export type CreateMaterialRequestInput = z.infer<typeof createMaterialRequestSchema>;
export type MaterialRequestRecordView = z.infer<typeof materialRequestRecordSchema>;
