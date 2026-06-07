import { z } from "zod";

export const runtimeIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, "Invalid runtime id");

export const runtimeNodeKindSchema = z.enum([
  "runtime_root",
  "application_service",
  "worker_service",
  "data_service",
  "storage_service",
  "support_service"
]);

export const runtimeProbeSchema = z.object({
  type: z.enum(["http", "tcp", "internal"]),
  targets: z.array(z.string().trim().min(1).max(240)).min(1).max(8),
  timeoutMs: z.number().int().positive().max(10_000).default(2_500)
});

export const runtimeNodeSchema = z.object({
  id: runtimeIdSchema,
  name: z.string().trim().min(1).max(120),
  kind: runtimeNodeKindSchema,
  description: z.string().trim().min(1).max(600),
  responsibilities: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
  parentId: runtimeIdSchema.nullable(),
  ports: z.array(z.number().int().nonnegative().max(65_535)).max(8).default([]),
  endpoints: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
  aliases: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  healthCheck: runtimeProbeSchema.optional(),
  metadata: z.object({
    source: z.string().trim().min(1).max(120),
    confidence: z.number().min(0).max(1),
    version: z.string().trim().min(1).max(40),
    status: z.enum(["draft", "reviewed", "canonical", "deprecated"])
  })
});

export const runtimeServiceStatusSchema = z.object({
  id: runtimeIdSchema,
  name: z.string().trim().min(1).max(120),
  kind: runtimeNodeKindSchema,
  status: z.enum(["online", "degraded", "offline", "unknown"]),
  checkedAt: z.string().trim().min(1).max(80),
  detail: z.string().trim().min(1).max(400),
  target: z.string().trim().min(1).max(240).optional(),
  latencyMs: z.number().int().nonnegative().max(60_000).optional()
});

export type RuntimeNode = z.infer<typeof runtimeNodeSchema>;
export type RuntimeServiceStatus = z.infer<typeof runtimeServiceStatusSchema>;

