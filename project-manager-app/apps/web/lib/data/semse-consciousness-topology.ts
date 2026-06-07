/**
 * SEMSE Neural Topology
 *
 * Representa SEMSEproject como un organismo vivo con 7 regiones cerebrales (cortex)
 * Cada cortex contiene neuronas (módulos), sinapsis (dependencias), y flujos de energía (eventos)
 */

export type CortexType =
  | "comercial"
  | "operacional"
  | "financiero"
  | "evidencia"
  | "gobernanza"
  | "ia"
  | "infraestructura";

export type NeuronStatus =
  | "embryonic"
  | "developing"
  | "functional"
  | "partial"
  | "mature"
  | "critical"
  | "broken";

export type SynapseType =
  | "creates"
  | "depends_on"
  | "approves"
  | "blocks"
  | "triggers"
  | "feeds"
  | "observes"
  | "validates"
  | "monetizes";

export interface Neuron {
  id: string;
  label: string;
  cortex: CortexType;
  status: NeuronStatus;
  maturity: number; // 0-100
  criticality: "low" | "medium" | "high" | "critical";
  monetizationImpact: "none" | "low" | "medium" | "high";
  energy: number; // 0-100, cuánta energía está fluyendo ahora
  description: string;
  inputs: string[];
  outputs: string[];
}

export interface Synapse {
  source: string;
  target: string;
  type: SynapseType;
  strength: "weak" | "medium" | "strong" | "critical";
  label: string;
  description: string;
}

export interface CortexRegion {
  id: CortexType;
  name: string;
  description: string;
  color: string;
  neurons: Neuron[];
  energyFlow: number; // 0-100
  healthScore: number; // 0-100
}

export const SEMSE_NEURONS: Record<string, Neuron> = {
  // CORTEX COMERCIAL
  landing: {
    id: "landing",
    label: "Landing Page",
    cortex: "comercial",
    status: "mature",
    maturity: 95,
    criticality: "high",
    monetizationImpact: "high",
    energy: 45,
    description: "Punto de entrada para clientes nuevos",
    inputs: ["user_browser"],
    outputs: ["intake_initiation"],
  },
  smart_intake: {
    id: "smart_intake",
    label: "Smart Intake",
    cortex: "comercial",
    status: "mature",
    maturity: 90,
    criticality: "critical",
    monetizationImpact: "high",
    energy: 65,
    description: "Clasificación inteligente de trabajos por categoría",
    inputs: ["user_description", "photos", "location"],
    outputs: ["job_draft", "budget_estimate"],
  },
  marketplace: {
    id: "marketplace",
    label: "Marketplace",
    cortex: "comercial",
    status: "partial",
    maturity: 65,
    criticality: "high",
    monetizationImpact: "high",
    energy: 35,
    description: "Conexión cliente-contratista",
    inputs: ["job_published", "contractor_profile"],
    outputs: ["job_match", "contract"],
  },
  communications: {
    id: "communications",
    label: "Communications Gateway",
    cortex: "comercial",
    status: "functional",
    maturity: 85,
    criticality: "high",
    monetizationImpact: "medium",
    energy: 70,
    description: "WhatsApp, SMS, notificaciones",
    inputs: ["webhook_message", "system_event"],
    outputs: ["inbox_message", "notification"],
  },
  crm: {
    id: "crm",
    label: "Client CRM",
    cortex: "comercial",
    status: "functional",
    maturity: 75,
    criticality: "medium",
    monetizationImpact: "medium",
    energy: 40,
    description: "Historial y perfil de clientes",
    inputs: ["client_interaction", "payment_history"],
    outputs: ["client_insights", "engagement_score"],
  },

  // CORTEX OPERACIONAL
  buildops: {
    id: "buildops",
    label: "BuildOps",
    cortex: "operacional",
    status: "mature",
    maturity: 88,
    criticality: "critical",
    monetizationImpact: "high",
    energy: 80,
    description: "Gestión de proyectos en campo",
    inputs: ["project_contract", "team_assignment"],
    outputs: ["milestone_update", "field_status"],
  },
  projects: {
    id: "projects",
    label: "Projects",
    cortex: "operacional",
    status: "mature",
    maturity: 90,
    criticality: "critical",
    monetizationImpact: "high",
    energy: 75,
    description: "Núcleo de gestión de proyectos",
    inputs: ["job_accepted", "scope_change"],
    outputs: ["project_status", "milestones"],
  },
  milestones: {
    id: "milestones",
    label: "Milestones",
    cortex: "operacional",
    status: "mature",
    maturity: 92,
    criticality: "critical",
    monetizationImpact: "high",
    energy: 70,
    description: "Divisiones controladas de trabajo",
    inputs: ["project_plan", "scope_version"],
    outputs: ["milestone_status", "payment_condition"],
  },
  task_management: {
    id: "task_management",
    label: "Task Management",
    cortex: "operacional",
    status: "functional",
    maturity: 80,
    criticality: "medium",
    monetizationImpact: "medium",
    energy: 55,
    description: "Asignación y seguimiento de tareas",
    inputs: ["milestone", "team"],
    outputs: ["task_status", "completion_signal"],
  },
  field_updates: {
    id: "field_updates",
    label: "Field Updates",
    cortex: "operacional",
    status: "functional",
    maturity: 78,
    criticality: "high",
    monetizationImpact: "medium",
    energy: 65,
    description: "Actualizaciones en tiempo real desde campo",
    inputs: ["worker_input", "location_tracking"],
    outputs: ["operational_event", "field_log"],
  },

  // CORTEX FINANCIERO
  escrow: {
    id: "escrow",
    label: "Escrow System",
    cortex: "financiero",
    status: "functional",
    maturity: 85,
    criticality: "critical",
    monetizationImpact: "high",
    energy: 60,
    description: "Holding seguro de fondos",
    inputs: ["payment_request", "milestone_approval"],
    outputs: ["escrow_status", "release_signal"],
  },
  payment_engine: {
    id: "payment_engine",
    label: "Payment Engine",
    cortex: "financiero",
    status: "mature",
    maturity: 92,
    criticality: "critical",
    monetizationImpact: "high",
    energy: 75,
    description: "Procesamiento de pagos",
    inputs: ["escrow_release", "invoice"],
    outputs: ["payment_confirmation", "receipt"],
  },
  payment_governance: {
    id: "payment_governance",
    label: "Payment Governance",
    cortex: "financiero",
    status: "functional",
    maturity: 82,
    criticality: "critical",
    monetizationImpact: "high",
    energy: 70,
    description: "Reglas y aprobaciones de pago",
    inputs: ["milestone_status", "evidence_validation"],
    outputs: ["can_release", "blocker_signal"],
  },
  disputes: {
    id: "disputes",
    label: "Disputes",
    cortex: "financiero",
    status: "functional",
    maturity: 75,
    criticality: "high",
    monetizationImpact: "high",
    energy: 20,
    description: "Gestión de conflictos de pago",
    inputs: ["payment_dispute", "evidence", "timeline"],
    outputs: ["dispute_resolution", "settlement"],
  },

  // CORTEX EVIDENCIA
  evidence_upload: {
    id: "evidence_upload",
    label: "Evidence Upload",
    cortex: "evidencia",
    status: "functional",
    maturity: 88,
    criticality: "high",
    monetizationImpact: "high",
    energy: 75,
    description: "Captura de fotos, videos, documentos",
    inputs: ["worker_input", "mobile_app"],
    outputs: ["evidence_item", "metadata"],
  },
  evidence_review: {
    id: "evidence_review",
    label: "Evidence Review Agent",
    cortex: "evidencia",
    status: "functional",
    maturity: 80,
    criticality: "critical",
    monetizationImpact: "high",
    energy: 65,
    description: "Validación de evidencia contra scope",
    inputs: ["evidence_item", "milestone", "expected_work"],
    outputs: ["evidence_score", "approval_decision"],
  },
  evidence_storage: {
    id: "evidence_storage",
    label: "Evidence Storage",
    cortex: "evidencia",
    status: "mature",
    maturity: 95,
    criticality: "high",
    monetizationImpact: "low",
    energy: 40,
    description: "Almacenamiento inmutable de pruebas",
    inputs: ["evidence_item"],
    outputs: ["evidence_reference", "hash"],
  },
  trust_signals: {
    id: "trust_signals",
    label: "Trust Signals",
    cortex: "evidencia",
    status: "functional",
    maturity: 72,
    criticality: "high",
    monetizationImpact: "medium",
    energy: 55,
    description: "Análisis de confianza basado en evidencia",
    inputs: ["evidence_quality", "behavioral_pattern"],
    outputs: ["trust_score", "reputation_update"],
  },

  // CORTEX GOBERNANZA
  governance_proposals: {
    id: "governance_proposals",
    label: "Governance Proposals",
    cortex: "gobernanza",
    status: "functional",
    maturity: 78,
    criticality: "medium",
    monetizationImpact: "low",
    energy: 30,
    description: "Propuestas de decisión colectiva",
    inputs: ["system_event", "stakeholder_signal"],
    outputs: ["proposal", "vote_request"],
  },
  governance_voting: {
    id: "governance_voting",
    label: "Governance Voting",
    cortex: "gobernanza",
    status: "functional",
    maturity: 80,
    criticality: "medium",
    monetizationImpact: "low",
    energy: 25,
    description: "Votación cuadrática y MCA",
    inputs: ["proposal", "voter_participation"],
    outputs: ["vote_result", "consensus"],
  },
  trust_passport: {
    id: "trust_passport",
    label: "Trust Passport",
    cortex: "gobernanza",
    status: "functional",
    maturity: 75,
    criticality: "high",
    monetizationImpact: "medium",
    energy: 50,
    description: "Identidad verificada y reputación",
    inputs: ["trust_score", "verification", "behavioral_health"],
    outputs: ["passport_level", "access_rights"],
  },
  observer: {
    id: "observer",
    label: "Observer / Consciousness",
    cortex: "gobernanza",
    status: "functional",
    maturity: 78,
    criticality: "high",
    monetizationImpact: "low",
    energy: 85,
    description: "Auto-observación del sistema",
    inputs: ["all_events", "system_metrics"],
    outputs: ["system_diagnosis", "risk_alert"],
  },

  // CORTEX IA
  prometeo: {
    id: "prometeo",
    label: "Prometeo RAG Agent",
    cortex: "ia",
    status: "functional",
    maturity: 82,
    criticality: "high",
    monetizationImpact: "high",
    energy: 60,
    description: "Razonamiento y recomendaciones",
    inputs: ["user_question", "context", "documents"],
    outputs: ["recommendation", "explanation"],
  },
  rag_library: {
    id: "rag_library",
    label: "Trade Knowledge Library",
    cortex: "ia",
    status: "functional",
    maturity: 85,
    criticality: "high",
    monetizationImpact: "medium",
    energy: 55,
    description: "32 documentos, 181 chunks indexados",
    inputs: ["trade_manuals", "specifications"],
    outputs: ["embeddings", "retrieval_results"],
  },
  llm_router: {
    id: "llm_router",
    label: "LLM Router",
    cortex: "ia",
    status: "functional",
    maturity: 88,
    criticality: "high",
    monetizationImpact: "low",
    energy: 70,
    description: "Selecciona LLM óptimo (Anthropic/OpenAI/Ollama)",
    inputs: ["query", "model_availability"],
    outputs: ["llm_response", "cost_metric"],
  },
  protools_agent: {
    id: "protools_agent",
    label: "ProTools Agent",
    cortex: "ia",
    status: "mature",
    maturity: 92,
    criticality: "critical",
    monetizationImpact: "high",
    energy: 65,
    description: "27/27 herramientas de oficio",
    inputs: ["trade", "scope", "conditions"],
    outputs: ["estimate", "risks", "materials"],
  },

  // CORTEX INFRAESTRUCTURA
  postgresql: {
    id: "postgresql",
    label: "PostgreSQL",
    cortex: "infraestructura",
    status: "mature",
    maturity: 98,
    criticality: "critical",
    monetizationImpact: "none",
    energy: 80,
    description: "Base de datos fuente de verdad",
    inputs: ["write_command"],
    outputs: ["data_response"],
  },
  redis: {
    id: "redis",
    label: "Redis Cache",
    cortex: "infraestructura",
    status: "mature",
    maturity: 95,
    criticality: "high",
    monetizationImpact: "none",
    energy: 60,
    description: "Caché de sesiones y datos calientes",
    inputs: ["cache_request"],
    outputs: ["cached_response"],
  },
  api_gateway: {
    id: "api_gateway",
    label: "API Gateway",
    cortex: "infraestructura",
    status: "mature",
    maturity: 92,
    criticality: "critical",
    monetizationImpact: "none",
    energy: 85,
    description: "NestJS API, /v1/* routes",
    inputs: ["http_request"],
    outputs: ["api_response"],
  },
  sse_layer: {
    id: "sse_layer",
    label: "Server-Sent Events",
    cortex: "infraestructura",
    status: "functional",
    maturity: 80,
    criticality: "medium",
    monetizationImpact: "low",
    energy: 65,
    description: "Real-time events para clientes",
    inputs: ["system_event"],
    outputs: ["client_notification"],
  },
  mission_control: {
    id: "mission_control",
    label: "Mission Control",
    cortex: "infraestructura",
    status: "functional",
    maturity: 75,
    criticality: "high",
    monetizationImpact: "low",
    energy: 75,
    description: "Observabilidad y diagnóstico",
    inputs: ["logs", "metrics", "traces"],
    outputs: ["dashboard", "alerts"],
  },
  railway: {
    id: "railway",
    label: "Railway Deployment",
    cortex: "infraestructura",
    status: "functional",
    maturity: 70,
    criticality: "critical",
    monetizationImpact: "none",
    energy: 50,
    description: "Orquestación de servicios",
    inputs: ["docker_image"],
    outputs: ["running_service"],
  },
};

export const SEMSE_SYNAPSES: Synapse[] = [
  // FLUJO COMERCIAL
  {
    source: "landing",
    target: "smart_intake",
    type: "triggers",
    strength: "strong",
    label: "Inicio",
    description: "Cliente solicita trabajo",
  },
  {
    source: "smart_intake",
    target: "protools_agent",
    type: "triggers",
    strength: "strong",
    label: "Clasificación",
    description: "Categoría → Estimación",
  },
  {
    source: "protools_agent",
    target: "smart_intake",
    type: "feeds",
    strength: "strong",
    label: "Datos técnicos",
    description: "Presupuesto y riesgos",
  },
  {
    source: "smart_intake",
    target: "marketplace",
    type: "creates",
    strength: "strong",
    label: "Publicación",
    description: "Job publicado",
  },

  // FLUJO OPERACIONAL
  {
    source: "marketplace",
    target: "projects",
    type: "creates",
    strength: "strong",
    label: "Aceptación",
    description: "Contratista acepta → Proyecto creado",
  },
  {
    source: "projects",
    target: "milestones",
    type: "creates",
    strength: "strong",
    label: "División",
    description: "Proyecto → Hitos de control",
  },
  {
    source: "milestones",
    target: "task_management",
    type: "creates",
    strength: "medium",
    label: "Asignación",
    description: "Tareas para equipo",
  },
  {
    source: "task_management",
    target: "buildops",
    type: "feeds",
    strength: "strong",
    label: "Estado",
    description: "Avance del trabajo",
  },
  {
    source: "field_updates",
    target: "buildops",
    type: "feeds",
    strength: "strong",
    label: "Tiempo real",
    description: "Updates desde campo",
  },

  // FLUJO EVIDENCIA
  {
    source: "field_updates",
    target: "evidence_upload",
    type: "triggers",
    strength: "strong",
    label: "Captura",
    description: "Fotos y videos desde campo",
  },
  {
    source: "evidence_upload",
    target: "evidence_review",
    type: "feeds",
    strength: "strong",
    label: "Análisis",
    description: "Validación de evidencia",
  },
  {
    source: "evidence_review",
    target: "trust_signals",
    type: "feeds",
    strength: "medium",
    label: "Confianza",
    description: "Score de calidad",
  },
  {
    source: "evidence_upload",
    target: "evidence_storage",
    type: "creates",
    strength: "strong",
    label: "Persistencia",
    description: "Almacenamiento inmutable",
  },

  // FLUJO FINANCIERO
  {
    source: "milestones",
    target: "payment_governance",
    type: "feeds",
    strength: "strong",
    label: "Condiciones",
    description: "Hito → Condiciones de pago",
  },
  {
    source: "evidence_review",
    target: "payment_governance",
    type: "feeds",
    strength: "strong",
    label: "Validación",
    description: "Evidencia aprobada",
  },
  {
    source: "payment_governance",
    target: "escrow",
    type: "feeds",
    strength: "strong",
    label: "Autorización",
    description: "Puede liberar dinero",
  },
  {
    source: "escrow",
    target: "payment_engine",
    type: "triggers",
    strength: "critical",
    label: "Ejecución",
    description: "Procesar pago",
  },
  {
    source: "payment_engine",
    target: "crm",
    type: "feeds",
    strength: "medium",
    label: "Historial",
    description: "Transacción completada",
  },

  // FLUJO GOBERNANZA
  {
    source: "payment_engine",
    target: "trust_passport",
    type: "feeds",
    strength: "medium",
    label: "Reputación",
    description: "Pago exitoso = confianza",
  },
  {
    source: "evidence_review",
    target: "trust_passport",
    type: "feeds",
    strength: "medium",
    label: "Calidad",
    description: "Evidencia buena = confianza",
  },
  {
    source: "trust_passport",
    target: "governance_proposals",
    type: "feeds",
    strength: "weak",
    label: "Participación",
    description: "Nivel de voz en decisiones",
  },

  // FLUJO IA
  {
    source: "rag_library",
    target: "prometeo",
    type: "feeds",
    strength: "strong",
    label: "Contexto",
    description: "Documentos y chunks",
  },
  {
    source: "prometeo",
    target: "protools_agent",
    type: "triggers",
    strength: "medium",
    label: "Guía",
    description: "Recomendaciones técnicas",
  },
  {
    source: "rag_library",
    target: "llm_router",
    type: "feeds",
    strength: "medium",
    label: "Indexación",
    description: "Embeddings disponibles",
  },

  // OBSERVACIÓN Y CONCIENCIA
  {
    source: "observer",
    target: "api_gateway",
    type: "observes",
    strength: "strong",
    label: "Métricas",
    description: "Logs y traces",
  },
  {
    source: "observer",
    target: "postgresql",
    type: "observes",
    strength: "strong",
    label: "Estado",
    description: "Datos operacionales",
  },
  {
    source: "payment_governance",
    target: "observer",
    type: "feeds",
    strength: "medium",
    label: "Bloqueadores",
    description: "Señales críticas",
  },
  {
    source: "trust_passport",
    target: "observer",
    type: "feeds",
    strength: "medium",
    label: "Salud",
    description: "Behavioral health",
  },

  // INFRAESTRUCTURA
  {
    source: "api_gateway",
    target: "postgresql",
    type: "depends_on",
    strength: "critical",
    label: "Persistencia",
    description: "API → DB",
  },
  {
    source: "api_gateway",
    target: "redis",
    type: "depends_on",
    strength: "strong",
    label: "Caché",
    description: "Session cache",
  },
  {
    source: "api_gateway",
    target: "llm_router",
    type: "triggers",
    strength: "medium",
    label: "IA",
    description: "Llamadas a LLM",
  },
  {
    source: "mission_control",
    target: "postgresql",
    type: "observes",
    strength: "strong",
    label: "Logs",
    description: "Historial de eventos",
  },
  {
    source: "railway",
    target: "api_gateway",
    type: "triggers",
    strength: "critical",
    label: "Orquestación",
    description: "Servicios corriendo",
  },
  {
    source: "sse_layer",
    target: "communications",
    type: "feeds",
    strength: "strong",
    label: "Notificaciones",
    description: "Real-time a clientes",
  },
];

export const SEMSE_CORTEX: Record<CortexType, CortexRegion> = {
  comercial: {
    id: "comercial",
    name: "Cortex Comercial",
    description: "Adquisición, marketplace, comunicaciones",
    color: "#3b82f6", // blue
    neurons: [
      SEMSE_NEURONS.landing,
      SEMSE_NEURONS.smart_intake,
      SEMSE_NEURONS.marketplace,
      SEMSE_NEURONS.communications,
      SEMSE_NEURONS.crm,
    ],
    energyFlow: 65,
    healthScore: 82,
  },
  operacional: {
    id: "operacional",
    name: "Cortex Operacional",
    description: "Gestión de proyectos, milestones, field ops",
    color: "#10b981", // green
    neurons: [
      SEMSE_NEURONS.buildops,
      SEMSE_NEURONS.projects,
      SEMSE_NEURONS.milestones,
      SEMSE_NEURONS.task_management,
      SEMSE_NEURONS.field_updates,
    ],
    energyFlow: 70,
    healthScore: 85,
  },
  financiero: {
    id: "financiero",
    name: "Cortex Financiero",
    description: "Escrow, pagos, disputas, gobernanza de dinero",
    color: "#f59e0b", // amber
    neurons: [
      SEMSE_NEURONS.escrow,
      SEMSE_NEURONS.payment_engine,
      SEMSE_NEURONS.payment_governance,
      SEMSE_NEURONS.disputes,
    ],
    energyFlow: 58,
    healthScore: 80,
  },
  evidencia: {
    id: "evidencia",
    name: "Cortex Evidencia",
    description: "Captura, revisión, almacenamiento, confianza",
    color: "#8b5cf6", // purple
    neurons: [
      SEMSE_NEURONS.evidence_upload,
      SEMSE_NEURONS.evidence_review,
      SEMSE_NEURONS.evidence_storage,
      SEMSE_NEURONS.trust_signals,
    ],
    energyFlow: 62,
    healthScore: 78,
  },
  gobernanza: {
    id: "gobernanza",
    name: "Cortex Gobernanza",
    description: "Conciencia del sistema, trust, decisiones colectivas",
    color: "#ec4899", // pink
    neurons: [
      SEMSE_NEURONS.governance_proposals,
      SEMSE_NEURONS.governance_voting,
      SEMSE_NEURONS.trust_passport,
      SEMSE_NEURONS.observer,
    ],
    energyFlow: 55,
    healthScore: 75,
  },
  ia: {
    id: "ia",
    name: "Cortex IA",
    description: "RAG, agentes, LLM routing, Prometeo",
    color: "#06b6d4", // cyan
    neurons: [
      SEMSE_NEURONS.prometeo,
      SEMSE_NEURONS.rag_library,
      SEMSE_NEURONS.llm_router,
      SEMSE_NEURONS.protools_agent,
    ],
    energyFlow: 63,
    healthScore: 82,
  },
  infraestructura: {
    id: "infraestructura",
    name: "Cortex Infraestructura",
    description: "Base de datos, caché, API, observabilidad",
    color: "#6b7280", // gray
    neurons: [
      SEMSE_NEURONS.postgresql,
      SEMSE_NEURONS.redis,
      SEMSE_NEURONS.api_gateway,
      SEMSE_NEURONS.sse_layer,
      SEMSE_NEURONS.mission_control,
      SEMSE_NEURONS.railway,
    ],
    energyFlow: 75,
    healthScore: 88,
  },
};

// Flujos monetizables principales
export const MONETIZATION_FLOWS = [
  {
    id: "intake_to_contract",
    name: "Intake → Contract",
    neurons: [
      "landing",
      "smart_intake",
      "protools_agent",
      "marketplace",
      "projects",
    ],
    energyValue: "high",
    description: "Cliente crea job, estimación, contratista aceptaImpulso de inicio del ciclo monetizable",
  },
  {
    id: "execution_to_evidence",
    name: "Execution → Evidence",
    neurons: [
      "projects",
      "milestones",
      "field_updates",
      "evidence_upload",
      "evidence_review",
    ],
    energyValue: "high",
    description: "Trabajo completado y documentado",
  },
  {
    id: "evidence_to_payment",
    name: "Evidence → Payment",
    neurons: [
      "evidence_review",
      "payment_governance",
      "escrow",
      "payment_engine",
      "trust_passport",
    ],
    energyValue: "critical",
    description: "Evidencia validada → Pago liberado → Reputación actualizada",
  },
];
