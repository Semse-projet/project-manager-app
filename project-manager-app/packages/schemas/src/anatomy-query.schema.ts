import { z } from "zod";
import { anatomyIdSchema, anatomyNodeKindSchema } from "./anatomy-node.schema.js";
import { anatomyRelationTypeSchema } from "./anatomy-relation.schema.js";

export const anatomyQuerySchema = z.object({
  nodeId: anatomyIdSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
  kind: anatomyNodeKindSchema.optional(),
  relationType: anatomyRelationTypeSchema.optional(),
  includeRelations: z.boolean().default(true),
  includePath: z.boolean().default(true),
  maxDepth: z.number().int().positive().max(8).default(4)
});

export const anatomyValidationSchema = z.object({
  nodes: z.array(anatomyIdSchema).min(1).max(200).optional()
});

export type AnatomyQuery = z.infer<typeof anatomyQuerySchema>;
export type AnatomyValidationInput = z.infer<typeof anatomyValidationSchema>;

