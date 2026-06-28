export type AdminModuleStatus = "operational" | "attention" | "planned" | "disabled";

export type AdminModuleTone = "neutral" | "success" | "warning" | "danger";

export type AdminModuleChild = {
  id: string;
  label: string;
  href: string;
  description?: string;
  status?: AdminModuleStatus;
};

export type AdminModuleMetric = {
  label: string;
  value: string;
  tone?: AdminModuleTone;
};

export type AdminModule = {
  id: string;
  label: string;
  href: string;
  description: string;
  status: AdminModuleStatus;
  metric?: AdminModuleMetric;
  children: AdminModuleChild[];
};

export const ADMIN_MODULES: AdminModule[] = [
  {
    id: "mission-control",
    label: "Mission Control",
    href: "/admin/mission-control",
    description: "Central command for system health, alerts, business metrics, and operational routing.",
    status: "operational",
    metric: { label: "System", value: "Healthy", tone: "success" },
    children: [
      { id: "dashboard", label: "Dashboard", href: "/admin/dashboard" },
      { id: "ecosystem", label: "Ecosystem", href: "/admin/ecosystem" },
      { id: "consciousness", label: "Consciousness", href: "/admin/consciousness" },
      { id: "ops", label: "Ops", href: "/admin/ops" },
      { id: "domain-events", label: "Domain Events", href: "/admin/domain-events" },
      { id: "reports", label: "Reports", href: "/admin/reports" },
    ],
  },
  {
    id: "workops",
    label: "WorkOps",
    href: "/admin/workops",
    description: "Jobs, crews, field execution, milestones, evidence, change orders, and QA.",
    status: "operational",
    metric: { label: "Execution", value: "Live", tone: "success" },
    children: [
      { id: "field-ops", label: "Field Ops", href: "/admin/field-ops" },
      { id: "worker", label: "Workers", href: "/admin/worker" },
      { id: "contractors", label: "Contractors", href: "/admin/contractors" },
      { id: "change-orders", label: "Change Orders", href: "/admin/change-orders" },
      { id: "pmo", label: "PMO", href: "/admin/pmo" },
      { id: "qa", label: "QA", href: "/admin/qa" },
    ],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    href: "/admin/marketplace",
    description: "Leads, opportunities, contractors, proposals, matching, and reputation loops.",
    status: "operational",
    metric: { label: "Pipeline", value: "Active", tone: "success" },
    children: [
      { id: "marketplace", label: "Marketplace", href: "/admin/marketplace" },
      { id: "reputation", label: "Reputation", href: "/admin/reputation" },
      { id: "contractors", label: "Contractors", href: "/admin/contractors" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    href: "/admin/finance",
    description: "Estimates, escrow, payments, payouts, disputes, and governance checkpoints.",
    status: "attention",
    metric: { label: "Escrow", value: "Watch", tone: "warning" },
    children: [
      { id: "finance", label: "Finance", href: "/admin/finance" },
      { id: "disputes", label: "Disputes", href: "/admin/disputes" },
      { id: "change-orders", label: "Change Orders", href: "/admin/change-orders" },
      { id: "governance", label: "Governance", href: "/admin/governance" },
    ],
  },
  {
    id: "trust",
    label: "Trust",
    href: "/admin/trust",
    description: "Identity, compliance, credentials, reviews, reputation, and risk signals.",
    status: "operational",
    metric: { label: "Trust", value: "Verified", tone: "success" },
    children: [
      { id: "trust", label: "Trust", href: "/admin/trust" },
      { id: "compliance", label: "Compliance", href: "/admin/compliance" },
      { id: "reputation", label: "Reputation", href: "/admin/reputation" },
      { id: "users", label: "Users", href: "/admin/users" },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    href: "/admin/intelligence",
    description: "Prometeo, agents, RAG, model metrics, memory, simulations, and autonomy.",
    status: "operational",
    metric: { label: "Agents", value: "Online", tone: "success" },
    children: [
      { id: "ai-mission-control", label: "AI Mission Control", href: "/admin/ai-mission-control" },
      { id: "agents", label: "Agents", href: "/admin/agents" },
      { id: "algorithm-engine", label: "Algorithm Engine", href: "/admin/algorithm-engine" },
      { id: "autonomy", label: "Autonomy", href: "/admin/autonomy" },
      { id: "prometeo", label: "Prometeo", href: "/admin/prometeo" },
      { id: "llm-metrics", label: "LLM Metrics", href: "/admin/llm-metrics" },
      { id: "memory", label: "Memory", href: "/admin/memory" },
      { id: "intelligence-rooms", label: "Intelligence Rooms", href: "/admin/intelligence-rooms" },
      { id: "browser-agent", label: "Browser Agent", href: "/admin/browser-agent" },
    ],
  },
  {
    id: "tool-hub",
    label: "Tool Hub",
    href: "/admin/tool-hub",
    description: "External AI tools, developer runtime, context bridge, and operator handoff.",
    status: "operational",
    metric: { label: "Tools", value: "9", tone: "success" },
    children: [
      { id: "tools", label: "Pro Tools Catalog", href: "/admin/tools", description: "27 trade tools with specs, estimators, and research endpoints." },
      { id: "developer-runtime", label: "Developer Runtime", href: "/admin/developer-runtime", description: "Live execution environment for custom operators." },
      { id: "coordinator", label: "Coordinator", href: "/admin/coordinator", description: "Multi-agent task coordination and scheduling." },
      { id: "semse-x", label: "SEMSE X", href: "/admin/semse-x", description: "Experimental and next-gen features sandbox." },
      { id: "html-in-canvas", label: "HTML Canvas", href: "/admin/html-in-canvas", description: "Render and test custom HTML in isolated canvas." },
    ],
  },
  {
    id: "verticals",
    label: "Verticals",
    href: "/admin/verticals",
    description: "Construction, property turnovers, cleaning, agro, maintenance, and future verticals.",
    status: "operational",
    metric: { label: "Active", value: "3", tone: "success" },
    children: [
      { id: "agro", label: "Agro / FarmOps", href: "/admin/verticals/agro", description: "Full farm management: animals, groups, tasks, inventory, health, feeding, costs, analytics, and reproduction.", status: "operational" },
      { id: "construction", label: "Construction", href: "/admin/verticals/construction", description: "Field operations, crews, evidence, milestones, and change orders.", status: "operational" },
      { id: "vision-ai", label: "Vision AI", href: "/admin/verticals/vision", description: "Material and safety analysis powered by OpenCV and Ollama — 6 analyzers.", status: "operational" },
      { id: "travel", label: "Travel Ops", href: "/admin/travel", description: "Travel management and logistics for field crews.", status: "planned" },
      { id: "cleaning", label: "Cleaning", href: "/admin/verticals", description: "Property turnover and cleaning vertical — coming soon.", status: "planned" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    href: "/admin/settings",
    description: "System configuration, users, roles, integrations, notifications, and security.",
    status: "operational",
    metric: { label: "Config", value: "Ready", tone: "success" },
    children: [{ id: "settings", label: "Settings", href: "/admin/settings" }],
  },
];

export const ADMIN_PRIMARY_NAV = ADMIN_MODULES.map(({ id, label, href, status }) => ({
  id,
  label,
  href,
  status,
}));

export function getAdminModuleById(id: string): AdminModule | undefined {
  return ADMIN_MODULES.find((module) => module.id === id);
}

export function getAdminModuleForPath(pathname: string): AdminModule | undefined {
  return ADMIN_MODULES.find((module) => {
    if (pathname === module.href || pathname.startsWith(`${module.href}/`)) return true;
    return module.children.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`));
  });
}
