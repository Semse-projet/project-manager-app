import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeController } from "../dist/modules/knowledge/knowledge.controller.js";

class KnowledgeServiceStub {
  async getDomains() {
    return [{ id: "semse.runtime" }];
  }
  async getOverview() {
    return { totals: { domains: 3 } };
  }
}

test("knowledge controller wraps domains and overview", async () => {
  const controller = new KnowledgeController(new KnowledgeServiceStub() as never);
  const headers = { "x-request-id": "req-knowledge-controller" };

  const domains = await controller.domains({ headers } as never);
  const overview = await controller.overview({ headers } as never);

  assert.equal(domains.requestId, "req-knowledge-controller");
  assert.equal((domains.data as Array<{ id: string }>)[0]?.id, "semse.runtime");
  assert.equal((overview.data as { totals: { domains: number } }).totals.domains, 3);
});

