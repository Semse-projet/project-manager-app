import test from "node:test";
import assert from "node:assert/strict";
import { RepoKnowledgeController } from "../dist/modules/repo-knowledge/repo-knowledge.controller.js";

function createController() {
  return new RepoKnowledgeController({
    async getTree() {
      return { node: { id: "semse_root" }, children: [] };
    },
    async getNode(id: string) {
      return { id, name: "Mock Repo Node" };
    },
    async getChildren(id: string) {
      return [{ id: `${id}_child` }];
    },
    async getRelations(id: string) {
      return [{ id: `${id}_relation` }];
    },
    async query(input: Record<string, unknown>) {
      return input;
    }
  } as never);
}

test("repo knowledge controller wraps tree responses in API envelope", async () => {
  const controller = createController();
  const result = await controller.tree({ headers: { "x-request-id": "req-repo-tree" } } as never);

  assert.equal(result.requestId, "req-repo-tree");
  assert.equal(result.data.node.id, "semse_root");
});

test("repo knowledge controller applies defaults to query payloads", async () => {
  const controller = createController();
  const result = await controller.query(
    { headers: { "x-request-id": "req-repo-query" } } as never,
    { search: "knowledge package" }
  );

  assert.equal(result.requestId, "req-repo-query");
  assert.equal(result.data.search, "knowledge package");
  assert.equal(result.data.includeRelations, true);
  assert.equal(result.data.includePath, true);
  assert.equal(result.data.maxDepth, 4);
});
