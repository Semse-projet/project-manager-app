import { z } from "zod";
import { runtimeIdSchema } from "./runtime-node.schema.js";

export const runtimeRelationTypeSchema = z.enum([
  "contains",
  "depends_on",
  "feeds",
  "observes"
]);

export const runtimeRelationSchema = z.object({
  id: z.string().trim().min(3).max(160).regex(/^[a-z0-9_/-]+$/),
  type: runtimeRelationTypeSchema,
  sourceId: runtimeIdSchema,
  targetId: runtimeIdSchema,
  description: z.string().trim().min(1).max(400),
  metadata: z.object({
    source: z.string().trim().min(1).max(120),
    confidence: z.number().min(0).max(1),
    version: z.string().trim().min(1).max(40)
  })
});

export type RuntimeRelation = z.infer<typeof runtimeRelationSchema>;

