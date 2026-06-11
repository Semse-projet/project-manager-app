import { randomUUID } from "node:crypto";
import type { ChatMessage, ChatThread } from "./domain-store.js";

// ── In-memory thread store ────────────────────────────────────────────────────
// Threads survive process lifetime but are not persisted to DB.
// Phase-7 upgrade: replace with Prisma ChatThread model + Redis TTL cache.

const threadStore = new Map<string, ChatThread>();

export function getThread(threadId: string): ChatThread | undefined {
  return threadStore.get(threadId);
}

export function createThread(params: {
  tenantId: string;
  userId: string;
  agentId: string;
}): ChatThread {
  const now = new Date().toISOString();
  const thread: ChatThread = {
    id: `thr_${Date.now()}_${randomUUID().slice(0, 8)}`,
    tenantId: params.tenantId,
    userId: params.userId,
    agentId: params.agentId,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  threadStore.set(thread.id, thread);
  return thread;
}

export function appendMessage(threadId: string, message: ChatMessage): ChatThread | undefined {
  const thread = threadStore.get(threadId);
  if (!thread) return undefined;
  thread.messages.push(message);
  thread.updatedAt = new Date().toISOString();
  return thread;
}

export function listThreads(params: { tenantId: string; userId: string }): ChatThread[] {
  return Array.from(threadStore.values()).filter(
    (t) => t.tenantId === params.tenantId && t.userId === params.userId,
  );
}

// ── Contextual response engine ────────────────────────────────────────────────

type AgentPersona = {
  greeting: string;
  topics: Array<{ keywords: string[]; responses: string[] }>;
  fallback: string[];
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function summarizeContext(context: Record<string, unknown> | undefined): string[] {
  if (!context) {
    return [];
  }

  const summary: string[] = [];
  const projectTitle = normalizeText(context.projectTitle);
  const projectStatus = normalizeText(context.projectStatus);
  const pageContext = normalizeText(context.pageContext);
  const projectId = normalizeText(context.projectId);
  const workspaceId = normalizeText(context.workspaceId);
  const escrowStatus = normalizeText(context.escrowStatus);
  const corpusStatus = normalizeText(context.corpusStatus);
  const milestonesPending = typeof context.milestonesPending === "number" ? context.milestonesPending : null;
  const openDisputeCount = typeof context.openDisputeCount === "number" ? context.openDisputeCount : null;
  const escrowGap = typeof context.escrowGap === "number" ? context.escrowGap : null;
  const corpusEvidence = typeof context.corpusEvidence === "number" ? context.corpusEvidence : null;

  if (projectTitle) {
    summary.push(`Proyecto: ${projectTitle}`);
  }

  if (projectStatus) {
    summary.push(`Estado actual: ${projectStatus}`);
  }

  if (projectId) {
    summary.push(`Project ID: ${projectId}`);
  }

  if (workspaceId) {
    summary.push(`Workspace: ${workspaceId}`);
  }

  if (pageContext) {
    summary.push(`Contexto: ${pageContext}`);
  }

  if (escrowStatus) {
    summary.push(`Escrow: ${escrowStatus}`);
  }

  if (milestonesPending !== null) {
    summary.push(`Milestones pendientes: ${milestonesPending}`);
  }

  if (openDisputeCount !== null) {
    summary.push(`Disputas abiertas: ${openDisputeCount}`);
  }

  if (escrowGap !== null) {
    summary.push(`Saldo pendiente de liberar: ${escrowGap}`);
  }

  if (corpusStatus) {
    summary.push(`Corpus: ${corpusStatus}`);
  }

  if (corpusEvidence !== null) {
    summary.push(`Evidencia indexada: ${corpusEvidence}`);
  }

  return summary;
}

function buildOperationalChecklist(context: Record<string, unknown> | undefined, lower: string): string[] {
  if (!context) {
    return [];
  }

  const checks: string[] = [];
  const milestonesPending = typeof context.milestonesPending === "number" ? context.milestonesPending : 0;
  const openDisputeCount = typeof context.openDisputeCount === "number" ? context.openDisputeCount : 0;
  const corpusEvidence = typeof context.corpusEvidence === "number" ? context.corpusEvidence : 0;
  const escrowStatus = normalizeText(context.escrowStatus);
  const escrowGap = typeof context.escrowGap === "number" ? context.escrowGap : 0;

  if (openDisputeCount > 0) {
    checks.push(`Hay ${openDisputeCount} disputa(s) abierta(s); no conviene destrabar pagos sin resolverlas o acotarlas.`);
  }

  if (milestonesPending > 0) {
    checks.push(`Quedan ${milestonesPending} milestone(s) pendiente(s); revisa aprobacion y evidencia antes de mover dinero.`);
  }

  if (corpusEvidence === 0 && /(evidencia|evidence|validar|aprobar|milestone)/i.test(lower)) {
    checks.push("No aparece evidencia indexada; pide o sube soporte antes de aprobar el siguiente paso.");
  }

  if (escrowStatus && /(escrow|pago|pagos|release|liberar)/i.test(lower)) {
    checks.push(`El escrow esta en estado ${escrowStatus}; confirma elegibilidad de release antes de accionar.`);
  }

  if (escrowGap > 0 && /(pago|pagos|release|liberar|destrabar)/i.test(lower)) {
    checks.push(`Todavia hay ${escrowGap} por liberar; verifica si corresponde a hitos aprobados o a fondos retenidos.`);
  }

  return checks;
}

function pickUnique(candidates: string[], history: ChatMessage[]): string {
  const recentAssistantMessages = history
    .filter((message) => message.role === "assistant")
    .slice(-3)
    .map((message) => message.content.trim());

  const fresh = candidates.find((candidate) => !recentAssistantMessages.includes(candidate.trim()));
  return fresh ?? candidates[0] ?? "";
}

function buildContextualResponse(params: {
  message: string;
  context?: Record<string, unknown>;
  history: ChatMessage[];
}): string | null {
  const lower = params.message.toLowerCase();
  const summary = summarizeContext(params.context);

  if (summary.length === 0) {
    return null;
  }

  if (/(estado|status|resumen|contexto|situacion|situación)/i.test(lower)) {
    return [
      "Resumen operativo del contexto actual:",
      ...summary.map((line) => `- ${line}`),
      "Si quieres, puedo seguir con el siguiente paso, riesgos visibles o hitos pendientes."
    ].join("\n");
  }

  if (
    /(siguiente|next|prioridad|prioridades|que hago|qué hago|accion|acción|recomienda|deberia hacer|debería hacer|despues|después|destrabar)/i.test(
      lower
    )
  ) {
    const checklist = buildOperationalChecklist(params.context, lower);
    return [
      "Con el contexto que tengo, las acciones inmediatas son:",
      ...summary.slice(0, 3).map((line) => `- Verificar ${line.toLowerCase()}.`),
      ...checklist.map((line) => `- ${line}`),
      "- Confirmar si ya existen milestones, pagos o disputas asociados antes de ejecutar cambios.",
      /(pago|pagos|escrow)/i.test(lower)
        ? "- Revisar hitos aprobados y bloqueos de escrow antes de intentar liberar fondos."
        : "- Revisar dependencias operativas antes de mover el siguiente hito.",
      "- Si me indicas el objetivo, puedo convertir esto en pasos concretos."
    ].join("\n");
  }

  if (/(riesgo|riesgos|bloqueo|bloqueos|traba|trabas|atasco|atascada|atascado)/i.test(lower)) {
    const checklist = buildOperationalChecklist(params.context, lower);
    if (checklist.length === 0) {
      return [
        "No veo bloqueos fuertes en el contexto disponible.",
        ...summary.map((line) => `- ${line}`),
        "Si quieres, puedo revisar pagos, milestones o disputas por separado."
      ].join("\n");
    }

    return [
      "Bloqueos y riesgos visibles ahora mismo:",
      ...checklist.map((line) => `- ${line}`),
      "- Si quieres, te los ordeno por urgencia operativa."
    ].join("\n");
  }

  return null;
}

const AGENT_PERSONAS: Record<string, AgentPersona> = {
  assistant: {
    greeting: "Hola, soy Prometeo. ¿En qué puedo ayudarte hoy?",
    topics: [
      {
        keywords: ["escrow", "fondos", "dinero", "pago"],
        responses: [
          "El sistema de escrow protege los fondos de ambas partes. Los pagos se liberan automáticamente al aprobarse cada hito.",
          "Los fondos en escrow están bloqueados hasta que el cliente confirme la entrega. Puedes ver el estado en tu panel de pagos.",
        ],
      },
      {
        keywords: ["trabajo", "job", "proyecto", "publicar"],
        responses: [
          "Para publicar un trabajo ve a Trabajos > Nuevo trabajo. Puedes elegir modalidad de precio fijo, rango o por hora.",
          "Los trabajos activos aparecen en tu dashboard con el estado actual. ¿Quieres que revise alguno en particular?",
        ],
      },
      {
        keywords: ["hito", "milestone", "etapa"],
        responses: [
          "Los hitos dividen el proyecto en entregas verificables. Cada hito tiene su propio escrow parcial.",
          "Para aprobar un hito ve al panel de hitos y haz clic en 'Aprobar'. Los fondos se liberarán automáticamente al profesional.",
        ],
      },
      {
        keywords: ["disputa", "problema", "conflicto", "queja"],
        responses: [
          "Para abrir una disputa ve a Pagos > Disputas. Necesitarás describir el problema y adjuntar evidencia.",
          "Las disputas son resueltas por nuestro equipo de mediación en 48-72 horas. ¿Quieres que te explique el proceso?",
        ],
      },
    ],
    fallback: [
      "Entendido. Puedo ayudarte con información sobre trabajos, hitos, pagos, escrow y disputas. ¿En cuál de estos temas te puedo orientar?",
      "Estoy procesando tu consulta. Para darte la mejor respuesta, ¿podrías darme más detalles?",
      "Permíteme revisar eso. Mientras tanto, recuerda que tienes acceso completo al historial de tu proyecto desde el dashboard.",
    ],
  },
  marta: {
    greeting: "Soy Marta, especialista en escrow y contratos. ¿En qué te puedo ayudar?",
    topics: [
      {
        keywords: ["escrow", "fondos", "liberar", "bloquear"],
        responses: [
          "El escrow se activa automáticamente al firmar el contrato. Los fondos se liberan en 3 condiciones: aprobación del hito, acuerdo mutuo, o resolución de disputa.",
          "Los fondos bloqueados en escrow tienen garantía de hasta $50,000 por proyecto. ¿Necesitas más información sobre los límites?",
        ],
      },
      {
        keywords: ["contrato", "firma", "términos", "acuerdo"],
        responses: [
          "Los contratos SEMSE incluyen cláusulas estándar de IP, confidencialidad y resolución de disputas. Puedes añadir términos personalizados en la sección de términos adicionales.",
          "La firma digital tiene validez legal en 47 países. El hash del documento se registra en blockchain para inmutabilidad.",
        ],
      },
    ],
    fallback: [
      "Como especialista en escrow, puedo explicarte cualquier aspecto sobre la protección de fondos, contratos o condiciones de liberación.",
      "Para consultas sobre contratos específicos, necesito el ID del proyecto. ¿Lo tienes a mano?",
    ],
  },
  felix: {
    greeting: "Soy Félix, encargado de verificación. ¿Qué necesitas verificar?",
    topics: [
      {
        keywords: ["verificar", "verificación", "identidad", "kyc"],
        responses: [
          "La verificación de identidad toma entre 2-24 horas. Necesitas subir un documento oficial vigente y una selfie.",
          "Los profesionales verificados tienen mayor visibilidad en búsquedas y pueden acceder a proyectos premium.",
        ],
      },
      {
        keywords: ["evidencia", "prueba", "documento", "archivo"],
        responses: [
          "Para subir evidencia ve a Evidencias en tu menú lateral. Acepto PDF, imágenes y videos de hasta 50MB por archivo.",
          "La evidencia aprobada queda registrada inmutablemente en el sistema. ¿Qué tipo de evidencia necesitas subir?",
        ],
      },
    ],
    fallback: [
      "Puedo ayudarte con verificaciones de identidad, evidencias de trabajo y documentación de proyectos.",
      "¿Es una verificación nueva o estás haciendo seguimiento a una existente?",
    ],
  },
  pulse: {
    greeting: "Soy Pulse, tu analista de métricas. ¿Qué números quieres revisar?",
    topics: [
      {
        keywords: ["métrica", "kpi", "estadística", "datos", "reporte"],
        responses: [
          "Tus métricas clave esta semana: 3 proyectos activos, tasa de completación 94%, tiempo promedio de respuesta 2.3h.",
          "El dashboard de métricas te muestra tendencias de 7, 30 y 90 días. ¿Quieres que profundice en algún indicador?",
        ],
      },
      {
        keywords: ["rendimiento", "performance", "eficiencia"],
        responses: [
          "Tu índice de rendimiento actual es 8.7/10, por encima del promedio de la plataforma (7.2). ¡Buen trabajo!",
          "Las áreas con mayor potencial de mejora son: tiempo de primera respuesta y tasa de aprobación de hitos en primer intento.",
        ],
      },
    ],
    fallback: [
      "Como analista de métricas puedo mostrarte KPIs de proyectos, tendencias de pagos y comparativas de rendimiento.",
      "¿Quieres ver métricas de un proyecto específico o un resumen general de tu actividad?",
    ],
  },
  justus: {
    greeting: "Soy Justus, especialista en disputas. ¿Qué problema necesitas resolver?",
    topics: [
      {
        keywords: ["disputa", "conflicto", "queja", "problema", "mediación"],
        responses: [
          "Para abrir una disputa, necesito: descripción del problema, monto en cuestión y evidencia de soporte. ¿Tienes todo eso listo?",
          "Las disputas tienen un proceso de 3 etapas: presentación de caso (48h), período de respuesta del contraparte (48h) y resolución del mediador (72h).",
        ],
      },
      {
        keywords: ["resolución", "resultado", "fallo", "decisión"],
        responses: [
          "Las resoluciones pueden ser: a favor del cliente, a favor del profesional, o solución parcial con distribución proporcional del escrow.",
          "Si no estás de acuerdo con la resolución, tienes 7 días para apelar ante el comité de escalación.",
        ],
      },
    ],
    fallback: [
      "Soy el especialista en resolución de conflictos. Cuéntame qué pasó y te guío en el proceso.",
      "¿Es una disputa activa o estás consultando el proceso preventivamente?",
    ],
  },
  planner: {
    greeting: "Soy Planner, tu asistente de planificación. ¿Qué proyecto quieres organizar?",
    topics: [
      {
        keywords: ["planificar", "plan", "cronograma", "fechas", "deadline"],
        responses: [
          "Un buen plan de proyecto tiene: desglose en hitos medibles, buffer del 20% por imponderables, y puntos de revisión semanales.",
          "Para proyectos de más de 30 días, recomiendo dividir en sprints de 2 semanas con hitos de entrega parcial.",
        ],
      },
      {
        keywords: ["hito", "entregable", "milestone", "etapa"],
        responses: [
          "Los hitos efectivos son SMART: específicos, medibles, alcanzables, relevantes y con tiempo definido.",
          "¿Cuántos hitos tiene tu proyecto actualmente? Si tienes más de 10, podría ayudarte a consolidar algunos.",
        ],
      },
    ],
    fallback: [
      "Como planificador, puedo ayudarte a estructurar proyectos, definir hitos y estimar tiempos realistas.",
      "¿Estás planificando un proyecto nuevo o reorganizando uno existente?",
    ],
  },
};

export function generateAgentResponse(params: {
  agentId: string;
  message: string;
  history: ChatMessage[];
  context?: Record<string, unknown>;
}): string {
  const persona = AGENT_PERSONAS[params.agentId] ?? AGENT_PERSONAS["assistant"]!;
  const lower = params.message.toLowerCase();

  // Greeting detection
  if (params.history.length === 0 || /^(hola|hi|hello|buenas|hey|saludos)/i.test(params.message)) {
    const contextSummary = summarizeContext(params.context);
    if (contextSummary.length === 0) {
      return persona.greeting;
    }

    return `${persona.greeting}\n\n${contextSummary.map((line) => `- ${line}`).join("\n")}`;
  }

  const contextual = buildContextualResponse(params);
  if (contextual) {
    return contextual;
  }

  // Topic matching
  for (const topic of persona.topics) {
    if (topic.keywords.some((kw) => lower.includes(kw))) {
      return pickUnique(topic.responses, params.history);
    }
  }

  // Fallback
  const contextSummary = summarizeContext(params.context);
  if (contextSummary.length > 0) {
    return [
      pickUnique(persona.fallback, params.history),
      "",
      "Contexto disponible:",
      ...contextSummary.map((line) => `- ${line}`)
    ].join("\n");
  }

  return pickUnique(persona.fallback, params.history);
}
