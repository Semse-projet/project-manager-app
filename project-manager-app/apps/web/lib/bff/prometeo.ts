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

// Raw backend/BFF error strings (e.g. the 401 body middleware.ts returns when
// it can't find a session cookie) must never reach the chat UI verbatim —
// audit 1.11c. Anything that looks technical gets swapped for a message the
// user can act on; only messages the copilot backend clearly means for the
// end user (short, no "SEMSE"/route/status jargon) pass through untouched.
const GENERIC_COPILOT_ERROR =
  "No pudimos conectar con Prometeo Copilot. Si el problema sigue, cierra sesión y vuelve a entrar.";

function isUserFacingMessage(message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes("semse api") || lower.includes("authentication required")) return false;
  if (/\b\d{3}\b/.test(message)) return false; // looks like it embeds an HTTP status code
  return message.trim().length > 0;
}

function toUserFacingError(rawMessage: string | undefined, status: number): Error {
  if (rawMessage && isUserFacingMessage(rawMessage)) return new Error(rawMessage);
  return new Error(status === 401 ? GENERIC_COPILOT_ERROR : `${GENERIC_COPILOT_ERROR} (código ${status})`);
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw toUserFacingError(body?.error?.message, res.status);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

// Explicit `credentials: "same-origin"` on every call: these BFF routes are
// gated by the session cookie (see apps/web/middleware.ts), and this widget
// previously surfaced that gate's own 401 body verbatim to the user (1.11c).
// Being explicit here removes any doubt about the cookie being sent, no
// matter what calls this module or what the ambient fetch defaults are.
const SAME_ORIGIN: RequestInit = { credentials: "same-origin" };

// ── Orchestration ────────────────────────────────────────────────────────────

export async function orchestrate(
  input: PrometeoOrchestrationRequest,
): Promise<PrometeoOrchestrationResponse> {
  return unwrap(
    await fetch("/api/semse/prometeo/orchestrate", {
      ...SAME_ORIGIN,
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
      ...SAME_ORIGIN,
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
      ...SAME_ORIGIN,
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
      ...SAME_ORIGIN,
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
      ...SAME_ORIGIN,
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
      ...SAME_ORIGIN,
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
      ...SAME_ORIGIN,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}
