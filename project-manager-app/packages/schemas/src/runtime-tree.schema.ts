import { z } from "zod";
import { runtimeNodeSchema, type RuntimeNode } from "./runtime-node.schema.js";

export type RuntimeTreeNode = {
  node: RuntimeNode;
  children: RuntimeTreeNode[];
};

export const runtimeTreeNodeSchema: z.ZodType<RuntimeTreeNode> = z.lazy(() =>
  z.object({
    node: runtimeNodeSchema as unknown as z.ZodType<RuntimeNode>,
    children: z.array(runtimeTreeNodeSchema)
  })
);

export const runtimeTreeSchema = z.object({
  root: runtimeTreeNodeSchema,
  maxDepth: z.number().int().positive().max(8)
});

