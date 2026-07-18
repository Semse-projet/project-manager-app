import type {
  ActionExecutionResponse,
  AgentConsultationRequest,
  AgentConsultationResponse,
  CopilotContextRequest,
  CopilotContextResponse,
  CopilotMessageRequest,
  CopilotMessageResponse,
  CreateMissionFromCopilotRequest,
  ExecuteCopilotActionRequest,
  MissionCreationResponse,
  OrchestrationStatusResponse,
  PrometeoAgentId,
  PrometeoOrchestrationRequest,
  PrometeoOrchestrationResponse,
} from "@semse/schemas";

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

// ── Orchestration ────────────────────────────────────────────────────────────

export async function orchestrate(
  input: PrometeoOrchestrationRequest,
): Promise<PrometeoOrchestrationResponse> {
  return unwrap(
    await fetch("/api/semse/prometeo/orchestrate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function consultAgent(
  agentId: PrometeoAgentId,
  input: AgentConsultationRequest,
): Promise<AgentConsultationResponse> {
  return unwrap(
    await fetch(`/api/semse/prometeo/agents/${encodeURIComponent(agentId)}/consult`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function getOrchestration(
  orchestrationId: string,
): Promise<OrchestrationStatusResponse> {
  return unwrap(
    await fetch(`/api/semse/prometeo/orchestration/${encodeURIComponent(orchestrationId)}`, {
      cache: "no-store",
    }),
  );
}

// ── Copilot ──────────────────────────────────────────────────────────────────

export async function detectCopilotContext(
  input: CopilotContextRequest,
): Promise<CopilotContextResponse> {
  return unwrap(
    await fetch("/api/semse/prometeo/copilot/context", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function sendCopilotMessage(
  input: CopilotMessageRequest,
): Promise<CopilotMessageResponse> {
  return unwrap(
    await fetch("/api/semse/prometeo/copilot/message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function createMissionFromCopilot(
  input: CreateMissionFromCopilotRequest,
): Promise<MissionCreationResponse> {
  return unwrap(
    await fetch("/api/semse/prometeo/copilot/mission/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function executeCopilotAction(
  input: ExecuteCopilotActionRequest,
): Promise<ActionExecutionResponse> {
  return unwrap(
    await fetch("/api/semse/prometeo/copilot/action/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}
