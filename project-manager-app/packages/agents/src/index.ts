/**
 * @semse/agents — index.ts
 *
 * Catálogo completo de agentes IA del ecosistema SEMSE.
 * Migrado y expandido desde labsemse/src/lib/ai.ts
 * Incluye los 16 agentes nombrados + 6 agentes especializados del sistema.
 */

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

/** Agentes de conversación nombrados (interfaz de usuario) */
export type NamedAgentRole =
  | "assistant"   // semseproject — Asistente central
  | "marta"       // Marta — Legal, cumplimiento y contratos
  | "planner"     // Planner — Planificación y estimaciones
  | "felix"       // Felix — Evidencias, documentos y verificación
  | "escrow"      // Escrow — Pagos y transacciones seguras
  | "justus"      // Justus — Finanzas, escrow y disputas
  | "legal"       // Legal — Normativas y cumplimiento
  | "vesper"      // Vesper — Seguridad y análisis de riesgos
  | "security"    // Security — Ciberseguridad y autenticación
  | "pulse"       // Pulse — Métricas y analytics
  | "binary"      // Binary — Integraciones técnicas y API
  | "tech"        // Tech — Arquitectura y stack
  | "design"      // Design — UX/UI y experiencia
  | "marketing"   // Marketing — Crecimiento y adquisición
  | "health"      // Health — Bienestar del equipo
  | "evidence_coach"; // Evidence Coach — Documentación de evidencia

/** Agentes especializados del sistema (backend, non-conversational) */
export type SpecializedAgentRole =
  | "pricing"         // Cálculo de precios con datos de mercado
  | "job-planner"     // Planificador de trabajos con IA
  | "trust-match"     // Matching de profesionales por reputación
  | "evidence-coach"  // Coaching de evidencia estructurada
  | "risk"            // Evaluación de riesgo por job/contrato
  | "dispute"         // Resolución asistida de disputas
  | "orchestrator"    // Orquestador principal de agentes
  | "ecv";            // ECV — Validación ética constitucional

export type AgentRole = NamedAgentRole | SpecializedAgentRole;

export interface AgentDefinition {
  name: string;
  role: NamedAgentRole;
  description: string;
  avatar: string;
  color: string;
  personality: string;
  initialMessage: string;
  provider: "openai" | "anthropic";
  model: string;
  contextTriggers?: string[]; // páginas/módulos donde este agente es relevante
}

export interface SpecializedAgentDefinition {
  name: string;
  role: SpecializedAgentRole;
  description: string;
  port?: number;
  inputSchema: string;
  outputSchema: string;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  agentRole?: AgentRole;
  trace?: unknown[];
}

export interface AgentQuickAction {
  id: string;
  label: string;
  action: string;
  icon?: string;
}

export interface AgentRunRecord {
  id: string;
  tenantId: string;
  agentRole: AgentRole;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  input: unknown;
  output?: unknown;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export * from "./developer-runtime.js";

// ─────────────────────────────────────────────────────────────
// CATÁLOGO DE AGENTES NOMBRADOS
// ─────────────────────────────────────────────────────────────

export const NAMED_AGENTS: Record<NamedAgentRole, AgentDefinition> = {
  assistant: {
    name: "Prometeo",
    role: "assistant",
    description: "Orquestador principal del ecosistema SEMSE",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=semse",
    color: "#3b82f6",
    personality: "Eres Prometeo, el asistente central de SEMSE. Orquestas contexto operativo, riesgos, hitos, pagos, evidencia y siguientes pasos. Hablas de forma directa, útil y basada en datos reales cuando existen.",
    initialMessage: "Soy Prometeo. ¿Qué necesitas revisar o destrabar?",
    provider: "openai",
    model: "gpt-4o-mini",
    contextTriggers: ["dashboard", "marketplace", "jobs"]
  },
  marta: {
    name: "Marta",
    role: "marta",
    description: "Legal, cumplimiento y contratos",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=marta",
    color: "#8b5cf6",
    personality: "Eres Marta, especialista en cumplimiento, alcance contractual y riesgo legal. Ayudas a interpretar cláusulas, detectar huecos de cumplimiento y señalar qué puntos requieren atención formal.",
    initialMessage: "Soy Marta. Puedo ayudarte a revisar contratos, alcance y cumplimiento.",
    provider: "openai",
    model: "gpt-4o-mini",
    contextTriggers: ["contracts", "compliance", "legal"]
  },
  planner: {
    name: "Planner",
    role: "planner",
    description: "Planificación de trabajos, estimaciones y cronogramas",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=planner",
    color: "#8b5cf6",
    personality: "Eres el Planner de SEMSE. Ayudas a los profesionales a estimar tiempos, definir alcance y crear propuestas sólidas para sus clientes.",
    initialMessage: "Soy el Planner. Cuéntame sobre el trabajo que quieres planificar.",
    provider: "openai",
    model: "gpt-4o-mini",
    contextTriggers: ["jobs/new", "proposals", "bids"]
  },
  felix: {
    name: "Felix",
    role: "felix",
    description: "Evidencia, documentos y verificación de trabajo",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=felix",
    color: "#10b981",
    personality: "Eres Felix, especialista en evidencia operativa. Ayudas a revisar fotos, documentos, entregables de campo y validación de soporte antes de aprobar hitos o cerrar trabajo.",
    initialMessage: "Soy Felix. Revisemos la evidencia y los documentos del trabajo.",
    provider: "openai",
    model: "gpt-4o-mini",
    contextTriggers: ["evidence", "documents", "milestones", "worklogs"]
  },
  escrow: {
    name: "Escrow",
    role: "escrow",
    description: "Pagos, escrow y transacciones seguras",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=escrow",
    color: "#ff6a00",
    personality: "Eres el agente de Escrow. Explicas cómo funciona el sistema de pagos seguros, cuándo se liberan los fondos y cómo proteger tanto a clientes como profesionales.",
    initialMessage: "Soy el agente de Escrow. Te ayudo a entender cómo funcionan los pagos seguros en SEMSE.",
    provider: "openai",
    model: "gpt-4o-mini",
    contextTriggers: ["escrow", "payments", "milestones"]
  },
  justus: {
    name: "Justus",
    role: "justus",
    description: "Pagos, escrow y disputas",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=justus",
    color: "#f59e0b",
    personality: "Eres Justus, especialista financiero y de resolución de disputas. Interpretas escrow, facturas, liberaciones, cobranza y conflictos entre cliente y profesional con criterio neutral y operativo.",
    initialMessage: "Soy Justus. Puedo ayudarte con pagos, escrow, facturas o disputas.",
    provider: "openai",
    model: "gpt-4o-mini",
    contextTriggers: ["payments", "escrow", "finance", "disputes"]
  },
  legal: {
    name: "Legal",
    role: "legal",
    description: "Normativas, cumplimiento y regulaciones aplicables",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=legal",
    color: "#64748b",
    personality: "Eres el agente Legal. Orientas sobre normativas aplicables, licencias requeridas y cumplimiento regulatorio en proyectos de construcción y servicios.",
    initialMessage: "Soy el agente Legal. ¿Tienes dudas sobre normativas o cumplimiento en tu proyecto?",
    provider: "openai",
    model: "gpt-4o-mini",
    contextTriggers: ["compliance", "contracts"]
  },
  vesper: {
    name: "Vesper",
    role: "vesper",
    description: "Análisis de riesgo y evaluación de confiabilidad",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=vesper",
    color: "#ec4899",
    personality: "Eres Vesper, especialista en análisis de riesgo y evaluación de confiabilidad. Ayudas a identificar señales de alerta en proyectos y profesionales.",
    initialMessage: "Soy Vesper. Puedo ayudarte a evaluar el riesgo de un proyecto o profesional.",
    provider: "openai",
    model: "gpt-4o-mini",
    contextTriggers: ["trust", "disputes", "professionals"]
  },
  security: {
    name: "Security",
    role: "security",
    description: "Seguridad de la cuenta, autenticación y privacidad",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=security",
    color: "#ef4444",
    personality: "Eres el agente de Security. Ayudas con la seguridad de la cuenta, configuraciones de privacidad y detección de comportamientos sospechosos.",
    initialMessage: "Soy el agente de Security. ¿Tienes alguna preocupación sobre la seguridad de tu cuenta?",
    provider: "openai",
    model: "gpt-4o-mini",
    contextTriggers: ["auth", "settings", "admin"]
  },
  pulse: {
    name: "Pulse",
    role: "pulse",
    description: "Métricas, salud operativa y actividad del sistema",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=pulse",
    color: "#f97316",
    personality: "Eres Pulse, especialista en métricas, salud operativa y actividad del sistema. Interpretas KPIs, cuellos de botella, tendencias y señales tempranas de riesgo.",
    initialMessage: "Soy Pulse. Veamos métricas, actividad y salud operativa.",
    provider: "openai",
    model: "gpt-4o-mini",
    contextTriggers: ["dashboard", "reports", "analytics", "ops"]
  },
  binary: {
    name: "Binary",
    role: "binary",
    description: "Integraciones técnicas, API y automatizaciones",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=binary",
    color: "#a3e635",
    personality: "Eres Binary, especialista en integraciones técnicas y API. Ayudas con webhooks, automatizaciones y conexiones entre sistemas.",
    initialMessage: "Soy Binary. ¿Necesitas ayuda con alguna integración técnica o automatización?",
    provider: "openai",
    model: "gpt-4o-mini",
    contextTriggers: ["api", "integrations", "webhooks"]
  },
  tech: {
    name: "Tech",
    role: "tech",
    description: "Arquitectura del sistema y stack tecnológico",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=tech",
    color: "#7c3aed",
    personality: "Eres Tech, experto en arquitectura de sistemas y stack tecnológico de SEMSE. Ayudas a entender cómo funciona el sistema y cómo escalar.",
    initialMessage: "Soy Tech. ¿Tienes preguntas sobre la arquitectura o el stack de SEMSE?",
    provider: "openai",
    model: "gpt-4o-mini",
    contextTriggers: ["architecture", "cortex"]
  },
  design: {
    name: "Design",
    role: "design",
    description: "UX/UI, experiencia del usuario y diseño de interfaces",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=design",
    color: "#f472b6",
    personality: "Eres Design, especialista en UX/UI y experiencia del usuario. Ayudas a mejorar la usabilidad y el diseño de flujos.",
    initialMessage: "Soy Design. ¿Tienes dudas sobre la experiencia o el diseño de algún flujo?",
    provider: "openai",
    model: "gpt-4o-mini",
    contextTriggers: ["dashboard", "marketplace"]
  },
  marketing: {
    name: "Marketing",
    role: "marketing",
    description: "Crecimiento, adquisición y estrategia de go-to-market",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=marketing",
    color: "#fb923c",
    personality: "Eres Marketing, especialista en crecimiento y adquisición. Ayudas a profesionales a mejorar su perfil y a clientes a encontrar los mejores servicios.",
    initialMessage: "Soy Marketing. ¿Quieres mejorar tu visibilidad o estrategia de crecimiento?",
    provider: "openai",
    model: "gpt-4o-mini",
    contextTriggers: ["professionals", "profile", "marketplace"]
  },
  health: {
    name: "Health",
    role: "health",
    description: "Bienestar del equipo y gestión de incidentes",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=health",
    color: "#34d399",
    personality: "Eres Health, especialista en bienestar del equipo y gestión de incidentes. Ayudas a registrar y resolver incidentes en obra de forma segura.",
    initialMessage: "Soy Health. ¿Hay algún incidente que reportar o tema de bienestar del equipo?",
    provider: "openai",
    model: "gpt-4o-mini",
    contextTriggers: ["incidents", "worklogs", "units"]
  },
  evidence_coach: {
    name: "Evidence Coach",
    role: "evidence_coach",
    description: "Guía para documentar evidencia de alta calidad",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=evidence",
    color: "#fbbf24",
    personality: "Eres el Evidence Coach. Guías a los profesionales para documentar su trabajo con evidencia estructurada, fotos relevantes y checklists completos.",
    initialMessage: "Soy el Evidence Coach. Te ayudo a documentar tu trabajo de forma que sea verificable y aprobado rápidamente.",
    provider: "openai",
    model: "gpt-4o-mini",
    contextTriggers: ["evidence", "milestones"]
  }
};

// ─────────────────────────────────────────────────────────────
// CATÁLOGO DE AGENTES ESPECIALIZADOS (backend)
// ─────────────────────────────────────────────────────────────

export const SPECIALIZED_AGENTS: Record<string, SpecializedAgentDefinition> = {
  pricing: {
    name: "Pricing Agent",
    role: "pricing",
    description: "Cálculo de precios con datos de mercado en tiempo real",
    inputSchema: "{ jobCategory: string; location: string; scope: string }",
    outputSchema: "{ estimatedMin: number; estimatedMax: number; confidence: number; breakdown: PriceBreakdown[] }"
  },
  "job-planner": {
    name: "Job Planner Agent",
    role: "job-planner",
    description: "Planificador de trabajos con IA — genera milestones y cronograma",
    inputSchema: "{ title: string; scope: string; budget: number; deadline?: Date }",
    outputSchema: "{ milestones: MilestoneProposal[]; estimatedDays: number; risks: string[] }"
  },
  "trust-match": {
    name: "Trust Match Agent",
    role: "trust-match",
    description: "Matching de profesionales basado en reputación y historial verificado",
    inputSchema: "{ jobId: string; category: string; budget: number; location: string }",
    outputSchema: "{ matches: ProfessionalMatch[]; topMatch: string; reasoning: string }"
  },
  "evidence-coach": {
    name: "Evidence Coach Agent",
    role: "evidence-coach",
    description: "Coaching de evidencia estructurada con checklist adaptativo",
    inputSchema: "{ milestoneId: string; jobCategory: string; uploadedFiles: string[] }",
    outputSchema: "{ feedback: string; missingItems: string[]; qualityScore: number; approved: boolean }"
  },
  risk: {
    name: "Risk Assessment Agent",
    role: "risk",
    description: "Evaluación de riesgo por job, contrato y actor del sistema",
    inputSchema: "{ jobId: string; actorId: string; context: RiskContext }",
    outputSchema: "{ riskScore: number; riskLevel: 'low'|'medium'|'high'; flags: RiskFlag[]; recommendation: string }"
  },
  dispute: {
    name: "Dispute Resolution Agent",
    role: "dispute",
    description: "Resolución asistida de disputas con análisis de evidencia",
    inputSchema: "{ disputeId: string; evidence: Evidence[]; timeline: TimelineEvent[] }",
    outputSchema: "{ recommendation: string; favoredParty: string; reasoning: string; confidence: number }"
  },
  orchestrator: {
    name: "Orchestrator",
    role: "orchestrator",
    description: "Orquestador principal — coordina agentes especializados y expone métricas",
    inputSchema: "{ task: string; context: OrchestratorContext }",
    outputSchema: "{ result: unknown; agentsUsed: string[]; executionMs: number }"
  },
  ecv: {
    name: "ECV — Ethical Constitutional Validator",
    role: "ecv",
    description: "Validación ética constitucional — revisa que las respuestas de agentes cumplan los principios del sistema",
    inputSchema: "{ agentRole: AgentRole; response: string; context: string }",
    outputSchema: "{ passed: boolean; violations: EthicalViolation[]; revisedResponse?: string }"
  }
};

export const ANATOMY_AGENTS = {
  "anatomy-ingestor": {
    name: "Anatomy Ingestor Agent",
    description: "Extrae referencias anatómicas desde texto libre y las mapea a nodos canónicos",
    inputSchema: "{ text: string }",
    outputSchema: "{ matches: AnatomyReferenceMatch[]; confidence: number }"
  },
  "anatomy-normalizer": {
    name: "Anatomy Normalizer Agent",
    description: "Normaliza términos anatómicos y resuelve alias contra la ontología canónica",
    inputSchema: "{ term: string }",
    outputSchema: "{ normalized: string; matches: AnatomyNodeRef[]; confidence: number }"
  },
  "anatomy-validator": {
    name: "Anatomy Validator Agent",
    description: "Valida integridad estructural del dominio anatómico y sus relaciones",
    inputSchema: "{ scope?: string }",
    outputSchema: "{ valid: boolean; issues: string[]; confidence: number }"
  },
  "anatomy-tutor": {
    name: "Anatomy Tutor Agent",
    description: "Responde consultas anatómicas usando la base estructurada de conocimiento",
    inputSchema: "{ nodeId?: string; question?: string; search?: string }",
    outputSchema: "{ answer: string; node: AnatomyNode | null; path: AnatomyNode[]; children: AnatomyNode[] }"
  }
} as const;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/** Todos los roles de agentes nombrados */
export const namedAgentRoles = Object.keys(NAMED_AGENTS) as NamedAgentRole[];

/** Legacy catalog — mantiene compatibilidad con código existente */
export const agentCatalog = [
  "pricing",
  "job-planner",
  "trust-match",
  "evidence-coach",
  "risk",
  "dispute",
  "orchestrator",
  "ecv",
  "field-ops",
  "project-copilot"
] as const;

export type AgentCatalogRole = (typeof agentCatalog)[number];

/** Retorna el agente nombrado para un rol dado */
export function getNamedAgent(role: NamedAgentRole): AgentDefinition {
  return NAMED_AGENTS[role];
}

/** Retorna el color de un agente por rol */
export function getAgentColor(role: NamedAgentRole): string {
  return NAMED_AGENTS[role]?.color ?? "#3b82f6";
}

/** Retorna agentes relevantes para una página/contexto dado */
export function getAgentsForContext(context: string): AgentDefinition[] {
  return namedAgentRoles
    .map(role => NAMED_AGENTS[role])
    .filter(agent => agent.contextTriggers?.some(trigger => context.includes(trigger)));
}

export {
  type AgentApprovalRequest,
  type AgentAuditEvent,
  type AgentPolicyInput,
  type AgentPolicyResult,
  type AgentRiskAssessment,
  type AgentToolDefinition,
  type AgentToolPolicyResult,
  type GovernedAgentExecutionResult,
  type RuntimeAgentManifest,
  type RuntimeAgentRole,
  agentPolicyDecisions,
  agentRiskLevels,
  agentToolRegistry,
  approvalStatuses,
  classifyAgentRisk,
  createApprovalRequests,
  evaluateAgentPolicy,
  getRuntimeAgentManifest,
  resolveAllowedContextEnvelope,
  runtimeAgentManifests,
  runtimeAgentRoles
} from "./governance.js";
export {
  executeGovernedAgentRun,
  executeSpecializedAgent,
  type RuntimeAgentResult
} from "./runtime.js";
export { getActionPolicy, resolveApprovalMode } from "./action-policy.js";
export { AgentRegistry, type AgentRegistration } from "./registry.js";
export { AgentRegistry as AgentRegistrations } from "./registrations.js";
export {
  delegateTo,
  delegateAll,
  DELEGATE_BLOCKED_ROLES,
  type DelegateOptions,
  type DelegateResult,
} from "./delegate.js";
