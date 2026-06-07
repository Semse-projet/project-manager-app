import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeNodeSchema, runtimeRelationSchema, type RuntimeNode, type RuntimeRelation } from "@semse/schemas";

export type RuntimeSeed = {
  namespace: "semse.runtime";
  version: string;
  nodes: RuntimeNode[];
  relations: RuntimeRelation[];
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.resolve(currentDir, "../seed/runtime.seed.json");

export async function loadRuntimeSeed(): Promise<RuntimeSeed> {
  const raw = JSON.parse(await readFile(seedPath, "utf8")) as RuntimeSeed;

  return {
    namespace: "semse.runtime",
    version: raw.version,
    nodes: raw.nodes.map((node) => runtimeNodeSchema.parse(node)),
    relations: raw.relations.map((relation) => runtimeRelationSchema.parse(relation))
  };
}

