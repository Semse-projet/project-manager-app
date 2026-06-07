import { z } from "zod";
import { repoIdSchema, repoNodeKindSchema } from "./repo-node.schema.js";
import { repoRelationTypeSchema } from "./repo-relation.schema.js";

export const repoQuerySchema = z.object({
  nodeId: repoIdSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
  kind: repoNodeKindSchema.optional(),
  relationType: repoRelationTypeSchema.optional(),
  includeRelations: z.boolean().default(true),
  includePath: z.boolean().default(true),
  maxDepth: z.number().int().positive().max(8).default(4)
});

export type RepoQuery = z.infer<typeof repoQuerySchema>;
