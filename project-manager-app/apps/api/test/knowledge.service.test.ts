import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeService } from "../dist/modules/knowledge/knowledge.service.js";

class RuntimeKnowledgeServiceStub {
  async getServiceStatuses() {
    return [
      { id: "api_service", status: "online" },
      { id: "web_service", status: "online" },
      { id: "worker_service", status: "unknown" }
    ];
  }
}

test("knowledge service returns unified overview across master domains", async () => {
  const service = new KnowledgeService(new RuntimeKnowledgeServiceStub() as never);
  const overview = await service.getOverview();

  assert.equal(overview.domains.length >= 3, true);
  assert.equal(overview.totals.onlineServices, 2);
});

