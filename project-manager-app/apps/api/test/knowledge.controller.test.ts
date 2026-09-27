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

// ── C85: agent-memory governance endpoints ───────────────────────────────────

class AgentMemoryServiceStub {
  calls: Array<{ method: string; args: unknown }> = [];
  async getRecentJournal(args: unknown) { this.calls.push({ method: "getRecentJournal", args }); return []; }
  async searchMemories(args: unknown) { this.calls.push({ method: "searchMemories", args }); return []; }
  async getMemoryLineage(args: unknown) { this.calls.push({ method: "getMemoryLineage", args }); return []; }
  async correctMemory(args: unknown) { this.calls.push({ method: "correctMemory", args }); return { id: "mem_corrected" }; }
  async invalidateMemory(args: unknown) { this.calls.push({ method: "invalidateMemory", args }); return { id: "mem_1", status: "invalidated" }; }
  async supersedeMemory(args: unknown) { this.calls.push({ method: "supersedeMemory", args }); }
  async flagMemoryConflict(args: unknown) { this.calls.push({ method: "flagMemoryConflict", args }); }
}

function makeAuthHeaders() {
  return {
    "x-request-id": "req-c85",
    "x-user-id": "usr_admin",
    "x-tenant-id": "tnt_t",
    "x-org-id": "org_t",
    "x-roles": "OPS_ADMIN",
  };
}

test("correctAgentMemory passes actor identity and reason through to the service", async () => {
  const agentMemory = new AgentMemoryServiceStub();
  const controller = new KnowledgeController(undefined as never, undefined as never, undefined as never, agentMemory as never);

  const result = await controller.correctAgentMemory(
    { headers: makeAuthHeaders() } as never,
    "mem_1",
    { content: "dato corregido", reason: "el dato original estaba desactualizado" },
  );

  assert.equal(agentMemory.calls[0]!.method, "correctMemory");
  const args = agentMemory.calls[0]!.args as Record<string, unknown>;
  assert.equal(args.tenantId, "tnt_t");
  assert.equal(args.correctedBy, "usr_admin");
  assert.equal(args.reason, "el dato original estaba desactualizado");
  assert.equal((result.data as { id: string }).id, "mem_corrected");
});

test("invalidateAgentMemory passes actor identity and reason through to the service", async () => {
  const agentMemory = new AgentMemoryServiceStub();
  const controller = new KnowledgeController(undefined as never, undefined as never, undefined as never, agentMemory as never);

  await controller.invalidateAgentMemory({ headers: makeAuthHeaders() } as never, "mem_1", { reason: "falso positivo" });

  assert.equal(agentMemory.calls[0]!.method, "invalidateMemory");
  const args = agentMemory.calls[0]!.args as Record<string, unknown>;
  assert.equal(args.invalidatedBy, "usr_admin");
  assert.equal(args.reason, "falso positivo");
});

test("supersedeAgentMemory and flagAgentMemoryConflict delegate with actor identity", async () => {
  const agentMemory = new AgentMemoryServiceStub();
  const controller = new KnowledgeController(undefined as never, undefined as never, undefined as never, agentMemory as never);

  await controller.supersedeAgentMemory({ headers: makeAuthHeaders() } as never, "mem_old", { newId: "mem_new" });
  await controller.flagAgentMemoryConflict({ headers: makeAuthHeaders() } as never, "mem_a", { conflictsWithId: "mem_b" });

  assert.equal(agentMemory.calls[0]!.method, "supersedeMemory");
  assert.equal((agentMemory.calls[0]!.args as Record<string, unknown>).actorUserId, "usr_admin");
  assert.equal(agentMemory.calls[1]!.method, "flagMemoryConflict");
  assert.equal((agentMemory.calls[1]!.args as Record<string, unknown>).conflictsWithId, "mem_b");
});

