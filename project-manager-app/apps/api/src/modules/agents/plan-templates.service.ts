import { Injectable } from "@nestjs/common";

export type PlanTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  goal: string;
  rationale: string;
  steps: Array<{
    id: string;
    title: string;
    capability: string;
    toolsAllowed: string[];
    expectedOutcome: string;
    requiresApprovedPlan?: boolean;
  }>;
  risks: string[];
  requiredEvidence: string[];
  successCriteria: string[];
};

const TEMPLATES: PlanTemplate[] = [
  {
    id: "tpl_milestone_review",
    name: "Revisión de hito y liberación de pago",
    description: "Revisar evidencia de un hito enviado, validar documentación y proponer aprobación o disputa.",
    category: "pagos",
    goal: "Revisar documentación del hito y tomar acción sobre el pago",
    rationale: "El profesional ha enviado un hito. Se necesita verificar evidencia antes de liberar el escrow.",
    steps: [
      {
        id: "step_1",
        title: "Revisar evidencia del hito",
        capability: "searching",
        toolsAllowed: ["READ_FILE", "SEARCH_PATTERNS", "LIST_DIRECTORY"],
        expectedOutcome: "Lista de evidencias disponibles y evaluación de su calidad",
      },
      {
        id: "step_2",
        title: "Evaluar suficiencia de documentación",
        capability: "searching",
        toolsAllowed: ["SEARCH_PATTERNS", "READ_FILE"],
        expectedOutcome: "Dictamen: documentación suficiente o insuficiente",
      },
      {
        id: "step_3",
        title: "Proponer aprobación o apertura de disputa",
        capability: "worker",
        toolsAllowed: ["PROPOSE_MILESTONE_APPROVAL", "PROPOSE_DISPUTE_OPEN"],
        expectedOutcome: "Milestone aprobado y pago liberado, o disputa abierta con evidencia",
        requiresApprovedPlan: true,
      },
    ],
    risks: [
      "Evidencia insuficiente puede bloquear el pago",
      "Disputa puede alargar el ciclo de pago",
    ],
    requiredEvidence: [
      "Fotos o video del trabajo terminado",
      "Documento de verificación si aplica",
    ],
    successCriteria: [
      "Hito aprobado o disputa abierta con justificación",
      "Cliente notificado de la decisión",
    ],
  },
  {
    id: "tpl_dispute_resolution",
    name: "Resolución de disputa",
    description: "Recopilar evidencia de ambas partes, analizar la situación y proponer resolución.",
    category: "disputas",
    goal: "Resolver la disputa con base en evidencia objetiva",
    rationale: "Hay una disputa activa que requiere análisis imparcial y propuesta de resolución.",
    steps: [
      {
        id: "step_1",
        title: "Recopilar contexto de la disputa",
        capability: "searching",
        toolsAllowed: ["READ_FILE", "SEARCH_PATTERNS"],
        expectedOutcome: "Resumen de argumentos de ambas partes y evidencia disponible",
      },
      {
        id: "step_2",
        title: "Solicitar evidencia faltante",
        capability: "composing",
        toolsAllowed: ["REQUEST_MISSING_EVIDENCE", "DRAFT_MESSAGE"],
        expectedOutcome: "Solicitud enviada a las partes correspondientes",
      },
      {
        id: "step_3",
        title: "Proponer resolución",
        capability: "dispute",
        toolsAllowed: ["PROPOSE_DISPUTE_RESOLVE"],
        expectedOutcome: "Propuesta de resolución con justificación documentada",
        requiresApprovedPlan: true,
      },
    ],
    risks: [
      "Las partes pueden no estar de acuerdo con la resolución propuesta",
      "Evidencia incompleta puede llevar a escalación",
    ],
    requiredEvidence: [
      "Contrato original o alcance acordado",
      "Evidencias del trabajo realizado",
      "Comunicaciones previas relevantes",
    ],
    successCriteria: [
      "Disputa resuelta con acuerdo documentado",
      "Pago liberado o reembolsado según corresponda",
    ],
  },
  {
    id: "tpl_escrow_release",
    name: "Liberación de escrow al completar el proyecto",
    description: "Verificar que todos los hitos están aprobados y liberar el escrow final.",
    category: "pagos",
    goal: "Liberar el saldo del escrow al completar todos los hitos",
    rationale: "El proyecto está cerca de cerrarse. Se verifica que no hay deudas pendientes antes de liberar el escrow.",
    steps: [
      {
        id: "step_1",
        title: "Verificar estado de todos los hitos",
        capability: "searching",
        toolsAllowed: ["READ_FILE", "SEARCH_PATTERNS"],
        expectedOutcome: "Todos los hitos en estado APPROVED o PAID",
      },
      {
        id: "step_2",
        title: "Verificar ausencia de disputas abiertas",
        capability: "searching",
        toolsAllowed: ["SEARCH_PATTERNS"],
        expectedOutcome: "Sin disputas activas en el proyecto",
      },
      {
        id: "step_3",
        title: "Proponer liberación de escrow",
        capability: "worker",
        toolsAllowed: ["PROPOSE_ESCROW_RELEASE"],
        expectedOutcome: "Escrow liberado al profesional",
        requiresApprovedPlan: true,
      },
    ],
    risks: [
      "Disputas ocultas que no se detectaron",
      "Hitos pendientes de revisión",
    ],
    requiredEvidence: [
      "Todos los hitos marcados como APPROVED",
      "Sin disputas en estado OPEN o UNDER_REVIEW",
    ],
    successCriteria: [
      "Escrow liberado completamente",
      "Proyecto marcado como CLOSED",
    ],
  },
  {
    id: "tpl_scope_change",
    name: "Gestión de cambio de alcance",
    description: "Documentar un cambio de alcance solicitado, evaluar impacto y proponer ajuste.",
    category: "operaciones",
    goal: "Gestionar formalmente un cambio de alcance con evaluación de impacto",
    rationale: "El cliente o profesional solicitan cambios al trabajo original. Se requiere evaluación formal.",
    steps: [
      {
        id: "step_1",
        title: "Documentar el cambio solicitado",
        capability: "composing",
        toolsAllowed: ["DRAFT_MESSAGE"],
        expectedOutcome: "Resumen formal del cambio solicitado con comparación vs. alcance original",
      },
      {
        id: "step_2",
        title: "Evaluar impacto en precio y tiempo",
        capability: "searching",
        toolsAllowed: ["SEARCH_PATTERNS", "READ_FILE"],
        expectedOutcome: "Estimación de impacto en presupuesto y cronograma",
      },
      {
        id: "step_3",
        title: "Proponer aprobación del cambio",
        capability: "worker",
        toolsAllowed: ["PROPOSE_MILESTONE_APPROVAL"],
        expectedOutcome: "Cambio aprobado con nuevo hito o ajuste de alcance documentado",
        requiresApprovedPlan: true,
      },
    ],
    risks: [
      "Desacuerdo en el precio del cambio",
      "Retrasos por trabajo adicional no presupuestado",
    ],
    requiredEvidence: [
      "Descripción detallada del cambio",
      "Aceptación escrita de ambas partes",
    ],
    successCriteria: [
      "Cambio documentado y aprobado",
      "Nuevo hito o ajuste reflejado en el proyecto",
    ],
  },
  {
    id: "tpl_quality_inspection",
    name: "Inspección de calidad final",
    description: "Revisar el trabajo terminado contra los criterios de calidad y evidencia requerida.",
    category: "field-ops",
    goal: "Verificar que el trabajo terminado cumple los estándares acordados",
    rationale: "El proyecto está en revisión final. Se necesita inspección de calidad antes del cierre.",
    steps: [
      {
        id: "step_1",
        title: "Revisar toda la evidencia del proyecto",
        capability: "searching",
        toolsAllowed: ["READ_FILE", "LIST_DIRECTORY", "SEARCH_PATTERNS"],
        expectedOutcome: "Inventario completo de evidencias y evaluación de calidad",
      },
      {
        id: "step_2",
        title: "Comparar contra criterios del contrato",
        capability: "searching",
        toolsAllowed: ["SEARCH_PATTERNS", "READ_FILE"],
        expectedOutcome: "Checklist de cumplimiento vs. alcance original",
      },
      {
        id: "step_3",
        title: "Emitir dictamen de calidad",
        capability: "composing",
        toolsAllowed: ["DRAFT_MESSAGE", "PROPOSE_MILESTONE_APPROVAL"],
        expectedOutcome: "Informe de calidad final con recomendación",
        requiresApprovedPlan: true,
      },
    ],
    risks: [
      "Trabajo incompleto detectado en inspección final",
      "Discrepancias entre evidencia y trabajo real",
    ],
    requiredEvidence: [
      "Fotos del trabajo terminado desde múltiples ángulos",
      "Video de prueba de funcionamiento",
      "Checklist de inspección firmado",
    ],
    successCriteria: [
      "Trabajo aprobado con evidencia completa",
      "Dictamen de calidad emitido y documentado",
    ],
  },
];

@Injectable()
export class PlanTemplatesService {
  listTemplates(category?: string): PlanTemplate[] {
    if (!category) return TEMPLATES;
    return TEMPLATES.filter((t) => t.category === category);
  }

  getTemplate(id: string): PlanTemplate | null {
    return TEMPLATES.find((t) => t.id === id) ?? null;
  }

  getCategories(): string[] {
    return [...new Set(TEMPLATES.map((t) => t.category))];
  }

  buildPlanDraftFromTemplate(
    templateId: string,
    overrides?: { title?: string; goal?: string },
  ): Omit<PlanTemplate, "id" | "name" | "description" | "category"> & { title: string } | null {
    const tpl = this.getTemplate(templateId);
    if (!tpl) return null;

    return {
      title: overrides?.title ?? tpl.name,
      goal: overrides?.goal ?? tpl.goal,
      rationale: tpl.rationale,
      steps: tpl.steps,
      risks: tpl.risks,
      requiredEvidence: tpl.requiredEvidence,
      successCriteria: tpl.successCriteria,
    };
  }
}
