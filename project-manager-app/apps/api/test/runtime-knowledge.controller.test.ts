import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeKnowledgeController } from "../dist/modules/runtime-knowledge/runtime-knowledge.controller.js";

class RuntimeKnowledgeServiceStub {
  async getTree() {
    return { node: { id: "semse_runtime" }, children: [] };
  }
  async getNode(id: string) {
    return { id };
  }
  async getChildren(id: string) {
    return [{ id: `${id}_child` }];
  }
  async getRelations(id: string) {
    return [{ id: `${id}_relation` }];
  }
  async query() {
    return { node: { id: "api_service" }, answer: "ok" };
  }
  async getServiceStatuses() {
    return [{ id: "api_service", status: "online" }];
  }
}

test("runtime knowledge controller wraps tree and status responses", async () => {
  const controller = new RuntimeKnowledgeController(new RuntimeKnowledgeServiceStub() as never);
  const headers = { "x-request-id": "req-runtime-controller" };

  const tree = await controller.tree({ headers } as never);
  const status = await controller.status({ headers } as never);

  assert.equal(tree.requestId, "req-runtime-controller");
  assert.equal((tree.data as { node: { id: string } }).node.id, "semse_runtime");
  assert.equal((status.data as Array<{ id: string }>)[0]?.id, "api_service");
});

