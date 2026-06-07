import test from "node:test";
import assert from "node:assert/strict";
import { RepoKnowledgeService } from "../dist/modules/repo-knowledge/repo-knowledge.service.js";

test("repo knowledge service returns canonical tree and node detail", async () => {
  const service = new RepoKnowledgeService();

  const tree = await service.getTree();
  const node = await service.getNode("packages_knowledge");

  assert.equal(tree.node.id, "semse_root");
  assert.equal(node.id, "packages_knowledge");
});

test("repo knowledge service answers structured workspace queries", async () => {
  const service = new RepoKnowledgeService();

  const result = await service.query({
    search: "knowledge package",
    includeRelations: true,
    includePath: true,
    maxDepth: 4
  });

  assert.equal(result.node?.id, "packages_knowledge");
  assert.deepEqual(result.path.map((node) => node.id), ["semse_root", "project_manager_app", "packages_knowledge"]);
});
