import { z } from "zod";

export const anatomyNodeKinds = [
  "body",
  "region",
  "subregion",
  "functional_unit",
  "organ",
  "tissue",
  "cell"
] as const;

export const anatomyNodeKindSchema = z.enum(anatomyNodeKinds);

export const anatomyIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, "Invalid anatomy id");

export const anatomyNodeSchema = z.object({
  id: anatomyIdSchema,
  name: z.string().trim().min(1).max(120),
  kind: anatomyNodeKindSchema,
  description: z.string().trim().min(1).max(500).optional(),
  functions: z.array(z.string().trim().min(1).max(200)).default([]),
  parentId: anatomyIdSchema.nullable().optional(),
  aliases: z.array(z.string().trim().min(1).max(120)).default([]),
  metadata: z.object({
    source: z.string().trim().min(1).max(120),
    confidence: z.number().min(0).max(1).default(1),
    version: z.string().trim().min(1).max(40),
    status: z.enum(["draft", "reviewed", "canonical", "deprecated"]).default("canonical")
  })
});

export type AnatomyNodeKind = z.infer<typeof anatomyNodeKindSchema>;
export type AnatomyNode = z.infer<typeof anatomyNodeSchema>;

