import { randomUUID } from "node:crypto";
import type { LLMToolCall, LLMToolDefinition } from "../../../infrastructure/llm/llm.service.js";
import type { AgentAction } from "@semse/schemas";
import type { CopilotPlanDraft } from "../plan-mode.types.js";
import {
  defaultRequiresApprovedPlan,
  inferPlanStepCapability,
  inferToolsAllowed,
} from "../plan-tool-policy.service.js";

// ── Tool definitions sent to Claude ──────────────────────────────────────────

export const PLAN_TOOL_NAME = "propose_plan";

export const COPILOT_TOOLS: LLMToolDefinition[] = [
  {
    name: PLAN_TOOL_NAME,
    description:
      "Propone un plan formal multi-paso cuando el usuario necesita ejecutar una secuencia compleja de acciones de alto riesgo (escrow, disputas, milestone approval). OBLIGATORIO antes de ejecutar PROPOSE_ESCROW_RELEASE, PROPOSE_DISPUTE_OPEN. Incluye objetivo, fundamento, riesgos y criterios de éxito.",
    inputSchema: {
      type: "object",
      properties: {
        title:            { type: "string", description: "Título del plan (máx. 80 chars)" },
        goal:             { type: "string", description: "Objetivo concreto del plan (máx. 200 chars)" },
        rationale:        { type: "string", description: "Por qué este plan es el correcto ahora (máx. 300 chars)" },
        description:      { type: "string", description: "Resumen ejecutivo del plan (opcional)" },
        risks: {
          type: "array",
          description: "Riesgos identificados que debe conocer el usuario antes de aprobar",
          items: { type: "string" },
        },
        requiredEvidence: {
          type: "array",
          description: "Documentos o evidencias que deben existir para ejecutar el plan",
          items: { type: "string" },
        },
        successCriteria: {
          type: "array",
          description: "Criterios concretos que indican que el plan se completó con éxito",
          items: { type: "string" },
        },
        steps: {
          type: "array",
          description: "Pasos del plan en orden de ejecución",
          items: {
            type: "object",
            properties: {
              id:              { type: "string", description: "ID estable del paso (opcional). Si no se incluye, el sistema lo genera." },
              title:           { type: "string", description: "Título del paso" },
              description:     { type: "string", description: "Descripción de qué hace este paso" },
              expectedOutcome: { type: "string", description: "Resultado esperado al completar el paso" },
              capability:      { type: "string", description: "Tipo de operación del paso (searching, composing, dispute, shelling, editing, waiting, worker, etc.)" },
              toolsAllowed: {
                type: "array",
                description: "Tools permitidas dentro de este paso",
                items: { type: "string" },
              },
              actionType:      { type: "string", description: "Tipo de acción SEMSE si aplica (PROPOSE_MILESTONE_APPROVAL, PROPOSE_ESCROW_RELEASE, etc.)" },
              dependsOnStepIds: {
                type: "array",
                description: "IDs de pasos que deben completarse antes de este paso",
                items: { type: "string" },
              },
              requiredEvidence: {
                type: "array",
                description: "Evidencia necesaria para habilitar este paso",
                items: { type: "string" },
              },
              requiresApprovedPlan: { type: "boolean", description: "Si el paso exige que el plan ya esté aprobado" },
              riskLevel:       { type: "string", enum: ["low", "medium", "high"], description: "Nivel de riesgo" },
              requiresApproval: { type: "boolean", description: "Si requiere aprobación humana explícita" },
            },
            required: ["title", "description", "expectedOutcome", "riskLevel"],
          },
          minItems: 1,
        },
      },
      required: ["title", "goal", "rationale", "steps"],
    },
  },
  {
    name: "propose_milestone_approval",
    description:
      "Propone aprobar un hito (milestone) cuando la evidencia presentada es suficiente y el trabajo está completo. Solo úsala si el contexto indica evidencia cargada o trabajo terminado.",
    inputSchema: {
      type: "object",
      properties: {
        milestoneId: { type: "string", description: "ID del milestone a aprobar" },
        milestoneName: { type: "string", description: "Nombre del milestone" },
        rationale: { type: "string", description: "Razón por la que se propone la aprobación (máx. 150 chars)" },
      },
      required: ["milestoneId", "milestoneName", "rationale"],
    },
  },
  {
    name: "propose_escrow_release",
    description:
      "Propone liberar fondos del escrow al profesional cuando el trabajo está verificado. Solo cuando los milestones están aprobados y el cliente confirmó conformidad.",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Monto a liberar (USD)" },
        rationale: { type: "string", description: "Razón para la liberación" },
      },
      required: ["amount", "rationale"],
    },
  },
  {
    name: "propose_dispute_open",
    description:
      "Propone abrir una disputa cuando hay evidencia de trabajo no completado, daños, o incumplimiento de scope. Solo ante señales claras de conflicto.",
    inputSchema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Motivo principal de la disputa" },
        description: { type: "string", description: "Descripción detallada del problema" },
      },
      required: ["reason", "description"],
    },
  },
  {
    name: "request_missing_evidence",
    description:
      "Solicita al profesional que cargue evidencia faltante (fotos, videos, recibos) para avanzar con la aprobación de un milestone.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Qué evidencia específica se necesita" },
        milestoneId: { type: "string", description: "ID del milestone relacionado (opcional)" },
      },
      required: ["description"],
    },
  },
  {
    name: "draft_message",
    description:
      "Redacta un mensaje para enviar al profesional o cliente, por ejemplo para aclarar scope, solicitar actualización o confirmar acuerdo.",
    inputSchema: {
      type: "object",
      properties: {
        recipient: { type: "string", enum: ["professional", "client"], description: "Destinatario del mensaje" },
        content: { type: "string", description: "Contenido del mensaje a enviar" },
      },
      required: ["recipient", "content"],
    },
  },
  // ── Searching Tools ────────────────────────────────────────────────────────
  {
    name: "search_patterns",
    description: "Busca patrones de texto o archivos dentro del proyecto.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Patrón o texto a buscar" },
        path: { type: "string", description: "Directorio base para la búsqueda (opcional)" },
      },
      required: ["query"],
    },
  },
  {
    name: "read_file",
    description: "Lee el contenido de un archivo específico del proyecto.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Ruta absoluta o relativa del archivo" },
      },
      required: ["path"],
    },
  },
  {
    name: "list_directory",
    description: "Lista los archivos y subdirectorios de una ruta dada.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Ruta del directorio a listar" },
      },
      required: ["path"],
    },
  },
  // ── Perambulating Tools ───────────────────────────────────────────────────
  {
    name: "explore_project",
    description: "Explora la estructura general del proyecto para entender el contexto.",
    inputSchema: {
      type: "object",
      properties: {
        focus: { type: "string", description: "Área específica en la que enfocarse (opcional)" },
      },
    },
  },
  {
    name: "inspect_structure",
    description: "Inspecciona la estructura detallada de un módulo o directorio.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Ruta a inspeccionar" },
      },
      required: ["path"],
    },
  },
  {
    name: "summarize_findings",
    description: "Genera un resumen de los hallazgos tras una exploración o búsqueda.",
    inputSchema: {
      type: "object",
      properties: {
        findings: { type: "string", description: "Descripción detallada de lo encontrado" },
      },
      required: ["findings"],
    },
  },
  // ── Shelling Tools ────────────────────────────────────────────────────────
  {
    name: "run_command",
    description: "Ejecuta un comando permitido en la terminal del proyecto.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Línea de comando a ejecutar" },
      },
      required: ["command"],
    },
  },
  {
    name: "run_build",
    description: "Ejecuta el proceso de build del proyecto.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "run_typecheck",
    description: "Ejecuta la validación de tipos del proyecto.",
    inputSchema: { type: "object", properties: {} },
  },
  // ── Editing Tools ─────────────────────────────────────────────────────────
  {
    name: "edit_file",
    description: "Modifica el contenido de un archivo.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Ruta del archivo a editar" },
        content: { type: "string", description: "Nuevo contenido completo del archivo" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "apply_patch",
    description: "Aplica un diff o patch a un archivo.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Ruta del archivo" },
        patch: { type: "string", description: "Contenido del patch" },
      },
      required: ["path", "patch"],
    },
  },
  // ── Testing Tools ─────────────────────────────────────────────────────────
  {
    name: "run_tests",
    description: "Ejecuta la suite de tests del proyecto.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Filtro para tests específicos (opcional)" },
      },
    },
  },
  {
    name: "inspect_test_failure",
    description: "Analiza el fallo de un test específico.",
    inputSchema: {
      type: "object",
      properties: {
        testName: { type: "string", description: "Nombre del test fallido" },
      },
      required: ["testName"],
    },
  },
  // ── Waiting/Worker Tools ──────────────────────────────────────────────────
  {
    name: "wait_background_terminal",
    description: "Espera a que un proceso en background termine.",
    inputSchema: {
      type: "object",
      properties: {
        terminalId: { type: "string", description: "ID de la terminal a esperar" },
      },
      required: ["terminalId"],
    },
  },
  {
    name: "read_background_result",
    description: "Lee el resultado de un proceso terminado en background.",
    inputSchema: {
      type: "object",
      properties: {
        terminalId: { type: "string", description: "ID de la terminal" },
      },
      required: ["terminalId"],
    },
  },
  {
    name: "propose_dispute_resolve",
    description: "Propone resolver una disputa abierta con una resolución específica.",
    inputSchema: {
      type: "object",
      properties: {
        disputeId: { type: "string", description: "ID de la disputa" },
        resolution: { type: "string", description: "Descripción de la resolución propuesta" },
      },
      required: ["disputeId", "resolution"],
    },
  },
  // ── Delegation Tools ──────────────────────────────────────────────────────
  {
    name: "delegate_task",
    description: "Delega una subtarea técnica a un agente especializado.",
    inputSchema: {
      type: "object",
      properties: {
        agentRole: {
          type: "string",
          enum: ["field-ops", "trust-match", "pricing", "project-copilot"],
          description: "Rol del agente al que delegar"
        },
        task: { type: "string", description: "Descripción detallada de la tarea" },
        context: {
          type: "object",
          description: "Contexto estructurado para el agente delegado (projectId, jobId, prompt, etc.)",
          additionalProperties: true
        },
      },
      required: ["agentRole", "task"],
    },
  },
  {
    name: "request_agent_help",
    description: "Solicita ayuda o aclaración a otro agente del sistema.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "ID o rol del agente" },
        question: { type: "string", description: "Pregunta o solicitud" },
      },
      required: ["agentId", "question"],
    },
  },
  {
    name: "run_browser_mission",
    description: "Planifica y ejecuta una misión autónoma de navegación y raspado (scraping) de páginas web usando motores Chromium (Playwright/Obscura) de forma segura y gobernada. Úsala cuando el usuario te pida buscar, verificar o interactuar con un sitio web externo.",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "Meta u objetivo de la navegación (ej. Verificar listado de precios en Home Depot)" },
        steps: {
          type: "array",
          description: "Secuencia ordenada de pasos interactivos",
          items: {
            type: "object",
            properties: {
              actionType: { type: "string", enum: ["navigate", "get_markdown", "query", "click", "fill"], description: "Acción a realizar" },
              parameters: {
                type: "object",
                description: "Parámetros específicos (url para navigate, selector para query/click/fill, value para fill)",
                properties: {
                  url: { type: "string" },
                  selector: { type: "string" },
                  value: { type: "string" }
                }
              },
              engineUsed: { type: "string", enum: ["PLAYWRIGHT", "OBSCURA"], description: "Motor de renderizado" }
            },
            required: ["actionType"]
          },
          minItems: 1
        }
      },
      required: ["goal", "steps"]
    }
  }
];

// ── Tool call → AgentAction mapping ──────────────────────────────────────────

const TOOL_META: Record<string, { actionType: string; domain: string; riskLevel: string; approvalMode: string }> = {
  propose_milestone_approval: { actionType: "PROPOSE_MILESTONE_APPROVAL", domain: "milestones", riskLevel: "high",   approvalMode: "required"    },
  propose_escrow_release:     { actionType: "PROPOSE_ESCROW_RELEASE",     domain: "escrow",      riskLevel: "high",   approvalMode: "required"    },
  propose_dispute_open:       { actionType: "PROPOSE_DISPUTE_OPEN",       domain: "disputes",    riskLevel: "high",   approvalMode: "required"    },
  request_missing_evidence:   { actionType: "REQUEST_MISSING_EVIDENCE",   domain: "evidence",    riskLevel: "low",    approvalMode: "recommended" },
  draft_message:              { actionType: "DRAFT_MESSAGE",              domain: "jobs",        riskLevel: "low",    approvalMode: "recommended" },
  // Searching
  search_patterns:            { actionType: "SEARCH_PATTERNS",            domain: "internal",    riskLevel: "low",    approvalMode: "none"        },
  read_file:                  { actionType: "READ_FILE",                  domain: "internal",    riskLevel: "low",    approvalMode: "none"        },
  list_directory:             { actionType: "LIST_DIRECTORY",             domain: "internal",    riskLevel: "low",    approvalMode: "none"        },
  // Perambulating
  explore_project:            { actionType: "EXPLORE_PROJECT",            domain: "internal",    riskLevel: "low",    approvalMode: "none"        },
  inspect_structure:          { actionType: "INSPECT_STRUCTURE",          domain: "internal",    riskLevel: "low",    approvalMode: "none"        },
  summarize_findings:         { actionType: "SUMMARIZE_FINDINGS",         domain: "internal",    riskLevel: "low",    approvalMode: "none"        },
  // Shelling
  run_command:                { actionType: "RUN_COMMAND",                domain: "internal",    riskLevel: "medium", approvalMode: "required"    },
  run_build:                  { actionType: "RUN_BUILD",                  domain: "internal",    riskLevel: "medium", approvalMode: "recommended" },
  run_typecheck:              { actionType: "RUN_TYPECHECK",              domain: "internal",    riskLevel: "low",    approvalMode: "none"        },
  // Editing
  edit_file:                  { actionType: "EDIT_FILE",                  domain: "internal",    riskLevel: "medium", approvalMode: "required"    },
  apply_patch:                { actionType: "APPLY_PATCH",                domain: "internal",    riskLevel: "medium", approvalMode: "required"    },
  // Testing
  run_tests:                  { actionType: "RUN_TESTS",                  domain: "internal",    riskLevel: "low",    approvalMode: "none"        },
  inspect_test_failure:       { actionType: "INSPECT_TEST_FAILURE",       domain: "internal",    riskLevel: "low",    approvalMode: "none"        },
  // Waiting/Worker
  wait_background_terminal:   { actionType: "WAIT_BACKGROUND_TERMINAL",   domain: "internal",    riskLevel: "low",    approvalMode: "none"        },
  read_background_result:     { actionType: "READ_BACKGROUND_RESULT",     domain: "internal",    riskLevel: "low",    approvalMode: "none"        },
  propose_dispute_resolve:    { actionType: "PROPOSE_DISPUTE_RESOLVE",    domain: "disputes",    riskLevel: "high",   approvalMode: "required"    },
  // Delegation
  delegate_task:              { actionType: "DELEGATE_TASK",              domain: "delegation",  riskLevel: "medium", approvalMode: "recommended" },
  request_agent_help:         { actionType: "REQUEST_AGENT_HELP",         domain: "delegation",  riskLevel: "low",    approvalMode: "none"        },
  run_browser_mission:        { actionType: "RUN_BROWSER_MISSION",        domain: "internal",    riskLevel: "medium", approvalMode: "required"    },
};

function buildSummary(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "run_browser_mission":
      return `Misión de Navegación: ${String(input.goal ?? "")}`;
    case "propose_milestone_approval":
      return `Aprobar milestone: ${String(input.milestoneName ?? "hito")}`;
    case "propose_escrow_release":
      return `Liberar $${Number(input.amount ?? 0).toLocaleString()} del escrow`;
    case "propose_dispute_open":
      return `Abrir disputa: ${String(input.reason ?? "conflicto")}`;
    case "request_missing_evidence":
      return `Solicitar evidencia: ${String(input.description ?? "").slice(0, 80)}`;
    case "draft_message":
      return `Mensaje para ${String(input.recipient ?? "destinatario")}`;
    case "search_patterns":
      return `Buscar: ${String(input.query ?? "")}`;
    case "read_file":
      return `Leer: ${String(input.path ?? "")}`;
    case "list_directory":
      return `Listar: ${String(input.path ?? "")}`;
    case "run_command":
      return `Ejecutar: ${String(input.command ?? "")}`;
    case "edit_file":
      return `Editar: ${String(input.path ?? "")}`;
    case "run_tests":
      return "Ejecutar suite de tests";
    case "propose_dispute_resolve":
      return `Resolver disputa: ${String(input.disputeId ?? "")}`;
    case "delegate_task":
      return `Delegar a ${String(input.agentRole ?? "agente")}: ${String(input.task ?? "").slice(0, 50)}...`;
    case "request_agent_help":
      return `Consultar a ${String(input.agentId ?? "agente")}`;
    default:
      return toolName;
  }
}

function toTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toRiskLevel(value: unknown): "low" | "medium" | "high" {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

export function toolCallToProposedPlan(toolCall: LLMToolCall | undefined): CopilotPlanDraft | undefined {
  if (!toolCall || toolCall.toolName !== PLAN_TOOL_NAME) return undefined;

  const input = toolCall.input ?? {};
  const steps = Array.isArray(input.steps) ? input.steps : [];
  const normalizedIds = steps.map((step, index) => {
    const raw = step && typeof step === "object" ? step as Record<string, unknown> : {};
    return typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id.trim() : `step_${index + 1}`;
  });

  // Map raw LLM step IDs → normalized IDs so deps resolve correctly.
  // E.g. LLM might say id:"1" and dep:"1" but we normalize id to "step_1".
  const rawToNormalized = new Map<string, string>();
  steps.forEach((step, index) => {
    const raw = step && typeof step === "object" ? step as Record<string, unknown> : {};
    const rawId = typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id.trim() : null;
    if (rawId) rawToNormalized.set(rawId, normalizedIds[index]!);
    // Also map the bare index (e.g. "1" → "step_1")
    rawToNormalized.set(String(index + 1), normalizedIds[index]!);
  });

  function normalizeDeps(deps: string[]): string[] {
    return deps.map((d) => rawToNormalized.get(d) ?? d);
  }

  return {
    title: typeof input.title === "string" && input.title.trim().length > 0 ? input.title.trim() : "Plan del copiloto",
    goal: typeof input.goal === "string" && input.goal.trim().length > 0 ? input.goal.trim() : "Completar la siguiente fase operativa con trazabilidad.",
    rationale: typeof input.rationale === "string" ? input.rationale.trim() : "",
    description: typeof input.description === "string" && input.description.trim().length > 0 ? input.description.trim() : undefined,
    risks: toTextList(input.risks),
    requiredEvidence: toTextList(input.requiredEvidence),
    successCriteria: toTextList(input.successCriteria),
    steps: steps.map((step, index) => {
      const raw = step && typeof step === "object" ? step as Record<string, unknown> : {};
      const riskLevel = toRiskLevel(raw.riskLevel);
      const explicitDependencies = toTextList(raw.dependsOnStepIds);
      const capability = inferPlanStepCapability({
        capability: raw.capability,
        actionType: raw.actionType,
        title: raw.title,
        toolsAllowed: raw.toolsAllowed,
        riskLevel,
      });
      return {
        id: normalizedIds[index],
        order: index + 1,
        title: typeof raw.title === "string" && raw.title.trim().length > 0 ? raw.title.trim() : `Paso ${index + 1}`,
        description: typeof raw.description === "string" ? raw.description.trim() : "",
        expectedOutcome: typeof raw.expectedOutcome === "string" && raw.expectedOutcome.trim().length > 0
          ? raw.expectedOutcome.trim()
          : "Paso completado y listo para verificación.",
        capability,
        toolsAllowed: inferToolsAllowed({
          capability,
          toolsAllowed: raw.toolsAllowed,
          actionType: typeof raw.actionType === "string" ? raw.actionType.trim() : undefined,
        }),
        actionType: typeof raw.actionType === "string" && raw.actionType.trim().length > 0 ? raw.actionType.trim() : undefined,
        dependsOnStepIds: explicitDependencies.length > 0
          ? normalizeDeps(explicitDependencies)
          : index > 0
          ? [normalizedIds[index - 1]!]
          : [],
        requiredEvidence: toTextList(raw.requiredEvidence),
        riskLevel,
        requiresApproval: typeof raw.requiresApproval === "boolean" ? raw.requiresApproval : riskLevel === "high",
        requiresApprovedPlan: defaultRequiresApprovedPlan({
          capability,
          riskLevel,
          explicit: raw.requiresApprovedPlan,
        }),
      };
    }),
  };
}

export function toolCallsToActions(toolCalls: LLMToolCall[]): AgentAction[] {
  return toolCalls.map((call) => {
    const meta = TOOL_META[call.toolName] ?? {
      actionType: call.toolName.toUpperCase(),
      domain: "internal",
      riskLevel: "medium",
      approvalMode: "required",
    };

    return {
      id: randomUUID(),
      type: meta.actionType as AgentAction["type"],
      domain: meta.domain as AgentAction["domain"],
      summary: buildSummary(call.toolName, call.input),
      rationale: String(call.input.rationale ?? call.input.description ?? call.input.reason ?? ""),
      requiredInputs: [],
      riskLevel: meta.riskLevel as AgentAction["riskLevel"],
      approvalMode: meta.approvalMode as AgentAction["approvalMode"],
      toolCall: { toolName: meta.actionType, payload: call.input },
      expectedOutcome: buildSummary(call.toolName, call.input),
      eligibleAt: new Date().toISOString(),
    };
  });
}
