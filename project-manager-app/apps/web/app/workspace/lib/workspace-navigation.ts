import { navigationRegistry, type NavigationNode } from "../../../lib/navigation-registry";
import type { WorkspaceRole } from "./workspace-model";

export type WorkspaceDestination = { id: string; label: string; href: string };

/**
 * Proyección de las claves activas del catálogo ES de lib/language-context.tsx.
 * El catálogo vive en un contexto React privado: no se importa ni se cambia el
 * idioma para mantener este helper puro. workspace-navigation-search.test.ts
 * verifica la paridad con la fuente existente, incluidos nombres de producto.
 */
const SPANISH_NAVIGATION_LABELS: Readonly<Record<string, string>> = {
  "nav.missionControl": "Mission Control",
  "nav.aiMissionControl": "IA Mission Control",
  "nav.workerDashboard": "Dashboard",
  "nav.agenda": "Agenda",
  "nav.myJobs": "Mis trabajos",
  "nav.myBids": "Mis propuestas",
  "nav.tasks": "Tareas",
  "nav.timeTracker": "Time Tracker",
  "nav.evidence": "Evidencia",
  "nav.materials": "Materiales",
  "nav.senseVision": "Sense Vision",
  "nav.myDictionary": "Mi Diccionario",
  "nav.incidents": "Incidencias",
  "nav.payments": "Pagos",
  "nav.travel": "Movilidad",
  "nav.fieldOps": "Ops. de campo",
  "nav.myProfile": "Mi perfil",
  "nav.aiSettings": "Configuración del asistente",
  "nav.agents": "Agentes",
  "nav.dashboard": "Dashboard",
  "nav.leads": "Leads & Clientes",
  "nav.postJob": "Publicar trabajo",
  "nav.myProjects": "Mis proyectos",
  "nav.aiCopilot": "Copiloto IA",
  "nav.milestones": "Hitos",
  "nav.professionals": "Profesionales",
  "nav.clientMarketplace": "Buscar trabajo",
  "nav.protools": "Estimador de obra",
  "nav.documents": "Documentos",
  "nav.reviews": "Reseñas",
  "nav.financeHub": "Hub Financiero",
  "nav.operations": "Operaciones",
  "nav.buildOps": "BuildOps",
  "nav.contractors": "Contractors / CRM",
  "nav.marketplace": "Marketplace",
  "nav.trust": "Trust Scores",
  "nav.reputation": "Reputación",
  "nav.worker": "Worker / Jobs",
  "nav.autonomy": "Autonomía",
  "nav.developerRuntime": "Entorno Dev",
  "nav.disputes": "Disputas",
  "nav.changeOrders": "Change Orders",
  "nav.visionAI": "Vision AI",
  "nav.qaCenter": "Centro QA",
  "nav.compliance": "Cumplimiento",
  "nav.finance": "Finanzas",
  "nav.travelOps": "Viajes",
  "nav.reports": "Reportes",
  "nav.coordinator": "Coordinador",
  "nav.consciousness": "Consciousness",
  "nav.pmo": "PMO Automatizado",
  "nav.governance": "Gobernanza DAO",
  "nav.llmMetrics": "Métricas LLM",
  "nav.agentMemory": "Memoria Agente",
  "nav.prometeo": "Prometeo RAG",
  "nav.communications": "Comunicaciones",
  "nav.domainEvents": "Eventos de dominio",
  "nav.users": "Usuarios",
  "nav.settings": "Configuración",
  "nav.htmlCanvas": "HTML Canvas",
  "nav.agro": "Agro",
  "nav.semseTools": "SEMSE Tools",
  "nav.algorithmEngine": "Algorithm Engine",
  "nav.toolsCatalog": "Catálogo ProTools",
  "nav.ecosystem": "Ecosystem",
  "nav.semseX": "SEMSE_X",
};

/** Normaliza texto local para buscar etiquetas ES, sin alterar su presentación. */
export function normalizeWorkspaceNavigationQuery(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es").trim();
}

/**
 * Selección pura sobre nodos registrados; permite probar estados y duplicados
 * con fixtures sin mutar navigationRegistry. Conserva orden y el primer href
 * activo autorizado. Los consumidores del shell usan getWorkspaceDestinations.
 * Este filtro es de presentación; no sustituye RBAC/tenant/org de la API.
 */
export function filterWorkspaceDestinations(
  nodes: readonly NavigationNode[],
  role: WorkspaceRole | null,
  query = "",
): WorkspaceDestination[] {
  if (role !== "worker" && role !== "client" && role !== "admin") return [];

  const normalizedQuery = normalizeWorkspaceNavigationQuery(query);
  const seen = new Set<string>();
  const destinations: WorkspaceDestination[] = [];

  for (const node of nodes) {
    if (node.status !== "active" || !node.roles.includes(role)) continue;

    const href = node.canonicalHref;
    if (!href.startsWith("/") || href.startsWith("//") || /^\/api(?:[/?#]|$)/i.test(href)) continue;
    if (seen.has(href)) continue;

    const label = Object.hasOwn(SPANISH_NAVIGATION_LABELS, node.labelKey)
      ? SPANISH_NAVIGATION_LABELS[node.labelKey]
      : undefined;
    if (!label) continue;

    seen.add(href);
    if (normalizedQuery && !normalizeWorkspaceNavigationQuery(label).includes(normalizedQuery)) continue;
    destinations.push({ id: node.id, label, href });
  }

  return destinations;
}

/**
 * Destinos canónicos activos del rol resuelto, buscados únicamente por etiqueta
 * española. Rol nulo/desconocido devuelve []; admin no hereda otros roles.
 * No realiza consultas ni agrega rutas, aliases o destinos planned/deprecated.
 */
export function getWorkspaceDestinations(
  role: WorkspaceRole | null,
  query?: string,
): WorkspaceDestination[] {
  return filterWorkspaceDestinations(navigationRegistry, role, query);
}
