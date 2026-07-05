// SEMSEproject Admin Navigation Contract
// Suggested location: apps/web/lib/admin/admin-navigation.ts

export type AdminModuleStatus = 'operational' | 'attention' | 'planned' | 'disabled';

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
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
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
    id: 'mission-control',
    label: 'Mission Control',
    href: '/admin/mission-control',
    description: 'Plan, coordinate, and execute operations in real time.',
    status: 'operational',
    metric: { label: 'System', value: 'Healthy', tone: 'success' },
    children: [
      { id: 'dashboard', label: 'Dashboard', href: '/admin/dashboard' },
      { id: 'ecosystem', label: 'Ecosystem', href: '/admin/ecosystem' },
      { id: 'consciousness', label: 'Consciousness', href: '/admin/consciousness' },
      { id: 'ops', label: 'Ops', href: '/admin/ops' },
      { id: 'domain-events', label: 'Domain Events', href: '/admin/domain-events' },
      { id: 'reports', label: 'Reports', href: '/admin/reports' },
    ],
  },
  {
    id: 'workops',
    label: 'WorkOps',
    href: '/admin/workops',
    description: 'Manage jobs, crews, milestones, evidence, and field execution.',
    status: 'operational',
    metric: { label: 'Active Jobs', value: '128', tone: 'success' },
    children: [
      { id: 'field-ops', label: 'Field Ops', href: '/admin/field-ops' },
      { id: 'worker', label: 'Workers', href: '/admin/worker' },
      { id: 'contractors', label: 'Contractors', href: '/admin/contractors' },
      { id: 'change-orders', label: 'Change Orders', href: '/admin/change-orders' },
      { id: 'pmo', label: 'PMO', href: '/admin/pmo' },
      { id: 'qa', label: 'QA', href: '/admin/qa' },
    ],
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    href: '/admin/marketplace',
    description: 'Discover, match, contract, and manage service opportunities.',
    status: 'operational',
    metric: { label: 'Opportunities', value: '89', tone: 'success' },
    children: [
      { id: 'marketplace', label: 'Marketplace', href: '/admin/marketplace' },
      { id: 'reputation', label: 'Reputation', href: '/admin/reputation' },
      { id: 'contractors', label: 'Contractors', href: '/admin/contractors' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    href: '/admin/finance',
    description: 'Escrow, invoices, payments, payouts, and disputes.',
    status: 'attention',
    metric: { label: 'Escrow', value: '$250,430', tone: 'warning' },
    children: [
      { id: 'finance', label: 'Finance', href: '/admin/finance' },
      { id: 'disputes', label: 'Disputes', href: '/admin/disputes' },
      { id: 'change-orders', label: 'Change Orders', href: '/admin/change-orders' },
      { id: 'governance', label: 'Governance', href: '/admin/governance' },
    ],
  },
  {
    id: 'trust',
    label: 'Trust',
    href: '/admin/trust',
    description: 'Identity, compliance, credentials, reviews, and risk.',
    status: 'operational',
    metric: { label: 'Verified', value: '256', tone: 'success' },
    children: [
      { id: 'trust', label: 'Trust', href: '/admin/trust' },
      { id: 'compliance', label: 'Compliance', href: '/admin/compliance' },
      { id: 'reputation', label: 'Reputation', href: '/admin/reputation' },
      { id: 'users', label: 'Users', href: '/admin/users' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    href: '/admin/intelligence',
    description: 'Prometeo, agents, RAG, model metrics, memory, and autonomy.',
    status: 'operational',
    metric: { label: 'Agents', value: '23', tone: 'success' },
    children: [
      { id: 'ai-mission-control', label: 'AI Mission Control', href: '/admin/ai-mission-control' },
      { id: 'agents', label: 'Agents', href: '/admin/agents' },
      { id: 'algorithm-engine', label: 'Algorithm Engine', href: '/admin/algorithm-engine' },
      { id: 'autonomy', label: 'Autonomy', href: '/admin/autonomy' },
      { id: 'prometeo', label: 'Prometeo', href: '/admin/prometeo' },
      { id: 'llm-metrics', label: 'LLM Metrics', href: '/admin/llm-metrics' },
      { id: 'memory', label: 'Memory', href: '/admin/memory' },
      { id: 'intelligence-rooms', label: 'Intelligence Rooms', href: '/admin/intelligence-rooms' },
      { id: 'browser-agent', label: 'Browser Agent', href: '/admin/browser-agent' },
    ],
  },
  {
    id: 'tool-hub',
    label: 'Tool Hub',
    href: '/admin/tool-hub',
    description: 'Connected tools, external AI apps, context bridge, and terminal coordination.',
    status: 'planned',
    metric: { label: 'Tools', value: '9', tone: 'neutral' },
    children: [
      { id: 'tools', label: 'Tools', href: '/admin/tools' },
      { id: 'developer-runtime', label: 'Developer Runtime', href: '/admin/developer-runtime' },
      { id: 'coordinator', label: 'Coordinator', href: '/admin/coordinator' },
      { id: 'semse-x', label: 'SEMSE X', href: '/admin/semse-x' },
      { id: 'html-in-canvas', label: 'HTML Canvas', href: '/admin/html-in-canvas' },
    ],
  },
  {
    id: 'verticals',
    label: 'Verticals',
    href: '/admin/verticals',
    description: 'Construction, property turnovers, cleaning, agro, and maintenance.',
    status: 'planned',
    metric: { label: 'Verticals', value: '5', tone: 'neutral' },
    children: [
      { id: 'vision', label: 'Vision', href: '/admin/vision' },
      { id: 'travel', label: 'Travel', href: '/admin/travel' },
      { id: 'field-ops', label: 'Field Ops', href: '/admin/field-ops' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/admin/settings',
    description: 'System configuration, account settings, and admin preferences.',
    status: 'operational',
    metric: { label: 'Config', value: 'OK', tone: 'success' },
    children: [{ id: 'settings', label: 'Settings', href: '/admin/settings' }],
  },
];

export const ADMIN_PRIMARY_NAV = ADMIN_MODULES.map(({ id, label, href, status }) => ({ id, label, href, status }));

export function getAdminModuleById(id: string): AdminModule | undefined {
  return ADMIN_MODULES.find((module) => module.id === id);
}

export function getAdminModuleForPath(pathname: string): AdminModule | undefined {
  return ADMIN_MODULES.find((module) => {
    if (pathname === module.href) return true;
    return module.children.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`));
  });
}
