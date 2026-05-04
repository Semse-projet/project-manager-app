import test from "node:test";
import assert from "node:assert/strict";
import {
  repoNodeSchema,
  repoQuerySchema,
  repoRelationSchema
} from "@semse/schemas";
import {
  getRepoKnowledgeBase,
  loadRepoSeed
} from "@semse/knowledge";

test("repo seed validates against canonical repo schemas", async () => {
  const seed = await loadRepoSeed();

  assert.equal(seed.namespace, "semse.repo");
  assert.ok(seed.nodes.length >= 8);
  assert.ok(seed.relations.length >= 5);

  for (const node of seed.nodes) {
    assert.equal(repoNodeSchema.parse(node).id, node.id);
  }

  for (const relation of seed.relations) {
    assert.equal(repoRelationSchema.parse(relation).id, relation.id);
  }
});

test("repo knowledge base resolves hierarchy and canonical paths", async () => {
  const knowledgeBase = await getRepoKnowledgeBase();

  assert.deepEqual(
    knowledgeBase.getPathToRoot("packages_knowledge").map((node) => node.id),
    ["semse_root", "project_manager_app", "packages_knowledge"]
  );

  assert.deepEqual(
    knowledgeBase.getChildren("project_manager_app").map((node) => node.id),
    ["apps_api", "apps_web", "packages_schemas", "packages_knowledge", "packages_agents"]
  );

  assert.equal(knowledgeBase.validate().valid, true);
});

test("repo query schema accepts structured workspace lookups", () => {
  const parsed = repoQuerySchema.parse({
    search: "knowledge package",
    includeRelations: true,
    includePath: true,
    maxDepth: 4
  });

  assert.equal(parsed.search, "knowledge package");
  assert.equal(parsed.includeRelations, true);
});
