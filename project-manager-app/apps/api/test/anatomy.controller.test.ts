import test from "node:test";
import assert from "node:assert/strict";
import { AnatomyController } from "../dist/modules/anatomy/anatomy.controller.js";

function createController() {
  return new AnatomyController({
    async getTree() {
      return { node: { id: "body" }, children: [] };
    },
    async getNode(id: string) {
      return { id, name: "Mock Node" };
    },
    async getChildren(id: string) {
      return [{ id: `${id}_child` }];
    },
    async getRelations(id: string) {
      return [{ id: `${id}_relation` }];
    },
    async query(input: Record<string, unknown>) {
      return input;
    },
    async validate() {
      return { valid: true, issues: [] };
    }
  } as never);
}

test("anatomy controller wraps tree responses in API envelope", async () => {
  const controller = createController();
  const result = await controller.tree({ headers: { "x-request-id": "req-anatomy-tree" } } as never);

  assert.equal(result.requestId, "req-anatomy-tree");
  assert.equal(result.data.node.id, "body");
});

test("anatomy controller applies defaults to query payloads", async () => {
  const controller = createController();
  const result = await controller.query(
    { headers: { "x-request-id": "req-anatomy-query" } } as never,
    { search: "mouth" }
  );

  assert.equal(result.requestId, "req-anatomy-query");
  assert.equal(result.data.search, "mouth");
  assert.equal(result.data.includeRelations, true);
  assert.equal(result.data.includePath, true);
  assert.equal(result.data.maxDepth, 4);
});
