import { z } from "zod";
import { anatomyIdSchema } from "./anatomy-node.schema.js";

export const anatomyRelationTypes = [
  "part_of",
  "contains",
  "connected_to",
  "functionally_related_to",
  "depends_on"
] as const;

export const anatomyRelationTypeSchema = z.enum(anatomyRelationTypes);

export const anatomyRelationSchema = z.object({
  id: z.string().trim().min(3).max(160),
  type: anatomyRelationTypeSchema,
  sourceId: anatomyIdSchema,
  targetId: anatomyIdSchema,
  description: z.string().trim().min(1).max(300).optional(),
  metadata: z.object({
    source: z.string().trim().min(1).max(120),
    confidence: z.number().min(0).max(1).default(1),
    version: z.string().trim().min(1).max(40)
  })
});

export type AnatomyRelationType = z.infer<typeof anatomyRelationTypeSchema>;
export type AnatomyRelation = z.infer<typeof anatomyRelationSchema>;

