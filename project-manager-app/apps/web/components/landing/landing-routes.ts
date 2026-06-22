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
