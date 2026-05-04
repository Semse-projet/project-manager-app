import { z } from "zod";
import { runtimeIdSchema, runtimeNodeKindSchema } from "./runtime-node.schema.js";
import { runtimeRelationTypeSchema } from "./runtime-relation.schema.js";

export const runtimeQuerySchema = z.object({
  nodeId: runtimeIdSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
  kind: runtimeNodeKindSchema.optional(),
  relationType: runtimeRelationTypeSchema.optional(),
  includeRelations: z.boolean().default(true),
  includePath: z.boolean().default(true),
  maxDepth: z.number().int().positive().max(8).default(4)
});

export type RuntimeQuery = z.infer<typeof runtimeQuerySchema>;

