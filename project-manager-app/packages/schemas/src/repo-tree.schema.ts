import { z } from "zod";
import { repoNodeSchema, type RepoNode } from "./repo-node.schema.js";

export type RepoTreeNode = {
  node: RepoNode;
  children: RepoTreeNode[];
};

export const repoTreeNodeSchema: z.ZodType<RepoTreeNode> = z.lazy(() =>
  z.object({
    node: repoNodeSchema as unknown as z.ZodType<RepoNode>,
    children: z.array(repoTreeNodeSchema)
  })
);

export const repoTreeSchema = z.object({
  root: repoTreeNodeSchema,
  maxDepth: z.number().int().positive().max(8)
});
