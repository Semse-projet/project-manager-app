import { readFile } from "node:fs/promises";
import {
  anatomyNodeSchema,
  anatomyRelationSchema,
  type AnatomyNode,
  type AnatomyRelation
} from "@semse/schemas";

export type AnatomySeed = {
  version: string;
  namespace: "anatomy.human";
  nodes: AnatomyNode[];
  relations: AnatomyRelation[];
};

const anatomySeedSchema = {
  parse(input: unknown): AnatomySeed {
    const value = input as Record<string, unknown>;
    return {
      version: String(value.version),
      namespace: "anatomy.human",
      nodes: Array.isArray(value.nodes) ? value.nodes.map((node) => anatomyNodeSchema.parse(node)) : [],
      relations: Array.isArray(value.relations)
        ? value.relations.map((relation) => anatomyRelationSchema.parse(relation))
        : []
    };
  }
};

export async function loadAnatomySeed(): Promise<AnatomySeed> {
  const seedUrl = new URL("../seed/anatomy.seed.json", import.meta.url);
  const raw = await readFile(seedUrl, "utf8");
  return anatomySeedSchema.parse(JSON.parse(raw));
}

