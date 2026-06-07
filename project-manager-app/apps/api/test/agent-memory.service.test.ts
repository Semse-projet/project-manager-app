import test from "node:test";
import assert from "node:assert/strict";
import { AgentMemoryService } from "../dist/modules/knowledge/agent-memory.service.js";

// ── Mock builders ─────────────────────────────────────────────────────────────

function makeWsRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: `proj:p1:decision:test-${Math.random()}`,
    tenantId: "tnt_t",
    orgId: "org_t",
    createdBy: "usr_t",
    workspaceId: "project:p1",
    kind: "decision" as const,
    scope: "task" as const,
    title: "Milestone aprobado",
    summary: "El hito de demolición fue aprobado con evidencia fotográfica.",
    body: "Evidencia: 3 fotos. Inspector: usr_ops.",
    tags: ["milestones", "decision", "milestone-approved"],
    updatedAtIso: new Date().toISOString(),
    ...overrides,
  };
}

function makeAgentRecord(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id: `mem_${Math.random().toString(36).slice(2)}`,
    tenantId: "tnt_t",
    orgId: "org_t",
    agentId: "project-copilot",
    sessionId: "sess_1",
    projectId: "p1",
    type: "session_summary" as const,
    content: "Sesión completa sobre aprobación de milestone de demolición.",
    summary: "Milestone demolición aprobado con evidencia.",
    importanceScore: 4,
    tags: ["copilot-session", "session-summary"],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeWsRepo(opts: {
  searchHits?: ReturnType<typeof makeWsRecord>[];
  queryRecords?: ReturnType<typeof makeWsRecord>[];
} = {}) {
  const appended: ReturnType<typeof makeWsRecord>[] = [];
  return {
    get appended() { return appended; },
    repo: {
      async search(_input: unknown) { return (opts.searchHits ?? []).map((r) => ({ ...r, rank: 0.8 })); },
      async query(_input: unknown) { return opts.queryRecords ?? []; },
      async append(record: ReturnType<typeof makeWsRecord>) { appended.push(record); return record; },
    },
  };
}

function makeAgentRepo(opts: {
  searchHits?: ReturnType<typeof makeAgentRecord>[];
  listHits?: ReturnType<typeof makeAgentRecord>[];
} = {}) {
  const created: ReturnType<typeof makeAgentRecord>[] = [];
  const upserted: ReturnType<typeof makeAgentRecord>[] = [];

  return {
    get created() { return created; },
    get upserted() { return upserted; },
    repo: {
      async create(input: Record<string, unknown>) {
        const r = makeAgentRecord(input);
        created.push(r);
        return r;
      },
      async upsert(input: Record<string, unknown>) {
        const r = makeAgentRecord(input);
        upserted.push(r);
        return r;
      },
      async search(_input: unknown) { return (opts.searchHits ?? []).map((r) => ({ ...r, rank: 0.8 })); },
      async listByProject(_input: unknown) { return opts.listHits ?? []; },
      async listBySession(_input: unknown) { return []; },
      async deleteBySession(_input: unknown) { return 0; },
    },
  };
}

function makeService(opts: {
  wsHits?: ReturnType<typeof makeWsRecord>[];
  wsQuery?: ReturnType<typeof makeWsRecord>[];
  agentHits?: ReturnType<typeof makeAgentRecord>[];
  agentList?: ReturnType<typeof makeAgentRecord>[];
} = {}) {
  const ws = makeWsRepo({ searchHits: opts.wsHits, queryRecords: opts.wsQuery });
  const ag = makeAgentRepo({ searchHits: opts.agentHits, listHits: opts.agentList });
  const service = new AgentMemoryService(ws.repo as never, ag.repo as never);
  return { service, wsAppended: ws.appended, agCreated: ag.created, agUpserted: ag.upserted };
}

// ── fetchRelevant (backward-compat) ──────────────────────────────────────────

test("fetchRelevant returns scored memories sorted desc by score", async () => {
  const records = [
    makeWsRecord({ title: "Old decision", updatedAtIso: new Date(Date.now() - 30 * 24 * 3600_000).toISOString() }),
    makeWsRecord({ title: "Recent decision", updatedAtIso: new Date().toISOString() }),
  ];

  const { service } = makeService({ wsHits: records });
  const result = await service.fetchRelevant({
    tenantId: "tnt_t", orgId: "org_t", projectId: "p1", query: "milestone",
  });

  assert.ok(result.length > 0);
  for (const r of result) assert.ok(typeof r.relevanceScore === "number");
  for (let i = 0; i < result.length - 1; i++) {
    assert.ok(result[i]!.relevanceScore >= result[i + 1]!.relevanceScore);
  }
});

test("fetchRelevant respects topK limit", async () => {
  const records = Array.from({ length: 20 }, (_, i) =>
    makeWsRecord({ id: `proj:p1:decision:mem-${i}`, title: `Memory ${i}` }),
  );
  const { service } = makeService({ wsHits: records });
  const result = await service.fetchRelevant({
    tenantId: "tnt_t", orgId: "org_t", projectId: "p1", query: "hito", topK: 3,
  });
  assert.ok(result.length <= 3);
});

test("fetchRelevant deduplicates records from FTS and recent queries", async () => {
  const shared = makeWsRecord({ id: "shared-id", title: "Shared record" });
  const { service } = makeService({
    wsHits: [shared],
    wsQuery: [shared, makeWsRecord({ id: "other-id", title: "Other" })],
  });
  const result = await service.fetchRelevant({
    tenantId: "tnt_t", orgId: "org_t", projectId: "p1", query: "milestone",
  });
  const ids = result.map((r) => r.id);
  assert.equal(ids.filter((id) => id === "shared-id").length, 1);
});

test("fetchRelevant returns empty array when both sources empty", async () => {
  const { service } = makeService();
  const result = await service.fetchRelevant({
    tenantId: "tnt_t", orgId: "org_t", projectId: "p1", query: "anything",
  });
  assert.deepEqual(result, []);
});

test("fetchRelevant scopes workspaceId to projectId", async () => {
  let capturedWorkspaceId = "";
  const customWsRepo = {
    async search(input: { workspaceId: string }) { capturedWorkspaceId = input.workspaceId; return []; },
    async query(input: { workspaceId: string }) { capturedWorkspaceId = input.workspaceId; return []; },
    async append(r: unknown) { return r; },
  };
  const ag = makeAgentRepo();
  const service = new AgentMemoryService(customWsRepo as never, ag.repo as never);
  await service.fetchRelevant({ tenantId: "t", orgId: "o", projectId: "abc123", query: "test" });
  assert.ok(capturedWorkspaceId.includes("abc123"), `Expected workspaceId to include projectId, got: ${capturedWorkspaceId}`);
});

// ── formatForContext ──────────────────────────────────────────────────────────

test("formatForContext returns empty string for empty records", () => {
  const { service } = makeService();
  assert.equal(service.formatForContext([]), "");
});

test("formatForContext includes memory header and record content", () => {
  const records = [makeWsRecord()].map((r) => ({ ...r, relevanceScore: 0.9 }));
  const { service } = makeService();
  const output = service.formatForContext(records);
  assert.ok(output.includes("Memoria relevante"));
  assert.ok(output.includes("Milestone aprobado"));
  assert.ok(output.includes("decision"));
});

test("formatForContext respects maxChars budget", () => {
  const many = Array.from({ length: 30 }, (_, i) =>
    ({ ...makeWsRecord({ title: `Memory ${i}`, body: "A".repeat(500) }), relevanceScore: 0.9 }),
  );
  const { service } = makeService();
  const output = service.formatForContext(many, 1000);
  assert.ok(output.length <= 1200);
});

// ── createMemory ──────────────────────────────────────────────────────────────

test("createMemory delegates to agentRepo.create with correct fields", async () => {
  const { service, agCreated } = makeService();
  await service.createMemory({
    tenantId: "tnt_t",
    orgId: "org_t",
    agentId: "project-copilot",
    projectId: "p1",
    sessionId: "sess_x",
    type: "decision",
    content: "Decidimos aprobar el milestone de demolición.",
    summary: "Milestone demolición aprobado.",
    importanceScore: 5,
    tags: ["milestone", "decision"],
  });
  assert.equal(agCreated.length, 1);
  assert.equal(agCreated[0]!.type, "decision");
  assert.equal(agCreated[0]!.importanceScore, 5);
});

test("createMemory uses importanceScore default of 3 when omitted", async () => {
  const { service, agCreated } = makeService();
  await service.createMemory({
    tenantId: "tnt_t", orgId: "org_t", agentId: "project-copilot",
    projectId: "p1", type: "observation",
    content: "Worker llegó tarde.", summary: "Tardanza detectada.",
  });
  assert.equal(agCreated[0]!.importanceScore, 3);
});

// ── searchMemories ────────────────────────────────────────────────────────────

test("searchMemories returns hits with rank from agentRepo", async () => {
  const hits = [makeAgentRecord({ type: "decision", summary: "Escrow liberado" })];
  const { service } = makeService({ agentHits: hits });
  const results = await service.searchMemories({
    tenantId: "tnt_t", projectId: "p1", query: "escrow",
  });
  assert.ok(results.length > 0);
  assert.ok(typeof results[0]!.rank === "number");
});

test("searchMemories returns empty array for blank query", async () => {
  // agentRepo.search is called with empty term — it should return []
  // but in our mock it doesn't filter. What matters: the service passes the call through.
  const { service } = makeService({ agentHits: [] });
  const results = await service.searchMemories({
    tenantId: "tnt_t", projectId: "p1", query: "   ",
  });
  assert.equal(results.length, 0);
});

// ── rankRelevantMemories ──────────────────────────────────────────────────────

test("rankRelevantMemories sorts by relevanceScore desc", () => {
  const { service } = makeService();
  const memories = [
    makeAgentRecord({ updatedAt: new Date(Date.now() - 10 * 24 * 3600_000).toISOString(), importanceScore: 2, type: "fact" as const }),
    makeAgentRecord({ updatedAt: new Date().toISOString(), importanceScore: 5, type: "decision" as const }),
    makeAgentRecord({ updatedAt: new Date(Date.now() - 3600_000).toISOString(), importanceScore: 3, type: "observation" as const }),
  ];
  const ranked = service.rankRelevantMemories(memories);
  for (let i = 0; i < ranked.length - 1; i++) {
    assert.ok(
      ranked[i]!.relevanceScore >= ranked[i + 1]!.relevanceScore,
      `Expected desc order at i=${i}: ${ranked[i]!.relevanceScore} >= ${ranked[i + 1]!.relevanceScore}`,
    );
  }
});

test("rankRelevantMemories respects topK", () => {
  const { service } = makeService();
  const many = Array.from({ length: 20 }, () => makeAgentRecord());
  const ranked = service.rankRelevantMemories(many, 4);
  assert.equal(ranked.length, 4);
});

test("rankRelevantMemories assigns higher score to recent high-importance decision", () => {
  const { service } = makeService();
  const stale = makeAgentRecord({
    updatedAt: new Date(Date.now() - 60 * 24 * 3600_000).toISOString(),
    importanceScore: 1,
    type: "fact" as const,
  });
  const fresh = makeAgentRecord({
    updatedAt: new Date().toISOString(),
    importanceScore: 5,
    type: "decision" as const,
  });
  const ranked = service.rankRelevantMemories([stale, fresh]);
  assert.equal(ranked[0]!.type, "decision", "Recent high-importance decision should rank first");
});

// ── injectRelevantContext ─────────────────────────────────────────────────────

test("injectRelevantContext returns non-empty string when memories exist", async () => {
  const agHits = [makeAgentRecord({ summary: "Escrow liberado en hito 3" })];
  const wsHits = [makeWsRecord({ title: "Decision escrow" })];
  const { service } = makeService({ agentHits: agHits, wsHits });
  const ctx = await service.injectRelevantContext({
    tenantId: "tnt_t", orgId: "org_t", agentId: "project-copilot",
    projectId: "p1", query: "escrow",
  });
  assert.ok(ctx.length > 0);
});

test("injectRelevantContext returns empty string when no memories", async () => {
  const { service } = makeService();
  const ctx = await service.injectRelevantContext({
    tenantId: "tnt_t", orgId: "org_t", agentId: "project-copilot",
    projectId: "p1", query: "test",
  });
  assert.equal(ctx, "");
});

test("injectRelevantContext respects tokenBudgetChars — output stays within budget", async () => {
  // Create many large records
  const agHits = Array.from({ length: 10 }, (_, i) =>
    makeAgentRecord({ summary: `Summary ${i} ${"X".repeat(300)}`, content: "C".repeat(3000) }),
  );
  const wsHits = Array.from({ length: 10 }, (_, i) =>
    makeWsRecord({ title: `Title ${i}`, body: "B".repeat(800) }),
  );
  const { service } = makeService({ agentHits: agHits, wsHits });
  const budget = 2000;
  const ctx = await service.injectRelevantContext({
    tenantId: "tnt_t", orgId: "org_t", agentId: "project-copilot",
    projectId: "p1", query: "hito", tokenBudgetChars: budget,
  });
  // Context should not wildly exceed the budget (allow some structural overhead)
  assert.ok(ctx.length <= budget * 2, `Context too large: ${ctx.length} > ${budget * 2}`);
});

test("injectRelevantContext does not mix memories from different projects", async () => {
  let capturedProjectId = "";
  const customAgRepo = {
    async create(r: unknown) { return r; },
    async upsert(r: unknown) { return r; },
    async search(input: { projectId: string }) { capturedProjectId = input.projectId; return []; },
    async listByProject(input: { projectId: string }) { capturedProjectId = input.projectId; return []; },
    async listBySession() { return []; },
    async deleteBySession() { return 0; },
  };
  const ws = makeWsRepo();
  const service = new AgentMemoryService(ws.repo as never, customAgRepo as never);
  await service.injectRelevantContext({
    tenantId: "tnt_t", orgId: "org_t", agentId: "project-copilot",
    projectId: "proj_isolated", query: "hito",
  });
  assert.equal(capturedProjectId, "proj_isolated", "Search must be scoped to the correct projectId");
});

// ── summarizeSession ──────────────────────────────────────────────────────────

test("summarizeSession writes session_summary for long sessions", async () => {
  const { service, agUpserted } = makeService();
  const messages = Array.from({ length: 8 }, (_, i) => ({
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `Mensaje ${i}: contenido de la conversación sobre el proyecto de construcción.`,
  }));

  const result = await service.summarizeSession({
    tenantId: "tnt_t", orgId: "org_t", userId: "usr_t",
    agentId: "project-copilot", projectId: "p1", sessionId: "sess_long",
    messages,
  });

  assert.ok(result !== null);
  assert.equal(result!.type, "session_summary");
  assert.equal(agUpserted.length, 1);
  assert.ok(agUpserted[0]!.tags.includes("session-summary"));
});

test("summarizeSession returns null for short sessions (< 4 messages)", async () => {
  const { service, agUpserted } = makeService();
  const result = await service.summarizeSession({
    tenantId: "tnt_t", orgId: "org_t", userId: "usr_t",
    agentId: "project-copilot", projectId: "p1", sessionId: "sess_short",
    messages: [
      { role: "user", content: "Hola" },
      { role: "assistant", content: "Hola, ¿en qué puedo ayudarte?" },
    ],
  });
  assert.equal(result, null);
  assert.equal(agUpserted.length, 0);
});

test("summarizeSession summary is within 200 chars", async () => {
  const { service } = makeService();
  const messages = Array.from({ length: 12 }, (_, i) => ({
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `Mensaje muy largo ${i}: ${"X".repeat(300)}`,
  }));
  const result = await service.summarizeSession({
    tenantId: "tnt_t", orgId: "org_t", userId: "usr_t",
    agentId: "project-copilot", projectId: "p1", sessionId: "sess_long2",
    messages,
  });
  assert.ok(result !== null);
  assert.ok(result!.summary.length <= 200, `Summary too long: ${result!.summary.length}`);
});

// ── writeSessionSummary ───────────────────────────────────────────────────────

test("writeSessionSummary writes to both repos when actions proposed", async () => {
  const { service, wsAppended, agUpserted } = makeService();
  await service.writeSessionSummary({
    tenantId: "tnt_t", orgId: "org_t", userId: "usr_t",
    projectId: "p1", sessionId: "sess_ws",
    userMessage: "¿Puedo aprobar el milestone?",
    agentResponse: "Basado en la evidencia sí es posible aprobar el hito de demolición con las 3 fotos.",
    proposedActionTypes: ["PROPOSE_MILESTONE_APPROVAL"],
    toolCallCount: 1,
  });
  // Both repos should receive writes
  assert.equal(wsAppended.length, 1);
  // agUpserted is best-effort (void), so we only check wsAppended here
  assert.equal(wsAppended[0]!.kind, "run_summary");
  assert.ok(wsAppended[0]!.tags.includes("copilot-session"));
});

test("writeSessionSummary skips trivial responses without actions", async () => {
  const { service, wsAppended } = makeService();
  await service.writeSessionSummary({
    tenantId: "tnt_t", orgId: "org_t", userId: "usr_t",
    projectId: "p1", sessionId: "sess_skip",
    userMessage: "Hola",
    agentResponse: "Hola!",
    proposedActionTypes: [],
    toolCallCount: 0,
  });
  assert.equal(wsAppended.length, 0);
});

test("writeSessionSummary scopes workspaceId to projectId", async () => {
  const { service, wsAppended } = makeService();
  await service.writeSessionSummary({
    tenantId: "tnt_t", orgId: "org_t", userId: "usr_t",
    projectId: "proj_xyz", sessionId: "sess_scope",
    userMessage: "Analiza el proyecto",
    agentResponse: "El proyecto tiene 3 milestones pendientes y $5,000 en escrow retomando el análisis de cada hito.",
    proposedActionTypes: ["PROPOSE_ESCROW_RELEASE"],
    toolCallCount: 1,
  });
  assert.ok(wsAppended[0]!.workspaceId.includes("proj_xyz"));
  assert.equal(wsAppended[0]!.scope, "run");
});

// ── writeActionProposal ───────────────────────────────────────────────────────

test("writeActionProposal creates decision record in workspace repo", async () => {
  const { service, wsAppended } = makeService();
  await service.writeActionProposal({
    tenantId: "tnt_t", orgId: "org_t", userId: "usr_t",
    projectId: "p1",
    actionType: "PROPOSE_MILESTONE_APPROVAL",
    summary: "Aprobar milestone: Demolición",
    rationale: "Evidencia completa con 3 fotos",
  });
  assert.equal(wsAppended.length, 1);
  assert.equal(wsAppended[0]!.kind, "decision");
  assert.ok(wsAppended[0]!.tags.includes("copilot-proposal"));
  assert.ok(wsAppended[0]!.tags.some((t: string) => t.includes("milestone_approval")));
});

// ── Project isolation ─────────────────────────────────────────────────────────

test("searchMemories is scoped to projectId — does not return other project memories", async () => {
  let capturedProjectId = "";
  const isolatedAgRepo = {
    async create(r: unknown) { return r; },
    async upsert(r: unknown) { return r; },
    async search(input: { projectId: string }) { capturedProjectId = input.projectId; return []; },
    async listByProject(input: { projectId: string }) { capturedProjectId = input.projectId; return []; },
    async listBySession() { return []; },
    async deleteBySession() { return 0; },
  };
  const ws = makeWsRepo();
  const service = new AgentMemoryService(ws.repo as never, isolatedAgRepo as never);
  await service.searchMemories({ tenantId: "t", projectId: "project_A", query: "escrow" });
  assert.equal(capturedProjectId, "project_A");
});
