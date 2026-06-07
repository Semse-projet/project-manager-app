import { z } from "zod";
import { repoIdSchema } from "./repo-node.schema.js";

export const repoRelationTypeSchema = z.enum([
  "contains",
  "canonical_for",
  "documents",
  "implemented_by",
  "depends_on"
]);

export const repoRelationSchema = z.object({
  id: z.string().trim().min(3).max(160).regex(/^[a-z0-9_/-]+$/),
  type: repoRelationTypeSchema,
  sourceId: repoIdSchema,
  targetId: repoIdSchema,
  description: z.string().trim().min(1).max(400),
  metadata: z.object({
    source: z.string().trim().min(1).max(120),
    confidence: z.number().min(0).max(1),
    version: z.string().trim().min(1).max(40)
  })
});

export type RepoRelation = z.infer<typeof repoRelationSchema>;
