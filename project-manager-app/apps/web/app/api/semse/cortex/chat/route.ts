import { NextRequest, NextResponse } from "next/server";
import type { PrometeoAttachment, PrometeoEntityReference, PrometeoPageContext } from "@semse/schemas";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled } from "../../_server";

export const dynamic = "force-dynamic";

// ──────────────────────────────────────────────────────────────────────────────
// DEMO RESPONSES — usadas cuando el runtime no está activo
// Organizadas por contexto para dar respuestas más útiles
// ──────────────────────────────────────────────────────────────────────────────

const DEMO_RESPONSES: Record<string, string[]> = {
  escrow: [
    "Los fondos en escrow están retenidos hasta que el cliente apruebe el milestone correspondiente. Una vez aprobado, se liberan automáticamente en 24–48 horas.",
    "Para liberar el escrow, el cliente debe revisar la evidencia subida y marcar el milestone como completado.",
  ],
  milestone: [
    "Para avanzar un milestone necesitas subir evidencia fotográfica o documental en la sección Evidencias, luego el cliente lo revisará.",
    "Los milestones pendientes se muestran en el dashboard del cliente. Cuando suba la evidencia, el cliente recibirá una notificación.",
  ],
  dispute: [
    "Las disputas se escalan al equipo de operaciones de SEMSE. El proceso típico toma 3–5 días hábiles. Se requiere evidencia de ambas partes.",
    "Para abrir una disputa, ve a la sección del trabajo y usa el botón 'Iniciar disputa'. Adjunta toda la evidencia disponible.",
  ],
  job: [
    "Para publicar un trabajo, ve a 'Publicar trabajo' en el menú lateral. El proceso tiene 4 pasos: categoría, detalles, presupuesto y revisión.",
    "Los trabajos publicados reciben propuestas de profesionales verificados. El promedio es de 3–5 propuestas en las primeras 48 horas.",
  ],
  payment: [
    "Los pagos se procesan via escrow. El profesional recibe el pago una vez que el cliente aprueba cada milestone.",
    "Puedes ver el historial completo de pagos en la sección Pagos de tu panel.",
  ],
  default: [
    "Hola, soy Prometeo — el agente de SEMSE OS. Conecta el backend configurando las variables de entorno `SEMSE_API_BASE_URL`, `SEMSE_TENANT_ID`, `SEMSE_ORG_ID` y `SEMSE_USER_ID` para activar el agente real.",
    "Puedo ayudarte con información sobre trabajos, milestones, escrow y disputas. El MCA completo se activa con el backend conectado.",
    "En modo demo puedo responder preguntas sobre el flujo de trabajo de SEMSE: publicar trabajos → propuestas → reserva → contrato → milestones → escrow → liberación.",
  ],
};

function getDemoResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("escrow")) return pick(DEMO_RESPONSES.escrow);
  if (lower.includes("milestone") || lower.includes("hito")) return pick(DEMO_RESPONSES.milestone);
  if (lower.includes("disputa") || lower.includes("dispute")) return pick(DEMO_RESPONSES.dispute);
  if (lower.includes("trabajo") || lower.includes("job") || lower.includes("publicar")) return pick(DEMO_RESPONSES.job);
  if (lower.includes("pago") || lower.includes("payment") || lower.includes("retiro")) return pick(DEMO_RESPONSES.payment);
  return pick(DEMO_RESPONSES.default);
}

let demoRotation = 0;
function pick(arr: string[]): string {
  const item = arr[demoRotation % arr.length];
  demoRotation++;
  return item;
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/semse/cortex/chat
// Body: PrometeoRequest legacy-compatible envelope.
// ──────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    message?: string;
    agentId?: string;
    threadId?: string;
    missionId?: string;
    context?: unknown;
    projectId?: string;
    requestedAction?: string;
    requestedActionInput?: Record<string, unknown>;
    attachments?: PrometeoAttachment[];
    selectedEntities?: PrometeoEntityReference[];
    pageContext?: PrometeoPageContext;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 });
  }

  const {
    message,
    agentId = "assistant",
    threadId,
    missionId,
    context,
    projectId,
    requestedAction,
    requestedActionInput,
    attachments = [],
    selectedEntities = [],
    pageContext,
  } = body;
  const trimmedMessage = typeof message === "string" ? message.trim() : "";
  const hasOperationalInput = trimmedMessage.length > 0 || attachments.length > 0 || Boolean(requestedAction);

  if (!hasOperationalInput) {
    return NextResponse.json({ error: { status: 400, message: "message, attachments, or requestedAction is required" } }, { status: 400 });
  }

  const effectiveMessage = trimmedMessage || (requestedAction ? `Prepara la acción solicitada: ${requestedAction}` : "Analiza los adjuntos recibidos.");

  // ── Demo mode ──────────────────────────────────────────────────────────────
  if (!isSemseRuntimeEnabled()) {
    // Simula latencia de red
    await new Promise(r => setTimeout(r, 600 + Math.random() * 500));
    const demoResponse = projectId
      ? getDemoResponse(effectiveMessage)
      : "No tengo proyecto seleccionado. Puedo darte un resumen general o usar tus trabajos recientes si activas el backend real.";

    return NextResponse.json({
      requestId: `chat-demo-${Date.now()}`,
      data: {
        threadId: threadId ?? `thread-demo-${Date.now()}`,
        agentId,
        response: demoResponse,
        message: demoResponse,
        mode: "demo",
        blocks: [
          {
            id: "demo-runtime",
            type: "mission_status",
            title: "Modo demo",
            status: "skipped",
            summary: "El envelope multimodal se validó en web, pero el runtime SEMSE no está activo.",
          },
        ],
        proposedActions: [],
        executionResults: [],
        citations: [],
        refreshTargets: ["prometeo.chat"],
        timestamp: new Date().toISOString(),
      },
    });
  }

  // ── Runtime mode ────────────────────────────────────────────────────────────
  try {
    const data = await fetchSemseDataForRequest<{
      threadId: string;
      response: string;
      agentId: string;
      timestamp: string;
      context?: unknown;
      route?: unknown;
      model?: string;
      modelSlug?: string;
      provider?: string;
      errorMessage?: string;
      message?: string;
      blocks?: unknown[];
      proposedActions?: unknown[];
      executionResults?: unknown[];
      mission?: unknown;
      citations?: unknown[];
      refreshTargets?: string[];
    }>("/v1/ai-models/prometeo/chat", req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: trimmedMessage || undefined,
        agentId,
        threadId,
        missionId,
        context,
        projectId,
        requestedAction,
        requestedActionInput,
        attachments,
        selectedEntities,
        pageContext,
      }),
    });

    return NextResponse.json({
      requestId: `chat-${Date.now()}`,
      data: { ...data, mode: "runtime" },
    });
  } catch (error) {
    return handleServerError(error);
  }
}
