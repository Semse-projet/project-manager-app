import { z } from "zod";
import { evidenceKindSchema } from "./marketplace.schema.js";

export const presignEvidenceSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  fileSizeBytes: z.number().int().positive().max(1024 * 1024 * 1024 * 20).optional(),
  source: z
    .enum(["local_device", "camera_capture", "field_ops", "project_copilot", "external_transfer"])
    .optional()
});

export const uploadPlanSchema = z.object({
  domain: z.enum(["evidence", "contract", "dispute", "travel"]),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  fileSizeBytes: z.number().int().positive().max(1024 * 1024 * 1024 * 20),
  source: z
    .enum(["local_device", "camera_capture", "field_ops", "project_copilot", "external_transfer"])
    .optional()
});

export const multipartUploadSessionCreateSchema = uploadPlanSchema.extend({
  source: z
    .enum(["local_device", "camera_capture", "field_ops", "project_copilot", "external_transfer"])
    .default("external_transfer")
});

export const multipartUploadSessionCompleteSchema = z.object({
  sessionId: z.string().min(1),
  parts: z.array(z.object({
    partNumber: z.number().int().positive(),
    etag: z.string().min(1)
  })).min(1)
});

export const registerEvidenceSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    jobId: z.string().min(1).optional(),
    milestoneId: z.string().min(1).optional(),
    key: z.string().min(1),
    kind: evidenceKindSchema,
    filename: z.string().min(1).max(300).optional()
  })
  .refine((input) => Boolean(input.projectId || input.jobId || input.milestoneId), {
    message: "One of projectId, jobId or milestoneId is required",
    path: ["jobId"]
  })
  .refine((input) => !(input.projectId && !input.jobId && !input.milestoneId), {
    message: "projectId-only registration is legacy; prefer jobId or milestoneId for new flows",
    path: ["projectId"]
  });

// Matches EvidenceView in apps/api/src/modules/evidence/evidence.repository.ts —
// the shape returned by GET /v1/jobs/:jobId/evidence and POST /v1/evidence.
export const evidenceRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  jobId: z.string().min(1),
  milestoneId: z.string().min(1).optional(),
  uploadedById: z.string().min(1),
  kind: evidenceKindSchema,
  key: z.string().min(1),
  filename: z.string().min(1).optional(),
  validationStatus: z.string().min(1),
  aiQualityScore: z.number().nullable().optional(),
  createdAt: z.string().min(1)
});

export type PresignEvidenceInput = z.infer<typeof presignEvidenceSchema>;
export type UploadPlanInput = z.infer<typeof uploadPlanSchema>;
export type MultipartUploadSessionCreateInput = z.infer<typeof multipartUploadSessionCreateSchema>;
export type MultipartUploadSessionCompleteInput = z.infer<typeof multipartUploadSessionCompleteSchema>;
export type RegisterEvidenceInput = z.infer<typeof registerEvidenceSchema>;
export type EvidenceRecordView = z.infer<typeof evidenceRecordSchema>;
