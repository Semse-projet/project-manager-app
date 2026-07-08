export interface TrustBarItem {
  icon: string;
  label: string;
}

export interface OperationalRoute {
  title: string;
  description: string;
  href: string;
}

export interface RoleCard {
  id: string;
  title: string;
  description: string;
  href: string;
}

export interface EcosystemModule {
  id: string;
  title: string;
  description: string;
  href: string;
}

export type HubModuleStatus = "live" | "demo-soon";

export interface HubModule {
  id: string;
  title: string;
  tagline: string;
  capabilities: string[];
  status: HubModuleStatus;
  href: string;
}

export const trustBarItems: TrustBarItem[] = [
  { icon: "⚡", label: "IA Conectada" },
  { icon: "🛡️", label: "Pagos por Hitos" },
  { icon: "📸", label: "Evidencia Verificable" },
  { icon: "🎖️", label: "Profesionales por Reputación" },
  { icon: "⚖️", label: "Soporte en Disputas" },
];

export const operationalRoutes: OperationalRoute[] = [
  {
    title: "Publicar un trabajo",
    description: "Para clientes que necesitan resolver un proyecto.",
    href: "/client/jobs/new",
  },
  {
    title: "Calcular un estimado",
    description: "Para conocer materiales, tiempo y costo aproximado.",
    href: "/tools",
  },
  {
    title: "Buscar trabajos",
    description: "Para profesionales que quieren nuevas oportunidades.",
    href: "/login?from=/worker/dashboard",
  },
  {
    title: "Administrar un proyecto",
    description: "Para contratistas que manejan equipos, hitos y evidencia.",
    href: "/login?from=/worker/dashboard", // Using worker path or fallback dashboard
  },
  {
    title: "Subir evidencia",
    description: "Para documentar avances y desbloquear aprobaciones.",
    href: "/login?from=/worker/evidence",
  },
  {
    title: "Revisar pagos",
    description: "Para controlar hitos, escrow y liberaciones.",
    href: "/login?from=/client/dashboard",
  },
  {
    title: "Preguntar a Prometeo",
    description: "Para recibir ayuda inteligente sobre estimados, riesgos y próximos pasos.",
    href: "/login?from=/admin/dashboard",
  },
];

export const roleCards: RoleCard[] = [
  {
    id: "client",
    title: "Soy Cliente",
    description: "Publico trabajos, comparo propuestas y apruebo avances.",
    href: "/client/jobs/new",
  },
  {
    id: "worker",
    title: "Soy Profesional",
    description: "Recibo trabajos, registro evidencia y construyo reputación.",
    href: "/login?from=/worker/dashboard",
  },
  {
    id: "admin",
    title: "Soy Contratista / Operador",
    description: "Administro crews, hitos, pagos, riesgos y documentación.",
    href: "/login?from=/worker/dashboard",
  },
];

export const ecosystemModules: EcosystemModule[] = [
  {
    id: "protools",
    title: "ProTools",
    description: "Calculadoras y estimadores inteligentes por oficio.",
    href: "/modules/protools",
  },
  {
    id: "buildops",
    title: "BuildOps",
    description: "Milestones, tareas, checklists y operación diaria.",
    href: "/modules/buildops",
  },
  {
    id: "evidence",
    title: "Evidence Vault",
    description: "Fotos de antes/después y registro documental con metadatos.",
    href: "/modules/evidence",
  },
  {
    id: "escrow",
    title: "Escrow & Payments",
    description: "Pagos protegidos por hitos. Dinero liberado contra evidencia aprobada.",
    href: "/modules/escrow",
  },
  {
    id: "marketplace",
    title: "Marketplace",
    description: "Conexión directa entre clientes, contratistas y técnicos verificados.",
    href: "/modules/marketplace",
  },
  {
    id: "prometeo",
    title: "Prometeo IA",
    description: "Auditorías visuales automáticas, análisis RAG y sugerencias de hitos.",
    href: "/modules/prometeo",
  },
  {
    id: "trust",
    title: "Trust & Governance",
    description: "Trust Score reputacional, KYC avanzado y resolución de disputas.",
    href: "/modules/trust",
  },
];

// Catálogo único de los 9 módulos del ecosistema.
// Fuente de verdad: docs/SEMSE_CONNECT_TAXONOMY.md — capacidades LIVE, no aspiracionales.
export const hubModules: HubModule[] = [
  {
    id: "core",
    title: "SEMSE Core",
    tagline: "Identidad, organizaciones y permisos de todo el ecosistema.",
    capabilities: [
      "Cuentas de clientes, profesionales y operadores",
      "Roles y permisos con denegación por defecto",
      "Organizaciones y equipos de trabajo",
      "Verificación de identidad de trabajadores",
    ],
    status: "live",
    href: "/modules/core",
  },
  {
    id: "connect",
    title: "SEMSE Connect",
    tagline: "La red que conecta clientes, profesionales, empresas y agentes.",
    capabilities: [
      "Publicación de trabajos y propuestas comparativas",
      "Matching explicable por especialidad y reputación",
      "Agenda y tracker de trabajo en campo",
      "Mensajería centralizada + WhatsApp",
      "Evidencias verificables por trabajo",
    ],
    status: "live",
    href: "/modules/connect",
  },
  {
    id: "payments",
    title: "SEMSE Payments",
    tagline: "Dinero protegido hasta que el trabajo cumpla lo acordado.",
    capabilities: [
      "Escrow por hitos con Stripe",
      "Liberaciones parciales y reembolsos",
      "Panel financiero para admin y cliente",
      "Conciliación transparente de transacciones",
    ],
    status: "live",
    href: "/modules/payments",
  },
  {
    id: "trust",
    title: "SEMSE Trust",
    tagline: "Reputación, verificaciones y gobernanza del ecosistema.",
    capabilities: [
      "Trust Score dinámico por desempeño real",
      "Calificaciones bidireccionales cliente↔profesional",
      "Gobernanza con voto cuadrático",
      "Resolución de disputas con evidencia",
    ],
    status: "live",
    href: "/modules/trust",
  },
  {
    id: "ai",
    title: "SEMSE AI",
    tagline: "Prometeo y los agentes que supervisan la operación.",
    capabilities: [
      "Prometeo: orquestador conversacional",
      "Auditoría visual automática de evidencias",
      "RAG con citas de manuales de oficio",
      "Agentes autónomos con interruptor de seguridad",
    ],
    status: "live",
    href: "/modules/ai",
  },
  {
    id: "agro",
    title: "SEMSE Agro",
    tagline: "Operación agrícola y ganadera de punta a punta.",
    capabilities: [
      "Registro de animales con acciones y trazabilidad",
      "Inventario con stock y movimientos",
      "Tareas de campo con ciclo de vida formal",
      "Control de costos por operación",
    ],
    status: "demo-soon",
    href: "/modules/agro",
  },
  {
    id: "buildops",
    title: "SEMSE BuildOps",
    tagline: "Gestión de obra: hitos, checklists y herramientas por oficio.",
    capabilities: [
      "Milestones con aprobación del cliente",
      "Checklists e incidencias de obra",
      "ProTools: 27 calculadoras por oficio",
      "Planes de trabajo aprobables",
    ],
    status: "live",
    href: "/modules/buildops",
  },
  {
    id: "knowledge",
    title: "SEMSE Knowledge",
    tagline: "El conocimiento del oficio, consultable con citas reales.",
    capabilities: [
      "Biblioteca técnica por oficio (manuales ES/EN)",
      "Búsqueda híbrida con citas verificables",
      "Mejora continua con feedback humano",
      "Mapa de conocimiento del propio sistema",
    ],
    status: "live",
    href: "/modules/knowledge",
  },
  {
    id: "integrations",
    title: "SEMSE Integrations",
    tagline: "Un solo hub para todos los servicios externos.",
    capabilities: [
      "Stripe para pagos y escrow",
      "WhatsApp Business (Meta) para comunicación",
      "Ollama / OpenAI / Anthropic para IA",
      "Satélites: Alexa, análisis de repositorios",
    ],
    status: "live",
    href: "/modules/integrations",
  },
];

export const operatingFlowSteps: string[] = [
  "Publicar",
  "IA analiza",
  "Propuestas",
  "Elegir",
  "Hitos",
  "Escrow",
  "Evidencia",
  "Cierre",
];
