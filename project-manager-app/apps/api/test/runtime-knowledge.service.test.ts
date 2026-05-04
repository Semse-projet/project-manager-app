import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeKnowledgeService } from "../dist/modules/runtime-knowledge/runtime-knowledge.service.js";

test("runtime knowledge service returns topology and service node detail", async () => {
  const service = new RuntimeKnowledgeService();

  const tree = await service.getTree();
  const node = await service.getNode("api_service");

  assert.equal(tree.node.id, "semse_runtime");
  assert.equal(node.id, "api_service");
});

test("runtime knowledge service answers structured runtime queries", async () => {
  const service = new RuntimeKnowledgeService();
  const result = await service.query({
    search: "redis",
    includeRelations: true,
    includePath: true,
    maxDepth: 4
  });

  assert.equal(result.node?.id, "redis_service");
  assert.equal(result.path.at(-1)?.id, "redis_service");
});

