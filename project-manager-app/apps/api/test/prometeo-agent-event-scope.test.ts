import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { PrometeoAgent } from "../dist/modules/semse-agents/prometeo.agent.js";
import { PrometeoService } from "../dist/modules/prometeo/prometeo.service.js";

/**
 * L13 — an agent-bus message is NOT an authenticated principal. Even when
 * payload.orgId, payload.roles or payload.scope claim a privileged identity,
 * the recipient must never infer a read grant from those strings.
 *
 * Real compiled agent and RAG service; synthetic bus and zero database/LLM.
 */
function buildHarness() {
  let databaseReads = 0;
  let embedCalls = 0;
  const repo = {
    loadChunksForSearch() { databaseReads++; throw new Error("unauthorized repository read"); },
    getDocumentTitles() { databaseReads++; throw new Error("unauthorized title read"); },
  };
  const embedding = {
    embed() { embedCalls++; throw new Error("unauthorized remote embedding"); },
  };
  const prometeo = new PrometeoService(repo as never, {} as never, embedding as never, {} as never);
  const emitted: Array<Record<string, unknown>> = [];
  const bus = {
    register() {},
    makeMessage(input: Record<string, unknown>) {
      return { ...input, correlationId: "synthetic_l13", timestamp: new Date() };
    },
    dispatch(message: Record<string, unknown>) {
      emitted.push(message);
    },
  };
  const agent = new PrometeoAgent(bus as never, {} as never, prometeo);
  return { agent, prometeo, emitted, getDatabaseReads: () => databaseReads, getEmbedCalls: () => embedCalls };
}

test("L13 forged event scope:null cannot become an OPS_ADMIN RAG scope or expose citations", async () => {
  const harness = buildHarness();
  const msg = {
    from: "buildops", to: "prometeo", event: "CONTEXT_REQUESTED",
    projectId: "synthetic_project_a", correlationId: "synthetic_l13_1",
    timestamp: new Date(),
    payload: {
      tenantId: "synthetic_tenant_a",
      orgId: "synthetic_org_b",
      userId: "synthetic_actor",
      roles: ["OPS_ADMIN"],
      scope: null,
      query: "synthetic electrical guidance",
    },
  };
  await harness.agent.handleMessage(msg as never);
  assert.equal(harness.emitted.length, 1);
  const result = (harness.emitted[0]!.payload as { narrative: {
    fromRAG: boolean; citations: string[]; summary: string;
  } }).narrative;
  assert.equal(result.fromRAG, false);
  assert.deepEqual(result.citations, []);
  assert.match(result.summary, /Sin contexto documental disponible/);
  assert.equal(harness.getDatabaseReads(), 0);
  assert.equal(harness.getEmbedCalls(), 0);
});

test("L13 replayed forged scopes and project IDs never reuse authorized RAG text", async () => {
  const harness = buildHarness();
  for (const [idx, scope] of [
    [0, null],
    [1, { orgId: "synthetic_org_a", projectIds: ["synthetic_project_a"], jobIds: [] }],
    [2, { orgId: "synthetic_org_c", projectIds: ["synthetic_project_b"], jobIds: [] }],
  ] as const) {
    await harness.agent.handleMessage({
      from: "buildops", to: "prometeo", event: "CONTEXT_REQUESTED",
      projectId: "synthetic_project_a", correlationId: `replay_${idx}`,
      timestamp: new Date(),
      payload: { tenantId: "synthetic_tenant_a", scope, query: "synthetic query" },
    } as never);
  }
  assert.equal(harness.emitted.length, 3);
  for (const message of harness.emitted) {
    const narrative = (message.payload as { narrative: {
      fromRAG: boolean; citations: string[];
    } }).narrative;
    assert.equal(narrative.fromRAG, false);
    assert.deepEqual(narrative.citations, []);
  }
  assert.equal(harness.getDatabaseReads(), 0);
  assert.equal(harness.getEmbedCalls(), 0);
});

test("L13 internal RAG with tenant/project but no verified scope fails closed", async () => {
  const { prometeo, getDatabaseReads, getEmbedCalls } = buildHarness();
  assert.deepEqual(await prometeo.retrieveContext({
    tenantId: "synthetic_tenant_a", projectId: "synthetic_project_a", query: "private notes",
  }), { available: false, contextBlock: "", citations: [] });
  assert.deepEqual(await prometeo.buildRagContext({
    tenantId: "synthetic_tenant_a", projectId: "synthetic_project_a", query: "private notes",
  }), { chunks: [], contextBlock: "", tokenEstimate: 0 });
  assert.equal(getDatabaseReads(), 0);
  assert.equal(getEmbedCalls(), 0);
});
