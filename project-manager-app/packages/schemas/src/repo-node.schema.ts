import { z } from "zod";

export const repoIdSchema = z.string().trim().min(2).max(120).regex(/^[a-z0-9_/-]+$/);

export const repoNodeKindSchema = z.enum([
  "ecosystem",
  "documentation",
  "workspace",
  "application",
  "package",
  "module"
]);

export const repoNodeSchema = z.object({
  id: repoIdSchema,
  name: z.string().trim().min(1).max(120),
  kind: repoNodeKindSchema,
  description: z.string().trim().min(1).max(600),
  responsibilities: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
  parentId: repoIdSchema.nullable(),
  paths: z.array(z.string().trim().min(1).max(240)).min(1).max(12),
  aliases: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  metadata: z.object({
    source: z.string().trim().min(1).max(120),
    confidence: z.number().min(0).max(1),
    version: z.string().trim().min(1).max(40),
    status: z.enum(["draft", "reviewed", "canonical", "deprecated"])
  })
});

export type RepoNode = z.infer<typeof repoNodeSchema>;
