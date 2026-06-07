import { readFile } from "node:fs/promises";
import {
  repoNodeSchema,
  repoRelationSchema
} from "@semse/schemas";
import { z } from "zod";

export const repoSeedSchema = z.object({
  namespace: z.literal("semse.repo"),
  version: z.string().trim().min(1).max(40),
  nodes: z.array(repoNodeSchema).min(1),
  relations: z.array(repoRelationSchema).min(1)
});

export type RepoSeed = z.infer<typeof repoSeedSchema>;

export async function loadRepoSeed(): Promise<RepoSeed> {
  const fileUrl = new URL("../seed/repo.seed.json", import.meta.url);
  const raw = await readFile(fileUrl, "utf8");
  return repoSeedSchema.parse(JSON.parse(raw));
}
