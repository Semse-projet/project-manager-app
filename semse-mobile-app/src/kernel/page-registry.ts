export type MobileSurfaceTier = "worker" | "client" | "dev";
export type MobileSurfaceStatus = "mock_only" | "adapt" | "backend_ready";

export type MobilePageDescriptor = {
  path: string;
  tier: MobileSurfaceTier;
  domain: string;
  status: MobileSurfaceStatus;
  notes: string;
};

export const MOBILE_PAGE_REGISTRY: readonly MobilePageDescriptor[] = [
  { path: "/", tier: "worker", domain: "jobs", status: "adapt", notes: "dashboard worker con hook de jobs" },
  { path: "/trabajos", tier: "worker", domain: "jobs", status: "adapt", notes: "listado worker con repository" },
  { path: "/trabajo/:id", tier: "worker", domain: "jobs", status: "adapt", notes: "detalle worker con job detail hook" },
  { path: "/evidencias", tier: "worker", domain: "evidence", status: "adapt", notes: "captura y listado con repository" },
  { path: "/nueva-evidencia", tier: "worker", domain: "evidence", status: "adapt", notes: "alta de evidencia" },
  { path: "/tareas", tier: "worker", domain: "tasks", status: "adapt", notes: "tareas operativas con task hook" },
  { path: "/materiales", tier: "worker", domain: "materials", status: "adapt", notes: "materiales derivados desde jobs canonizados" },
  { path: "/incidentes", tier: "worker", domain: "incidents", status: "adapt", notes: "incidentes con repository" },
  { path: "/field-ops", tier: "worker", domain: "field_ops", status: "adapt", notes: "resumen field ops con snapshot hook" },
  { path: "/tracker", tier: "worker", domain: "tracker", status: "backend_ready", notes: "tracker ya existe en core" },
  { path: "/viajes", tier: "worker", domain: "travel", status: "adapt", notes: "travel con snapshot de dominio y backend core disponible" },
  { path: "/hospedaje", tier: "worker", domain: "travel", status: "adapt", notes: "travel lodging con snapshot de reservas" },
  { path: "/gastos", tier: "worker", domain: "travel", status: "adapt", notes: "travel expenses con snapshot de gastos" },
  { path: "/anticipos", tier: "worker", domain: "travel", status: "adapt", notes: "travel advances con repository" },
  { path: "/liquidacion", tier: "worker", domain: "travel", status: "backend_ready", notes: "travel settlement" },
  { path: "/pagos", tier: "worker", domain: "payments", status: "adapt", notes: "pagos worker con payments hook" },
  { path: "/disputas", tier: "worker", domain: "disputes", status: "adapt", notes: "disputas worker con repository" },
  { path: "/perfil", tier: "worker", domain: "auth", status: "adapt", notes: "perfil worker con profile snapshot" },
  { path: "/mensajes", tier: "worker", domain: "messages", status: "mock_only", notes: "sin backend canonicamente fuerte" },
  { path: "/cliente", tier: "client", domain: "jobs", status: "adapt", notes: "dashboard client con snapshot de jobs y proyecto" },
  { path: "/cliente/publicar", tier: "client", domain: "jobs", status: "adapt", notes: "publicacion" },
  { path: "/cliente/publicar-detalle", tier: "client", domain: "jobs", status: "adapt", notes: "detalle publicacion" },
  { path: "/cliente/trabajos", tier: "client", domain: "jobs", status: "adapt", notes: "mis trabajos con repository" },
  { path: "/cliente/detalle-job", tier: "client", domain: "projects", status: "adapt", notes: "detalle client con propuestas canonizadas" },
  { path: "/cliente/comparar", tier: "client", domain: "matching", status: "adapt", notes: "comparar propuestas con repository" },
  { path: "/cliente/match", tier: "client", domain: "matching", status: "mock_only", notes: "matching real pendiente" },
  { path: "/cliente/proyecto-activo", tier: "client", domain: "projects", status: "adapt", notes: "proyecto activo con payments" },
  { path: "/cliente/aprobar", tier: "client", domain: "milestones", status: "adapt", notes: "approve milestone" },
  { path: "/cliente/pagos", tier: "client", domain: "payments", status: "adapt", notes: "pagos client con escrow repository" },
  { path: "/cliente/documentos", tier: "client", domain: "evidence", status: "adapt", notes: "documentos con repository" },
  { path: "/cliente/disputas", tier: "client", domain: "disputes", status: "adapt", notes: "disputas client" },
  { path: "/cliente/reviews", tier: "client", domain: "reviews", status: "adapt", notes: "ratings" },
  { path: "/cliente/perfil", tier: "client", domain: "auth", status: "adapt", notes: "perfil client con snapshot propio" },
  { path: "/cliente/ajustes", tier: "client", domain: "auth", status: "adapt", notes: "ajustes client" },
  { path: "/dev", tier: "dev", domain: "ops", status: "adapt", notes: "dashboard dev" },
] as const;
