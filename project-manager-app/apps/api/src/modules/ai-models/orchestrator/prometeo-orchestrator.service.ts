import { Injectable, Logger } from "@nestjs/common";
import type { SemseOperationalContext } from "../context/operational-context.service.js";
import type { AiTaskType } from "../types/ai-task.types.js";

export type PrometeoIntentType =
  | "operational_summary" | "project_report" | "evidence_review"
  | "payment_status" | "dispute_status" | "schedule_plan"
  | "legal_compliance" | "system_health" | "developer_diagnostics"
  | "budget_estimate"
  // ── Contractor mode ───────────────────────────────────────────────────────
  | "estimate_generation"   // "Hazme un estimado para..."
  | "price_suggestion"      // "¿Cuánto debo cobrar por...?"
  | "materials_list"        // "Lista de materiales para..."
  | "client_message"        // "Redacta un mensaje para el cliente..."
  | "project_summary_client"// "Resume el avance de este proyecto para el cliente"
  | "unknown";

export type AgentRouteTarget = "Prometeo" | "Pulse" | "Planner" | "Felix" | "Justus" | "Marta" | "SEMSE Core";
export type PrometeoUiAgentId = "assistant" | "marta" | "felix" | "pulse" | "justus" | "planner";

export type PrometeoRoute = {
  intent: PrometeoIntentType;
  primaryAgent: AgentRouteTarget;
  supportingAgents: AgentRouteTarget[];
  contextRequired: string[];
  systemPromptAddition: string;
  selectionSource: "intent" | "panel_agent";
  requestedAgentId?: PrometeoUiAgentId;
};

const INTENT_KEYWORDS: Record<PrometeoIntentType, string[]> = {
  operational_summary: ["resumen", "summary", "cómo está todo", "como esta todo", "estado general",
                        "qué hay", "overview", "situación", "general", "dame un resumen", "operativo"],
  project_report:      ["mi proyecto", "el proyecto", "reporte del proyecto", "progreso del proyecto",
                        "status del proyecto", "avance"],
  evidence_review:     ["evidencia", "evidence", "foto", "photo", "documento", "archivo", "file", "verificar trabajo"],
  payment_status:      ["pago", "payment", "escrow", "dinero", "liberar", "release", "cobro", "factura"],
  dispute_status:      ["disputa", "dispute", "conflicto", "conflict", "reclamación"],
  schedule_plan:       ["agenda", "schedule", "hito", "milestone", "fecha límite", "cuándo", "plazo", "próximo paso"],
  legal_compliance:    ["contrato", "contract", "legal", "cumplimiento", "compliance", "cláusula"],
  system_health:       ["salud del sistema", "estado del sistema", "worker", "redis", "infraestructura", "técnico"],
  developer_diagnostics: ["debug", "log de error", "código", "deploy", "build", "diagnóstico técnico"],
  budget_estimate:     ["cuánto cuesta el proyecto", "precio estimado del proyecto", "presupuesto para el proyecto",
                        "rango de precio del trabajo", "cuánto debería costar el proyecto", "costo estimado del proyecto"],
  // ── Contractor mode ─────────────────────────────────────────────────────────
  estimate_generation: [
    "hazme un estimado", "haz un estimado", "crea un estimado", "genera un estimado",
    "make an estimate", "create an estimate",
    "quote for", "cotización para", "prepara el estimado",
    "cuánto costaría instalar", "cuánto costaría reparar", "cuánto costaría remodel",
  ],
  price_suggestion: [
    "cuánto debo cobrar", "cuanto debo cobrar", "cuánto cobrar por", "qué precio cobrar",
    "how much to charge", "rate for",
    "tarifa para", "precio justo", "costo de mano de obra", "cobro de mano de obra",
    "cuánto es normal cobrar", "market rate", "precio de mercado",
    "cuánto vale cobrar",
  ],
  materials_list: [
    "lista de materiales", "materials list", "qué materiales", "que materiales",
    "materiales para", "materials for", "qué necesito para", "que necesito para",
    "qué compro", "what do i need", "insumos", "supplies for",
    "cuántas hojas", "cuántos galones", "how many sheets", "how many gallons",
  ],
  client_message: [
    "redacta un mensaje", "escribe un mensaje", "mensaje para el cliente",
    "draft a message", "write a message", "message to client",
    "cómo le digo", "como le digo", "cómo explico", "cómo informo",
    "mensaje de seguimiento", "follow up message", "update to client",
    "notificar al cliente", "comunicar al cliente",
  ],
  project_summary_client: [
    "resumen para el cliente", "summary for client", "reporte para el cliente",
    "informe de avance", "progress report", "qué le digo al cliente sobre el avance",
    "actualización del proyecto para", "project update",
  ],
  unknown: [],
};

const AGENT_ROUTING: Record<PrometeoIntentType, AgentRouteTarget> = {
  operational_summary:    "SEMSE Core",
  project_report:         "Pulse",
  evidence_review:        "Felix",
  payment_status:         "Justus",
  dispute_status:         "Justus",
  schedule_plan:          "Planner",
  legal_compliance:       "Marta",
  system_health:          "Pulse",
  developer_diagnostics:  "Prometeo",
  budget_estimate:        "Justus",
  // Contractor mode → always Prometeo with contractor persona
  estimate_generation:    "Prometeo",
  price_suggestion:       "Prometeo",
  materials_list:         "Prometeo",
  client_message:         "Prometeo",
  project_summary_client: "Prometeo",
  unknown:                "Prometeo",
};

const AGENT_PERSONAS: Record<AgentRouteTarget, string> = {
  "Prometeo": `Eres Prometeo, el asistente central de SEMSE OS — una plataforma de gestión de proyectos de construcción y servicios.

Tu personalidad: eres directo, conversacional y útil. Hablas como un colega experimentado, no como un manual.
Cuando ves datos reales en el contexto, los usas para dar respuestas concretas con números, fechas y nombres reales.
Cuando no hay datos, lo dices claramente y ofreces ayuda alternativa.

Reglas de comunicación:
- Responde en el idioma del usuario (español por defecto)
- Usa bullet points cuando hay múltiples elementos, párrafos cuando es una explicación
- Menciona cifras específicas cuando las tienes: "$1,200", "3 hitos", "hace 2 días"
- Si hay algo urgente (vencido, bloqueado, en disputa), destácalo al inicio
- Termina con una pregunta o acción concreta cuando tenga sentido
- NO uses frases vacías como "Entendido" o "Por supuesto" al inicio`,

  "Pulse": `Eres Pulse, el agente de métricas y salud operativa de SEMSE.
Tu especialidad: KPIs, rendimiento del sistema, análisis de actividad y tendencias.
Habla con números concretos. Si ves métricas en el contexto, las interpretas y das insight, no solo las repites.
Ej: "La API tiene latencia de 200ms — dentro de lo normal. Pero el worker lleva 15 min sin heartbeat, eso es preocupante."`,

  "Planner": `Eres Planner, el agente de planificación y agenda de SEMSE.
Tu especialidad: hitos, fechas, secuenciación de tareas, dependencias y próximos pasos.
Cuando ves el estado actual del proyecto, generas un plan claro: qué está pendiente, en qué orden, y qué podría bloquear el avance.
Eres proactivo: si ves que un milestone lleva días sin actividad, lo mencionas.`,

  "Felix": `Eres Felix, el agente de evidencias y documentos de SEMSE.
Tu especialidad: fotos, documentos, verificación de trabajo de campo, validación de evidencia.
Cuando el usuario pregunta sobre evidencia, preguntas específicas: ¿qué hito?, ¿qué tipo de trabajo?, ¿cuántas fotos se esperan?
Eres el que ayuda a entender si la evidencia presentada es suficiente para aprobar un milestone.`,

  "Justus": `Eres Justus, el agente financiero y de disputas de SEMSE.
Tu especialidad: escrow, pagos, liberaciones de fondos, disputas entre cliente y profesional.
Cuando ves datos de escrow y facturas, los interpretas: cuánto hay retenido, cuándo puede liberarse, qué falta para cobrar.
En disputas, eres neutral y metodico: qué evidencia hay de cada lado, cuál es el camino más rápido a la resolución.`,

  "Marta": `Eres Marta, la agente legal y de cumplimiento de SEMSE.
Tu especialidad: contratos, cláusulas, alcance del trabajo, riesgos legales y cumplimiento normativo en construcción.
Cuando el usuario pregunta sobre un contrato o situación legal, explicas el riesgo en términos simples y das recomendaciones concretas.
No das asesoría legal formal, pero sí identificas los puntos críticos que el usuario debe atender.`,

  "SEMSE Core": `Eres el asistente central de SEMSE OS.
Tienes acceso completo al contexto operativo: proyectos, hitos, pagos, evidencias, disputas, finanzas.
Generas reportes ejecutivos claros con los datos reales disponibles.
Cuando alguien pregunta "¿cómo está todo?", no devuelves una lista de campos — interpretas la situación y la explicas como lo haría un project manager experimentado.`,
};

const CONTRACTOR_EXPERT_PERSONA = `Eres un asistente experto en construcción y servicios para contratistas en los Estados Unidos.

Tu conocimiento incluye:
- Precios típicos de materiales en Home Depot, Lowe's y proveedores locales (precios 2024-2025 en USD)
- Tarifas de mano de obra por tipo de trabajo en mercados de Florida, Texas, California y área general de EE.UU.
- Estimados de tiempo reales (no teóricos) para trabajos residenciales y comerciales pequeños
- Cómo calcular un estimado profesional: materiales + mano de obra + overhead (10-20%) + ganancia (10-30%)
- Cómo comunicarse con clientes: claro, profesional, con fechas y condiciones claras
- Tipos de trabajo más comunes: drywall, pintura, pisos (vinyl, tile, hardwood), remodelación de baño/cocina, roof repair, exterior/interior painting, fence, deck

FORMATO DE RESPUESTAS:
- Para estimados: usa tabla o lista con: item | cantidad | precio unit | subtotal. Incluye mano de obra separada. Muestra total claro.
- Para listas de materiales: número de unidades específico, con nombre del producto y dónde comprarlo
- Para precios: da rango (bajo/medio/alto) según nivel de calidad y mercado
- Para mensajes: texto listo para copiar/pegar por WhatsApp o email, en español o inglés según pida el usuario
- Siempre incluye: notas de validez del estimado (7-14 días), condiciones de pago (50% depósito), lo que NO incluye el estimado

PRECIOS DE REFERENCIA (ajustar según mercado local):
- Drywall: $0.50-$1.00/sqft instalado. Hojas 4x8: $12-$16 en HD. Mano de obra: $1.50-$3.00/sqft
- Pintura interior: $1.50-$3.50/sqft de pared pintada. 1 galón cubre ~350-400 sqft. Mano de obra: $200-$500/cuarto
- Pisos vinyl plank (LVP): material $1.50-$4.00/sqft, instalación $2-$4/sqft
- Pisos tile: material $2-$8/sqft, instalación $5-$12/sqft
- Remodel de baño básico: $3,500-$8,000. Completo: $8,000-$20,000+
- Roof repair (parcial): $300-$1,500. Full replacement 1,500 sqft: $6,000-$15,000
- Demo/demo day: $500-$1,500 por habitación
- Handyman (hora): $50-$100/hr según especialidad y mercado`;

// ── Contractor mode intent check ─────────────────────────────────────────────

const CONTRACTOR_INTENTS = new Set<PrometeoIntentType>([
  "estimate_generation", "price_suggestion", "materials_list",
  "client_message", "project_summary_client",
]);

const UI_AGENT_TO_ROUTE_TARGET: Record<PrometeoUiAgentId, AgentRouteTarget> = {
  assistant: "Prometeo",
  marta: "Marta",
  felix: "Felix",
  pulse: "Pulse",
  justus: "Justus",
  planner: "Planner",
};

@Injectable()
export class PrometeoOrchestratorService {
  private readonly logger = new Logger(PrometeoOrchestratorService.name);

  classifyIntent(message: string): PrometeoIntentType {
    const lower = message.toLowerCase();
    let bestMatch: PrometeoIntentType = "unknown";
    let bestScore = 0;

    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [PrometeoIntentType, string[]][]) {
      if (intent === "unknown") continue;
      const score = keywords.filter((k) => lower.includes(k)).length;
      if (score > bestScore) { bestScore = score; bestMatch = intent; }
    }
    return bestMatch;
  }

  routeToAgent(intent: PrometeoIntentType, requestedAgentId?: string): PrometeoRoute {
    const normalizedAgentId = this.normalizeUiAgentId(requestedAgentId);
    const preferredAgent = normalizedAgentId ? UI_AGENT_TO_ROUTE_TARGET[normalizedAgentId] : null;
    const primaryAgent = preferredAgent && preferredAgent !== "Prometeo"
      ? preferredAgent
      : AGENT_ROUTING[intent];
    const supportingAgents: AgentRouteTarget[] = [];

    if (!preferredAgent || preferredAgent === "Prometeo") {
      if (intent === "operational_summary") {
        supportingAgents.push("Pulse", "Planner", "Justus");
      } else if (intent === "project_report") {
        supportingAgents.push("Felix", "Justus");
      } else if (intent === "dispute_status") {
        supportingAgents.push("Marta");
      }
    } else {
      supportingAgents.push("Prometeo");
      if (intent === "project_report" && preferredAgent !== "Pulse") supportingAgents.push("Pulse");
      if (intent === "payment_status" && preferredAgent !== "Justus") supportingAgents.push("Justus");
      if (intent === "dispute_status" && preferredAgent !== "Marta") supportingAgents.push("Marta");
    }

    return {
      intent,
      primaryAgent,
      supportingAgents,
      contextRequired: this.getRequiredContext(intent),
      systemPromptAddition: AGENT_PERSONAS[primaryAgent],
      selectionSource: preferredAgent && preferredAgent !== "Prometeo" ? "panel_agent" : "intent",
      requestedAgentId: normalizedAgentId ?? undefined,
    };
  }

  isContractorIntent(intent: PrometeoIntentType): boolean {
    return CONTRACTOR_INTENTS.has(intent);
  }

  buildContractorSystemPrompt(ctx: SemseOperationalContext, intent: PrometeoIntentType): string {
    const contextHint = ctx.activeProject
      ? `\n\nCONTEXTO DEL PROYECTO ACTIVO:\n- Título: ${ctx.activeProject.title}\n- Estado: ${ctx.activeProject.status}\n- Hitos activos: ${ctx.milestones.active}`
      : "";

    const jobTypeHint = ctx.jobs.recent[0]?.title
      ? `\n\nTIPO DE TRABAJO RECIENTE: ${ctx.jobs.recent[0].title}`
      : "";

    const intentGuidance: Record<string, string> = {
      estimate_generation: `\n\nINSTRUCCIONES PARA ESTIMADO:
Crea un estimado profesional. El usuario te dará el tipo de trabajo y dimensiones/detalles.
Responde con:
1. Lista de materiales (cantidad, unidad, precio unitario, subtotal)
2. Mano de obra (descripción, horas estimadas o tarifa flat, subtotal)
3. Overhead/misceláneos (10-15% del total)
4. TOTAL
5. Notas: qué no incluye el estimado, validez del precio, condiciones de pago (sugiere 50% depósito)
6. Texto corto listo para enviar al cliente

Si el usuario no da medidas específicas, haz el estimado con medidas típicas (ej. cuarto promedio de 12x12, baño de 50 sqft) y dilo.`,

      price_suggestion: `\n\nINSTRUCCIONES PARA SUGERIR PRECIO:
Da un rango de precio con tres niveles:
- Precio bajo (trabajo básico, materiales económicos)
- Precio medio (trabajo estándar, materiales de calidad media)
- Precio alto (trabajo premium o mercado de alta demanda)

Explica qué incluye cada nivel. Menciona factores que suben o bajan el precio (área metropolitana, urgencia, dificultad de acceso, materiales del cliente).`,

      materials_list: `\n\nINSTRUCCIONES PARA LISTA DE MATERIALES:
Genera una lista específica con:
- Nombre del producto (con especificación: tamaño, tipo, marca si aplica)
- Cantidad necesaria (con 10% de desperdicio incluido)
- Precio unitario estimado en Home Depot / Lowe's
- Total
- Dónde conseguirlo (aisle en HD si lo sabes)

Al final: total estimado de materiales. Nota que los precios pueden variar.`,

      client_message: `\n\nINSTRUCCIONES PARA MENSAJE AL CLIENTE:
Genera un mensaje profesional pero amigable. Incluye:
- Saludo por nombre si el usuario lo proporciona
- El punto principal (avance, retraso, solicitud, cotización)
- Próximo paso claro (con fecha si aplica)
- Forma de contacto o confirmación esperada
- Cierre profesional

Formatos disponibles: WhatsApp (conciso, emojis opcionales), Email (más formal), SMS (muy corto).
Pregunta qué formato prefiere si no lo especifica.`,

      project_summary_client: `\n\nINSTRUCCIONES PARA REPORTE AL CLIENTE:
Genera un resumen ejecutivo del avance del proyecto para enviar al cliente.
Tono: profesional, tranquilizador, claro.
Incluye: % de avance estimado, qué se completó, qué sigue, fecha estimada de terminación o próxima visita.
No uses jerga técnica. El cliente quiere saber si su proyecto va bien y cuándo termina.`,
    };

    return `${CONTRACTOR_EXPERT_PERSONA}${contextHint}${jobTypeHint}${intentGuidance[intent] ?? ""}`;
  }

  buildSystemPrompt(agentId: string, ctx: SemseOperationalContext, route: PrometeoRoute): string {
    // Contractor intents use specialized construction expertise persona
    if (this.isContractorIntent(route.intent)) {
      return this.buildContractorSystemPrompt(ctx, route.intent);
    }

    const persona = AGENT_PERSONAS[route.primaryAgent] ?? AGENT_PERSONAS["Prometeo"];

    const noContextResponse = !ctx.activeProject
      ? `\n\nIMPORTANTE: No hay proyecto activo seleccionado. Cuando el usuario pida información del proyecto, responde así:
"No tengo proyecto seleccionado. Puedo: 1) Buscar tus trabajos recientes, 2) Mostrar proyectos activos, 3) Generar reporte general del sistema.
Trabajos disponibles: ${ctx.jobs.recent.slice(0, 3).map((j) => `"${j.title}" (${j.status})`).join(", ") || "ninguno detectado."}"
`
      : "";

    const selectionInstruction = route.selectionSource === "panel_agent"
      ? `El usuario abrió el panel de ${route.primaryAgent} específicamente. Responde SOLO desde esa perspectiva especializada. Si necesitas datos de otro dominio, mencionalo brevemente pero no te salgas de tu rol.`
      : "Actúa como Prometeo. Usa el contexto disponible para dar una respuesta directa y útil.";

    const assistantStyle = ctx.assistantSettings.assistantTone === "formal"
      ? "Usa un tono profesional y estructurado."
      : ctx.assistantSettings.assistantTone === "technical"
      ? "Usa terminología técnica específica, incluye IDs y datos raw cuando ayuden."
      : ctx.assistantSettings.assistantTone === "executive"
      ? "Sé muy conciso. Bullet points con los puntos clave y recomendación al final."
      : "Sé conversacional y directo, como un colega que conoce bien el proyecto.";

    return `${persona}

${selectionInstruction}

ESTILO DE RESPUESTA: ${assistantStyle}
${ctx.assistantSettings.expertMode ? "MODO EXPERTO: incluye IDs, timestamps, y datos técnicos cuando sean relevantes." : ""}

${noContextResponse}`;
  }

  buildOperationalReport(ctx: SemseOperationalContext): string {
    const lines = [
      "# Reporte Operativo SEMSE OS",
      "",
      `**Estado general:** ${ctx.mode.toUpperCase()}`,
      `**Generado:** ${new Date(ctx.generatedAt).toLocaleString("es-MX")}`,
      "",
    ];

    if (ctx.activeProject) {
      lines.push(`## Proyecto activo: "${ctx.activeProject.title}"`, `Estado: ${ctx.activeProject.status}`, "");
    } else {
      lines.push("## Sin proyecto activo", "Selecciona un proyecto para análisis detallado.", "");
    }

    lines.push(
      "## Trabajos",
      `- Activos: **${ctx.jobs.active}**`,
      `- Esperando propuestas: **${ctx.jobs.waitingProposals}**`,
      `- Completados: **${ctx.jobs.completed}**`,
      "",
      "## Hitos y Pagos",
      `- Hitos activos: **${ctx.milestones.active}**`,
      `- Pendientes de aprobación: **${ctx.milestones.pendingApproval}**`,
      `- Escrow fondeado: **$${ctx.payments.escrowFunded.toLocaleString()} USD**`,
      `- Elegible para liberación: **$${ctx.payments.pendingRelease.toLocaleString()} USD**`,
      "",
      "## Evidencias y Disputas",
      `- Evidencias por revisar: **${ctx.evidences.pendingReview}**`,
      `- Disputas abiertas: **${ctx.disputes.open}**`,
      ctx.disputes.urgent > 0 ? `- ⚠ Disputas urgentes: **${ctx.disputes.urgent}**` : "",
      "",
      "## Notificaciones pendientes",
      `- Sin leer: **${ctx.notifications.length}**`,
      "",
      "## Sistema",
      `- API: ${ctx.systemHealth.api === "ok" ? "✅" : "⚠"} | Worker: ${ctx.systemHealth.worker === "ok" ? "✅" : "⚠"} | Redis: ${ctx.systemHealth.redis === "ok" ? "✅" : "⚠"}`,
    );

    if (ctx.ecosystem5d) {
      lines.push(
        "",
        "## Lente Ecosistema 5D",
        `- Score general: **${ctx.ecosystem5d.score}/100** (${ctx.ecosystem5d.status})`,
        ...ctx.ecosystem5d.dimensions.slice(0, 5).map((dim) =>
          `- ${dim.label}: **${dim.score}/100** (${dim.status}) — ${dim.summary}`
        ),
      );
      if (ctx.ecosystem5d.alerts.length > 0) {
        lines.push(`- Alertas clave: ${ctx.ecosystem5d.alerts.slice(0, 3).map((alert) => `[${alert.dimension}] ${alert.message}`).join(" · ")}`);
      }
    }

    if (ctx.jobs.active > 0 || ctx.milestones.pendingApproval > 0 || ctx.disputes.urgent > 0) {
      lines.push("", "## Acciones recomendadas");
      if (ctx.milestones.pendingApproval > 0) lines.push(`- Revisar ${ctx.milestones.pendingApproval} hito(s) pendiente(s) de aprobación`);
      if (ctx.payments.pendingRelease > 0) lines.push(`- Liberar $${ctx.payments.pendingRelease.toLocaleString()} USD en escrow elegible`);
      if (ctx.disputes.urgent > 0) lines.push(`- Atender ${ctx.disputes.urgent} disputa(s) urgente(s)`);
      if (ctx.evidences.pendingReview > 0) lines.push(`- Revisar ${ctx.evidences.pendingReview} evidencia(s) pendiente(s)`);
    }

    return lines.filter((l) => l !== "").join("\n");
  }

  buildNoProjectSelectedResponse(ctx: SemseOperationalContext, route: PrometeoRoute): string {
    // Contractor intents don't need a project — they work on any request
    if (this.isContractorIntent(route.intent)) {
      return "";
    }

    const recentJobs = ctx.jobs.recent.slice(0, 4);
    const agentName = route.primaryAgent === "Prometeo" || route.primaryAgent === "SEMSE Core"
      ? "yo" : route.primaryAgent;

    let intro = `Para darte información detallada sobre ${this.intentLabel(route.intent)}, necesito que estés dentro de un proyecto.`;

    if (recentJobs.length > 0) {
      const jobList = recentJobs.map(j => `• **${j.title}** — ${j.status}`).join("\n");
      return `${intro}

Estos son tus trabajos más recientes:

${jobList}

Entra a uno de ellos y ${agentName === "yo" ? "puedo" : `${agentName} puede`} darte el análisis completo. También puedo darte un resumen general si lo prefieres — ¿qué te sirve más?`;
    }

    return `${intro}

No detecté trabajos activos para tu cuenta. Puedes crear un trabajo nuevo desde el dashboard, o si crees que hay un error, dime y lo revisamos.`;
  }

  private intentLabel(intent: PrometeoIntentType): string {
    const labels: Record<PrometeoIntentType, string> = {
      operational_summary:    "el resumen operativo",
      project_report:         "el reporte del proyecto",
      evidence_review:        "las evidencias",
      payment_status:         "el estado de pagos",
      dispute_status:         "las disputas",
      schedule_plan:          "el plan y agenda",
      legal_compliance:       "el cumplimiento legal",
      system_health:          "la salud del sistema",
      developer_diagnostics:  "los diagnósticos técnicos",
      budget_estimate:        "la estimación de presupuesto",
      estimate_generation:    "el estimado",
      price_suggestion:       "el precio sugerido",
      materials_list:         "la lista de materiales",
      client_message:         "el mensaje al cliente",
      project_summary_client: "el resumen para el cliente",
      unknown:                "eso",
    };
    return labels[intent] ?? "eso";
  }

  mapIntentToTaskType(intent: PrometeoIntentType): AiTaskType {
    switch (intent) {
      case "operational_summary":
        return "document_summary";
      case "project_report":
        return "project_planning";
      case "evidence_review":
        return "rag_answer";
      case "payment_status":
        return "risk_analysis";
      case "dispute_status":
        return "risk_analysis";
      case "schedule_plan":
        return "project_planning";
      case "legal_compliance":
        return "construction_contract_analysis";
      case "system_health":
        return "document_summary";
      case "developer_diagnostics":
        return "architecture_review";
      case "budget_estimate":
        return "estimate_review";
      case "estimate_generation":
        return "estimate_review";
      case "price_suggestion":
        return "estimate_review";
      case "materials_list":
        return "document_summary";
      case "client_message":
        return "general_chat";
      case "project_summary_client":
        return "project_planning";
      case "unknown":
      default:
        return "general_chat";
    }
  }

  private getRequiredContext(intent: PrometeoIntentType): string[] {
    const map: Record<PrometeoIntentType, string[]> = {
      operational_summary:   ["jobs", "milestones", "payments", "disputes", "notifications"],
      project_report:        ["activeProject", "milestones", "evidences"],
      evidence_review:       ["evidences", "activeProject"],
      payment_status:        ["payments", "milestones"],
      dispute_status:        ["disputes", "payments"],
      schedule_plan:         ["milestones", "activeProject"],
      legal_compliance:      ["activeProject", "jobs"],
      system_health:         ["systemHealth"],
      developer_diagnostics:  ["systemHealth"],
      budget_estimate:        ["jobs"],
      estimate_generation:    [],
      price_suggestion:       [],
      materials_list:         [],
      client_message:         ["activeProject", "jobs"],
      project_summary_client: ["activeProject", "milestones"],
      unknown:                [],
    };
    return map[intent] ?? [];
  }

  private normalizeUiAgentId(agentId?: string): PrometeoUiAgentId | null {
    if (!agentId) return null;
    if (agentId in UI_AGENT_TO_ROUTE_TARGET) {
      return agentId as PrometeoUiAgentId;
    }
    return null;
  }
}
