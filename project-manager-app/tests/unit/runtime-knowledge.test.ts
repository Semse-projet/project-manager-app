import test from "node:test";
import assert from "node:assert/strict";
import { getRuntimeKnowledgeBase, listKnowledgeDomains } from "@semse/knowledge";
import { runMasterDomainTutorAgent } from "@semse/agents/master-domains";

test("runtime knowledge base exposes canonical service topology", async () => {
  const knowledgeBase = await getRuntimeKnowledgeBase();
  const runtimeRoot = knowledgeBase.getNodeById("semse_runtime");
  const services = knowledgeBase.getChildren("semse_runtime");

  assert.equal(runtimeRoot?.id, "semse_runtime");
  assert.equal(services.some((service) => service.id === "api_service"), true);
});

test("knowledge catalog lists master domains and tutor resolves runtime node", async () => {
  const catalog = listKnowledgeDomains();
  const result = await runMasterDomainTutorAgent({
    domainId: "semse.runtime",
    query: "api health"
  });

  assert.equal(catalog.length >= 3, true);
  assert.equal(result.node?.id, "api_service");
});

