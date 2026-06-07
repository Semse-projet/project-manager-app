import { Injectable, Logger } from "@nestjs/common";
import { buildWorkspaceMemoryId, type WorkspaceMemoryKind, type WorkspaceMemoryRecord } from "@semse/knowledge";
import type { AgentMemoryRecord, AgentMemoryType } from "./agent-memory.repository.js";
import { AgentMemoryRepository } from "./agent-memory.repository.js";
import { WorkspaceMemoryRepository } from "./workspace-memory.repository.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_MEMORIES_TO_INJECT = 6;
const MAX_CONTEXT_CHARS = 4_000;   // ≈ 1 000 tokens at 4 chars/token
const TOKEN_BUDGET_CHARS = 8_000;  // hard ceiling for injectRelevantContext

const KIND_IMPORTANCE: Record<WorkspaceMemoryKind, number> = {
  decision:      1.0,
  run_summary:   0.9,
  task_state:    0.75,
  runtime_fact:  0.70,
  repo_fact:     0.60,
  operator_note: 0.50,
};

const TYPE_IMPORTANCE: Record<AgentMemoryType, number> = {
  decision:        1.0,
  action_proposal: 0.9,
  session_summary: 0.75,
  observation:     0.60,
  fact:            0.55,
  event:           0.40,
};

// ── Public types ──────────────────────────────────────────────────────────────

export type ScoredMemory = WorkspaceMemoryRecord & { relevanceScore: number };

export type ScoredAgentMemory = AgentMemoryRecord & { relevanceScore: number };

export type FetchRelevantInput = {
  tenantId: string;
  orgId: string;
  projectId: string;
  query: string;
  topK?: number;
  maxChars?: number;
};

export type WriteSessionSummaryInput = {
  tenantId: string;
  orgId: string;
  userId: string;
  projectId: string;
  sessionId: string;
  userMessage: string;
  agentResponse: string;
  proposedActionTypes: string[];
  toolCallCount: number;
};

export type CreateMemoryInput = {
  tenantId: string;
  orgId: string;
  agentId: string;
  sessionId?: string;
  projectId?: string;
  type: AgentMemoryType;
  content: string;
  summary: string;
  importanceScore?: number;
  tags?: string[];
  sourceRef?: string;
};

export type InjectContextInput = {
  tenantId: string;
  orgId: string;
  agentId: string;
  projectId: string;
  query: string;
  tokenBudgetChars?: number;
  topK?: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function recencyScore(iso: string): number {
  const ageHours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (ageHours < 1)   return 1.00;
  if (ageHours < 24)  return 0.85;
  if (ageHours < 168) return 0.65;
  if (ageHours < 720) return 0.45;
  return 0.25;
}

function computeWorkspaceScore(record: WorkspaceMemoryRecord, ftsRank: number): number {
  const k = KIND_IMPORTANCE[record.kind] ?? 0.5;
  const r = recencyScore(record.updatedAtIso);
  return ftsRank * 0.40 + r * 0.35 + k * 0.25;
}

function computeAgentScore(record: AgentMemoryRecord, ftsRank: number): number {
  const k = TYPE_IMPORTANCE[record.type] ?? 0.5;
  const r = recencyScore(record.updatedAt);
  const importance = (record.importanceScore / 5) * 0.20;
  return ftsRank * 0.35 + r * 0.30 + k * 0.20 + importance;
}

function estimateChars(record: WorkspaceMemoryRecord | AgentMemoryRecord): number {
  if ("kind" in record) {
    return (record.title?.length ?? 0) + (record.summary?.length ?? 0) + (record.body?.length ?? 0) + 60;
  }
  return (record.summary?.length ?? 0) + Math.min(record.content?.length ?? 0, 300) + 60;
}

function formatWorkspaceBlock(records: ScoredMemory[]): string {
  if (records.length === 0) return "";
  const lines = records.map((m) => [
    `[${m.kind}] ${m.title}`,
    `> ${m.summary}`,
    m.body ? m.body.slice(0, 300) : "",
    `Actualizado: ${new Date(m.updatedAtIso).toLocaleDateString("es-MX")}`,
  ].filter(Boolean).join("\n"));
  return `## Contexto del proyecto\n\n${lines.join("\n\n")}`;
}

function formatAgentBlock(records: ScoredAgentMemory[]): string {
  if (records.length === 0) return "";
  const lines = records.map((m) => [
    `[${m.type}] ${m.summary}`,
    m.content.slice(0, 300),
    m.tags.length ? `Etiquetas: ${m.tags.join(", ")}` : "",
    `Importancia: ${m.importanceScore}/5 · ${new Date(m.updatedAt).toLocaleDateString("es-MX")}`,
  ].filter(Boolean).join("\n"));
  return `## Memoria del agente\n\n${lines.join("\n\n")}`;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class AgentMemoryService {
  private readonly logger = new Logger(AgentMemoryService.name);

  constructor(
    private readonly repo: WorkspaceMemoryRepository,
    private readonly agentRepo: AgentMemoryRepository,
  ) {}

  // ── createMemory ──────────────────────────────────────────────────────────

  async createMemory(input: CreateMemoryInput): Promise<AgentMemoryRecord> {
    return this.agentRepo.create({
      tenantId: input.tenantId,
      orgId: input.orgId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      projectId: input.projectId,
      type: input.type,
      content: input.content,
      summary: input.summary,
      importanceScore: input.importanceScore ?? 3,
      tags: input.tags ?? [],
      sourceRef: input.sourceRef,
    });
  }

  // ── searchMemories ────────────────────────────────────────────────────────

  async searchMemories(input: {
    tenantId: string;
    projectId: string;
    query: string;
    agentId?: string;
    types?: AgentMemoryType[];
    limit?: number;
  }): Promise<Array<AgentMemoryRecord & { rank: number }>> {
    return this.agentRepo.search({
      tenantId: input.tenantId,
      projectId: input.projectId,
      term: input.query,
      agentId: input.agentId,
      types: input.types,
      limit: input.limit ?? 20,
    });
  }

  // ── rankRelevantMemories ──────────────────────────────────────────────────

  rankRelevantMemories(
    memories: Array<AgentMemoryRecord & { rank?: number }>,
    topK = MAX_MEMORIES_TO_INJECT,
  ): ScoredAgentMemory[] {
    const scored = memories.map((m) => ({
      ...m,
      relevanceScore: computeAgentScore(m, m.rank ?? 0.3),
    }));
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return scored.slice(0, topK);
  }

  // ── injectRelevantContext ─────────────────────────────────────────────────

  async injectRelevantContext(input: InjectContextInput): Promise<string> {
    const budget = input.tokenBudgetChars ?? TOKEN_BUDGET_CHARS;
    const topK = input.topK ?? MAX_MEMORIES_TO_INJECT;

    const [ftsAgentResults, recentAgentResults, ftsWsResults, recentWsResults] = await Promise.all([
      input.query.trim().length > 2
        ? this.agentRepo.search({ tenantId: input.tenantId, projectId: input.projectId, term: input.query, limit: topK * 3 })
        : Promise.resolve([] as Array<AgentMemoryRecord & { rank: number }>),
      this.agentRepo.listByProject({ tenantId: input.tenantId, projectId: input.projectId, limit: topK * 2 }),
      input.query.trim().length > 2
        ? this.repo.search({ tenantId: input.tenantId, workspaceId: `project:${input.projectId}`, term: input.query, limit: topK * 2 })
        : Promise.resolve([] as Array<WorkspaceMemoryRecord & { rank: number }>),
      this.repo.query({ tenantId: input.tenantId, orgId: input.orgId, workspaceId: `project:${input.projectId}`, kinds: ["decision", "run_summary"] }),
    ]);

    const seenAgent = new Set<string>();
    const agentCandidates: ScoredAgentMemory[] = [];
    for (const r of ftsAgentResults) {
      if (seenAgent.has(r.id)) continue;
      seenAgent.add(r.id);
      agentCandidates.push({ ...r, relevanceScore: computeAgentScore(r, r.rank) });
    }
    for (const r of recentAgentResults) {
      if (seenAgent.has(r.id)) continue;
      seenAgent.add(r.id);
      agentCandidates.push({ ...r, relevanceScore: computeAgentScore(r, 0.3) });
    }
    agentCandidates.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const seenWs = new Set<string>();
    const wsCandidates: ScoredMemory[] = [];
    for (const r of ftsWsResults) {
      if (seenWs.has(r.id)) continue;
      seenWs.add(r.id);
      wsCandidates.push({ ...r, relevanceScore: computeWorkspaceScore(r, r.rank ?? 0.5) });
    }
    for (const r of recentWsResults) {
      if (seenWs.has(r.id)) continue;
      seenWs.add(r.id);
      wsCandidates.push({ ...r, relevanceScore: computeWorkspaceScore(r, 0.3) });
    }
    wsCandidates.sort((a, b) => b.relevanceScore - a.relevanceScore);

    let usedChars = 0;
    const selectedAgent: ScoredAgentMemory[] = [];
    const selectedWs: ScoredMemory[] = [];

    for (const r of agentCandidates.slice(0, topK)) {
      const cost = estimateChars(r);
      if (usedChars + cost > budget) break;
      selectedAgent.push(r);
      usedChars += cost;
    }
    for (const r of wsCandidates.slice(0, topK)) {
      const cost = estimateChars(r);
      if (usedChars + cost > budget) break;
      selectedWs.push(r);
      usedChars += cost;
    }

    this.logger.debug(
      `[inject] project=${input.projectId} agent=${selectedAgent.length} ws=${selectedWs.length} chars=${usedChars}/${budget}`,
    );

    const blocks = [
      formatAgentBlock(selectedAgent),
      formatWorkspaceBlock(selectedWs),
    ].filter(Boolean);

    return blocks.join("\n\n");
  }

  // ── getRecentJournal ────────────────────────────────────────────────────────

  async getRecentJournal(input: {
    tenantId: string;
    projectId: string;
    limit?: number;
  }): Promise<AgentMemoryRecord[]> {
    return this.agentRepo.listByProject({
      tenantId: input.tenantId,
      projectId: input.projectId,
      limit: input.limit ?? 10,
    });
  }

  // ── summarizeSession ──────────────────────────────────────────────────────

  async summarizeSession(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    agentId: string;
    projectId: string;
    sessionId: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  }): Promise<AgentMemoryRecord | null> {
    if (input.messages.length < 4) return null;

    const userTurns = input.messages.filter((m) => m.role === "user");
    const assistantTurns = input.messages.filter((m) => m.role === "assistant");

    const firstUserMsg = userTurns[0]?.content.slice(0, 120) ?? "";
    const lastUserMsg = userTurns[userTurns.length - 1]?.content.slice(0, 120) ?? "";
    const lastAssistantMsg = assistantTurns[assistantTurns.length - 1]?.content.slice(0, 300) ?? "";

    const summaryText = `Sesión ${input.messages.length} mensajes. Primera: "${firstUserMsg}". Última: "${lastUserMsg}"`.slice(0, 200);

    const content = [
      `Sesión: ${input.sessionId}`,
      `Turnos usuario: ${userTurns.length}`,
      `Primera pregunta: ${firstUserMsg}`,
      `Última pregunta: ${lastUserMsg}`,
      `Última respuesta del agente: ${lastAssistantMsg}`,
    ].join("\n");

    const memId = `mem_session_${input.sessionId}`;

    try {
      const record = await this.agentRepo.upsert({
        id: memId,
        tenantId: input.tenantId,
        orgId: input.orgId,
        agentId: input.agentId,
        sessionId: input.sessionId,
        projectId: input.projectId,
        type: "session_summary",
        content,
        summary: summaryText,
        importanceScore: 3,
        tags: ["session-summary", `session:${input.sessionId}`],
        sourceRef: input.sessionId,
      });
      this.logger.log(`[summarize] session=${input.sessionId} project=${input.projectId} msgs=${input.messages.length}`);
      return record;
    } catch (err) {
      this.logger.warn(`[summarize] failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  // ── fetchRelevant (backward-compat) ───────────────────────────────────────

  async fetchRelevant(input: FetchRelevantInput): Promise<ScoredMemory[]> {
    const workspaceId = `project:${input.projectId}`;
    const topK = input.topK ?? MAX_MEMORIES_TO_INJECT;

    const [ftsResults, recentResults] = await Promise.all([
      input.query.trim().length > 2
        ? this.repo.search({ tenantId: input.tenantId, workspaceId, term: input.query, limit: topK * 3 })
        : Promise.resolve([]),
      this.repo.query({
        tenantId: input.tenantId,
        orgId: input.orgId,
        workspaceId,
        kinds: ["decision", "run_summary", "task_state"],
      }),
    ]);

    const seen = new Set<string>();
    const candidates: ScoredMemory[] = [];

    for (const r of ftsResults) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      candidates.push({ ...r, relevanceScore: computeWorkspaceScore(r, r.rank ?? 0.5) });
    }
    for (const r of recentResults.slice(0, topK * 2)) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      candidates.push({ ...r, relevanceScore: computeWorkspaceScore(r, 0.3) });
    }

    candidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return candidates.slice(0, topK);
  }

  formatForContext(records: ScoredMemory[], maxChars = MAX_CONTEXT_CHARS): string {
    if (records.length === 0) return "";

    const lines: string[] = ["## Memoria relevante del proyecto"];
    let used = lines[0]!.length + 1;

    for (const m of records) {
      const entry = [
        `### [${m.kind}] ${m.title}`,
        `> ${m.summary}`,
        m.body ? m.body.slice(0, 300) : "",
        m.tags.length ? `Etiquetas: ${m.tags.join(", ")}` : "",
        `Actualizado: ${new Date(m.updatedAtIso).toLocaleDateString("es-MX")}`,
      ].filter(Boolean).join("\n");

      if (used + entry.length + 2 > maxChars) break;
      lines.push(entry);
      used += entry.length + 2;
    }

    return lines.length > 1 ? lines.join("\n\n") : "";
  }

  // ── writeSessionSummary (backward-compat + enhanced) ─────────────────────

  async writeSessionSummary(input: WriteSessionSummaryInput): Promise<void> {
    const hasActions = input.proposedActionTypes.length > 0;
    const hasSubstantialResponse = input.agentResponse.length > 200;

    if (!hasActions && !hasSubstantialResponse) return;

    const actionsSummary = hasActions
      ? `Acciones propuestas: ${input.proposedActionTypes.join(", ")}.`
      : "Sin acciones propuestas.";

    const summaryText = [
      `Usuario: "${input.userMessage.slice(0, 120)}${input.userMessage.length > 120 ? "…" : ""}"`,
      actionsSummary,
      input.toolCallCount > 0 ? `Tools: ${input.toolCallCount}.` : "",
    ].filter(Boolean).join(" ").slice(0, 200);

    const content = [
      `Pregunta: ${input.userMessage.slice(0, 500)}`,
      `Respuesta: ${input.agentResponse.slice(0, 500)}`,
      hasActions ? `Acciones: ${input.proposedActionTypes.join(", ")}` : "",
    ].filter(Boolean).join("\n");

    const memId = `mem_copilot_session_${input.sessionId}`;
    void this.agentRepo.upsert({
      id: memId,
      tenantId: input.tenantId,
      orgId: input.orgId,
      agentId: "project-copilot",
      sessionId: input.sessionId,
      projectId: input.projectId,
      type: "session_summary",
      content,
      summary: summaryText,
      importanceScore: hasActions ? 4 : 3,
      tags: [
        "copilot-session",
        "session-summary",
        ...input.proposedActionTypes.map((t) => `action:${t.toLowerCase()}`),
      ],
      sourceRef: input.sessionId,
    }).catch((err) => this.logger.warn(`[memory] upsert session failed: ${String(err)}`));

    const workspaceId = `project:${input.projectId}`;
    const slug = `copilot-session-${input.sessionId}`;
    const wsId = buildWorkspaceMemoryId({ workspaceId, kind: "run_summary", slug });

    const wsRecord: WorkspaceMemoryRecord = {
      id: wsId,
      tenantId: input.tenantId,
      orgId: input.orgId,
      createdBy: input.userId,
      workspaceId,
      runId: input.sessionId,
      kind: "run_summary",
      scope: "run",
      title: `Sesión copiloto — ${new Date().toLocaleDateString("es-MX")}`,
      summary: summaryText,
      body: content,
      tags: ["copilot-session", "run-summary", ...input.proposedActionTypes.map((t) => `action:${t.toLowerCase()}`)],
      sourceRef: input.sessionId,
      updatedAtIso: new Date().toISOString(),
    };

    try {
      await this.repo.append(wsRecord);
      this.logger.log(`[memory] session summary written project=${input.projectId} actions=${input.proposedActionTypes.length}`);
    } catch (err) {
      this.logger.warn(`[memory] ws summary failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Memory decay ─────────────────────────────────────────────────────────────

  async decayOldMemories(input: {
    tenantId: string;
    projectId: string;
    olderThanDays?: number;
  }): Promise<{ decayed: number; deleted: number }> {
    const olderThanDays = input.olderThanDays ?? 14;

    const decayed = await this.agentRepo.decayOldMemories({
      tenantId: input.tenantId,
      projectId: input.projectId,
      olderThanDays,
      minImportance: 2,
    });

    const deleted = await this.agentRepo.cleanupExpiredMemories({
      tenantId: input.tenantId,
      projectId: input.projectId,
      olderThanDays: olderThanDays * 3,
      maxImportance: 1,
    });

    this.logger.log(`[memory-decay] project=${input.projectId} decayed=${decayed} deleted=${deleted}`);
    return { decayed, deleted };
  }

  // ── Memory deduplication ──────────────────────────────────────────────────────

  async deduplicateMemories(input: {
    tenantId: string;
    projectId: string;
    agentId: string;
  }): Promise<{ removed: number }> {
    const candidates = await this.agentRepo.findDuplicateCandidates({
      tenantId: input.tenantId,
      projectId: input.projectId,
      agentId: input.agentId,
    });

    const toDelete: string[] = [];
    const seen = new Map<string, string>(); // normalizedKey → id of winner

    for (const mem of candidates) {
      const key = mem.summary
        .toLowerCase()
        .replace(/[^a-záéíóúñü0-9]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .sort()
        .join(" ")
        .slice(0, 80);

      if (!key) continue;

      const existing = seen.get(key);
      if (existing) {
        // Keep the newer or higher-importance one, delete the other
        const winner = mem.importanceScore > (candidates.find((c) => c.id === existing)?.importanceScore ?? 0)
          ? mem.id
          : existing;
        const loser = winner === mem.id ? existing : mem.id;
        toDelete.push(loser);
        seen.set(key, winner);
      } else {
        seen.set(key, mem.id);
      }
    }

    const removed = await this.agentRepo.deleteManyById(toDelete);
    this.logger.log(`[memory-dedup] project=${input.projectId} agent=${input.agentId} removed=${removed}`);
    return { removed };
  }

  // ── summarizeSession autonómico (LLM-enhanced) ────────────────────────────────

  async summarizeSessionAutonomic(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    agentId: string;
    projectId: string;
    sessionId: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  }): Promise<AgentMemoryRecord | null> {
    if (input.messages.length < 2) return null;

    const userTurns = input.messages.filter((m) => m.role === "user");
    const assistantTurns = input.messages.filter((m) => m.role === "assistant");

    // Extract actions and decisions from assistant messages
    const actionPatterns = /PROPOSE_|REQUEST_|DRAFT_|SEARCH_|RUN_|READ_|EDIT_/g;
    const allContent = assistantTurns.map((m) => m.content).join(" ");
    const detectedActions = [...new Set(Array.from(allContent.matchAll(actionPatterns), (m) => m[0]))];

    // Detect decisions vs. questions
    const hasDecisions = detectedActions.length > 0 || /aprobó|rechazó|liberó|escaló|propuso plan/.test(allContent);
    const memType: AgentMemoryRecord["type"] = hasDecisions ? "decision" : "session_summary";
    const importanceScore = hasDecisions ? 4 : 3;

    const summaryLines: string[] = [];
    if (userTurns.length > 0) summaryLines.push(`Consulta: "${userTurns[0]!.content.slice(0, 100)}"`);
    if (detectedActions.length > 0) summaryLines.push(`Acciones: ${detectedActions.join(", ")}`);
    if (assistantTurns.length > 0) summaryLines.push(`Respuesta: "${assistantTurns[assistantTurns.length - 1]!.content.slice(0, 100)}"`);

    const summary = summaryLines.join(" · ").slice(0, 200);
    const content = [
      `Sesión: ${input.sessionId} | Proyecto: ${input.projectId}`,
      `Turnos: ${input.messages.length} (${userTurns.length} usuario, ${assistantTurns.length} agente)`,
      `Primera consulta: ${userTurns[0]?.content.slice(0, 300) ?? ""}`,
      `Última respuesta: ${assistantTurns[assistantTurns.length - 1]?.content.slice(0, 300) ?? ""}`,
      detectedActions.length > 0 ? `Acciones detectadas: ${detectedActions.join(", ")}` : "",
    ].filter(Boolean).join("\n");

    const memId = `mem_auto_${input.sessionId}_${input.projectId}`;
    try {
      const record = await this.agentRepo.upsert({
        id: memId,
        tenantId: input.tenantId,
        orgId: input.orgId,
        agentId: input.agentId,
        sessionId: input.sessionId,
        projectId: input.projectId,
        type: memType,
        content,
        summary,
        importanceScore,
        tags: [
          "auto-summary",
          `session:${input.sessionId}`,
          ...detectedActions.map((a) => `action:${a.toLowerCase()}`),
        ],
        sourceRef: input.sessionId,
      });
      this.logger.log(`[auto-summary] session=${input.sessionId} type=${memType} importance=${importanceScore}`);
      return record;
    } catch (err) {
      this.logger.warn(`[auto-summary] failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  // ── writeActionProposal (backward-compat + enhanced) ─────────────────────

  async writeActionProposal(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    projectId: string;
    actionType: string;
    summary: string;
    rationale: string;
  }): Promise<void> {
    void this.agentRepo.create({
      tenantId: input.tenantId,
      orgId: input.orgId,
      agentId: "project-copilot",
      projectId: input.projectId,
      type: "action_proposal",
      content: input.rationale ? `Fundamento: ${input.rationale}` : input.summary,
      summary: input.summary.slice(0, 200),
      importanceScore: 4,
      tags: ["copilot-proposal", `action:${input.actionType.toLowerCase()}`],
      sourceRef: input.actionType,
    }).catch(() => undefined);

    const workspaceId = `project:${input.projectId}`;
    const slug = `action-proposal-${input.actionType.toLowerCase()}-${Date.now()}`;
    const id = buildWorkspaceMemoryId({ workspaceId, kind: "decision", slug });

    const record: WorkspaceMemoryRecord = {
      id,
      tenantId: input.tenantId,
      orgId: input.orgId,
      createdBy: input.userId,
      workspaceId,
      kind: "decision",
      scope: "task",
      title: `Propuesta: ${input.actionType}`,
      summary: input.summary,
      body: input.rationale ? `Fundamento: ${input.rationale}` : undefined,
      tags: ["copilot-proposal", `action:${input.actionType.toLowerCase()}`],
      sourceRef: input.actionType,
      updatedAtIso: new Date().toISOString(),
    };

    try {
      await this.repo.append(record);
    } catch {
      // best-effort
    }
  }
}
