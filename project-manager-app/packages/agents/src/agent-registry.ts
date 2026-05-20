import type { SemseAgentDefinition, SemseAgentName } from './semse-agents.types'

export const SEMSE_AGENT_REGISTRY: Record<SemseAgentName, SemseAgentDefinition> = {
  marketplace: {
    name: 'marketplace',
    displayName: 'Marketplace Agent',
    role: 'Inteligencia comercial — conecta demanda con oferta y escala el ecosistema',
    capabilities: [
      'Clasificar y publicar proyectos',
      'Matching cliente-profesional por oficio, zona y reputación',
      'Ranking y disponibilidad de contratistas',
      'Routing de leads por categoría y geografía',
      'Gestionar reviews y reputación',
      'Activar los demás agentes al asignar un trabajo',
    ],
    forbiddenActions: [
      'Gestionar ejecución del proyecto después de asignado',
      'Calcular materiales o costos detallados',
      'Manejar pagos o disputas',
    ],
    requiredInputs: ['projectDescription', 'location', 'tradeCategory', 'budget'],
    outputs: ['matchedContractors', 'rankedQuotes', 'projectClassification'],
    integratesWith: ['protools', 'buildops', 'crowd', 'evidence', 'prometeo'],
    modules: ['ServiceCatalog', 'ContractorMatcher', 'LeadRouter', 'ReputationEngine', 'AvailabilityEngine', 'GeoExpansion'],
  },

  buildops: {
    name: 'buildops',
    displayName: 'BuildOps Agent',
    role: 'Inteligencia operativa — convierte trabajos en flujos coordinados',
    capabilities: [
      'Crear plan de proyecto con fases y tareas',
      'Gestionar milestones y sus dependencias',
      'Asignar responsables y fechas',
      'Monitorear estado y avance del proyecto',
      'Detectar retrasos y replanificar',
      'Coordinar crews y agenda',
    ],
    forbiddenActions: [
      'Calcular materiales ni costos',
      'Decidir sobre disputas',
      'Liberar pagos',
    ],
    requiredInputs: ['projectId', 'technicalPlan', 'tradeScope', 'timeline'],
    outputs: ['projectPlan', 'milestones', 'tasks', 'crewSchedule', 'progressReport'],
    integratesWith: ['protools', 'crowd', 'evidence', 'prometeo'],
    modules: ['ProjectPlanner', 'MilestoneManager', 'TaskBoard', 'CalendarAssistant', 'CrewCoordination', 'DelayDetector', 'ReplanningEngine'],
  },

  protools: {
    name: 'protools',
    displayName: 'ProTools Agent',
    role: 'Inteligencia técnica — materiales, herramientas, costos y ejecución de obra',
    capabilities: [
      'Calcular materiales y cantidades por oficio (25 trades)',
      'Estimar mano de obra, tiempo y costos',
      'Detectar riesgos técnicos (permisos, licencias, condiciones ocultas)',
      'Generar checklists de preparación y ejecución',
      'Comparar opciones: básico / estándar / premium',
      'Traducir necesidad del cliente en lista técnica real',
    ],
    forbiddenActions: [
      'Manejar pagos ni disputas',
      'Organizar tareas ni asignar responsables',
      'Generar contratos ni documentos legales',
    ],
    requiredInputs: ['tradeType', 'measurements', 'scope', 'toolMode'],
    outputs: ['SemseToolResult', 'quote', 'riskAssessment', 'checklist', 'materialList'],
    integratesWith: ['buildops', 'crowd', 'evidence'],
    modules: ['MaterialCalculator', 'LaborEstimator', 'CostEstimator', 'ToolRecommender', 'ChecklistGenerator', 'RiskDetector', 'OptionComparator'],
  },

  evidence: {
    name: 'evidence',
    displayName: 'Evidence Agent',
    role: 'Inteligencia legal/protectora — pruebas, documentos y trazabilidad',
    capabilities: [
      'Gestionar fotos (before/during/after) con GPS + timestamp',
      'Archivar documentos (contratos, facturas, recibos)',
      'Registrar cambios de alcance aprobados',
      'Bloquear milestone si la evidencia es incompleta',
      'Generar paquetes de evidencia para disputas',
      'Generar AI evidence summary',
    ],
    forbiddenActions: [
      'Liberar pagos por sí solo',
      'Organizar el proyecto',
      'Calcular costos',
    ],
    requiredInputs: ['milestoneId', 'evidenceType', 'files', 'gpsCoordinates'],
    outputs: ['evidenceChecklist', 'verificationStatus', 'disputePacket', 'evidenceSummary'],
    integratesWith: ['buildops', 'crowd', 'prometeo'],
    modules: ['EvidenceVault', 'PhotoTimeline', 'ReceiptScanner', 'ContractSnapshot', 'ChangeOrderLog', 'DisputePacketGenerator', 'ProofOfWorkChecklist'],
  },

  crowd: {
    name: 'crowd',
    displayName: 'Crowd Agent',
    role: 'Inteligencia financiera — pagos, escrow y liberación de fondos',
    capabilities: [
      'Crear estructura de escrow por proyecto',
      'Procesar pagos (Stripe Connect)',
      'Liberar fondos cuando BuildOps + Evidence aprueban milestone',
      'Gestionar retenciones y holdbacks por riesgo',
      'Generar facturas y estados de cuenta',
      'Calcular y deducir comisiones SEMSE (0.75%)',
      'Mantener ledger auditable por proyecto',
    ],
    forbiddenActions: [
      'Aprobar trabajos sin evidencia verificada',
      'Liberar fondos sin confirmación del FSM',
      'Calcular presupuestos de materiales',
    ],
    requiredInputs: ['projectId', 'quoteAmount', 'riskLevel', 'milestones', 'stripeAccountId'],
    outputs: ['escrowPlan', 'paymentSchedule', 'invoice', 'ledgerEntry', 'releaseConfirmation'],
    integratesWith: ['evidence', 'buildops', 'prometeo'],
    modules: ['EscrowEngine', 'MilestonePaymentEngine', 'InvoiceGenerator', 'RefundManager', 'CommissionCalculator', 'PayoutScheduler', 'PaymentRiskMonitor', 'FinancialLedger'],
  },

  prometeo: {
    name: 'prometeo',
    displayName: 'Prometeo Agent',
    role: 'Inteligencia explicativa y cognitiva — la voz visible del sistema',
    capabilities: [
      'Explicar estado del proyecto en lenguaje simple',
      'Interpretar riesgos y recomendar decisiones',
      'Enrutar preguntas al agente correcto',
      'Resumir proyectos para cliente y profesional',
      'Consultar RAG (documentos, specs, historial)',
      'Responder "¿por qué está bloqueado?", "¿qué falta?", "¿qué sigue?"',
    ],
    forbiddenActions: [
      'Ejecutar pagos directamente',
      'Crear ni modificar tareas',
      'Tomar decisiones — solo recomienda y explica',
    ],
    requiredInputs: ['userQuery', 'projectContext', 'agentStates'],
    outputs: ['explanation', 'recommendation', 'routedAgent', 'summary'],
    integratesWith: ['marketplace', 'buildops', 'protools', 'evidence', 'crowd'],
    modules: ['NLExplainer', 'RiskInterpreter', 'AgentRouter', 'RagAssistant', 'ProjectSummary', 'DecisionAdvisor', 'UserGuidance'],
  },
}

export function getAgent(name: SemseAgentName): SemseAgentDefinition {
  return SEMSE_AGENT_REGISTRY[name]
}

export function getAllAgents(): SemseAgentDefinition[] {
  return Object.values(SEMSE_AGENT_REGISTRY)
}

export function canAgentDo(agentName: SemseAgentName, action: string): boolean {
  const agent = SEMSE_AGENT_REGISTRY[agentName]
  return agent.capabilities.some(c => c.toLowerCase().includes(action.toLowerCase()))
    && !agent.forbiddenActions.some(f => f.toLowerCase().includes(action.toLowerCase()))
}
