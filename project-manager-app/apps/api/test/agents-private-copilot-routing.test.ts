import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { AgentsService } from "../dist/modules/agents/agents.service.js";

function service() {
  const forwarded: Array<Record<string, unknown>> = [];
  const llm = {
    isAvailable: true,
    async chatWithTools(input: Record<string, unknown>) {
      forwarded.push(input);
      return {
        text: "Local model response", toolCalls: [],
        mode: "llm", provider: "ollama", model: "qwen-local",
      };
    },
  };
  const svc = new AgentsService(
    {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, llm as never, {} as never,
  );
  return { svc, forwarded };
}

test("private Project Copilot tool chats propagate a hard local-only/critical policy to the LLM facade", async () => {
  const { svc, forwarded } = service();
  const reply = await svc.chatWithTools({
    tenantId: "tenant-A", userId: "user-A", agentId: "project-copilot", projectId: "project-A",
    message: "Summarize project evidence",
    context: { prometeoContext: "CONFIDENTIAL_OWNER_ONLY_DOC" },
    localOnly: true,
    tools: [],
  });
  assert.equal(reply.provider, "ollama");
  assert.equal(forwarded.length, 1);
  assert.deepEqual(forwarded[0].context, {
    requiresTools: true, localOnly: true, privacyCritical: true,
    agentName: "project-copilot", source: "private-project-copilot",
  });
  assert.ok(JSON.stringify(forwarded[0]).includes("CONFIDENTIAL_OWNER_ONLY_DOC"));
});

test("other existing agent tool chats retain their regular default routing contract", async () => {
  const { svc, forwarded } = service();
  await svc.chatWithTools({
    tenantId: "tenant-A", userId: "user-A", agentId: "generic",
    message: "A generic non-private request", tools: [],
  });
  assert.deepEqual(forwarded[0].context, { requiresTools: true });
});

test("project-copilot tool calls cannot disable private local inference even with localOnly=false", async () => {
  const { svc, forwarded } = service();
  await svc.chatWithTools({
    tenantId: "tenant-A", userId: "user-A", agentId: "project-copilot",
    projectId: "project-A", message: "Show confidential project evidence",
    context: { prometeoContext: "PRIVATE" }, localOnly: false, tools: [],
  });
  assert.equal(forwarded.length, 1);
  assert.deepEqual(forwarded[0].context, {
    requiresTools: true, localOnly: true, privacyCritical: true,
    agentName: "project-copilot", source: "private-project-copilot",
  });
});
