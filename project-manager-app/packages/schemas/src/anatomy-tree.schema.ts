import { z } from "zod";
import { anatomyNodeSchema, type AnatomyNode } from "./anatomy-node.schema.js";

export type AnatomyTreeNode = {
  node: AnatomyNode;
  children: AnatomyTreeNode[];
};

export const anatomyTreeNodeSchema: z.ZodType<AnatomyTreeNode> = z.lazy(() =>
  z.object({
    node: anatomyNodeSchema as unknown as z.ZodType<AnatomyNode>,
    children: z.array(anatomyTreeNodeSchema)
  })
);

export const anatomyTreeSchema = z.object({
  root: anatomyTreeNodeSchema,
  maxDepth: z.number().int().positive().max(12)
});

export type AnatomyTree = z.infer<typeof anatomyTreeSchema>;
