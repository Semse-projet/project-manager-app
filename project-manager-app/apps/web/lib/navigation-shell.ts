import type { ComponentType, CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  Briefcase,
  Building,
  Calendar,
  Camera,
  CheckSquare,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  FolderKanban,
  HardHat,
  LayoutDashboard,
  Layers,
  Leaf,
  MessageSquare,
  Package,
  PlaneTakeoff,
  Plus,
  Send,
  Settings,
  ShieldCheck,
  Star,
  Store,
  User,
  Users,
  Wrench,
} from "lucide-react";

export type ShellNavIcon = ComponentType<{ size?: number; style?: CSSProperties; color?: string }>;

export interface ShellNavItem {
  labelKey: string;
  href: string;
  icon: ShellNavIcon;
  section?: string;
}

export interface ShellNavLink {
  key: string;
  labelKey: string;
  label: string;
  href: string;
  active: boolean;
  icon: ShellNavIcon;
}

export interface AdminNavGroup {
  key: string;
  labelKey: string;
  items: ShellNavItem[];
}

export type NavRole = "worker" | "client" | "admin";

export interface NavRoleConfig {
  labelKey: string;
  color: string;
  icon: ShellNavIcon;
  items: ShellNavItem[];
}

const ADMIN_GROUP_ORDER: Array<{ key: AdminNavGroup["key"]; labelKey: AdminNavGroup["labelKey"] }> = [
  { key: "mission-control", labelKey: "os.missionControl" },
  { key: "operations", labelKey: "os.operations" },
  { key: "marketplace", labelKey: "os.marketplace" },
  { key: "governance", labelKey: "os.governance" },
  { key: "ai", labelKey: "os.ai" },
  { key: "system", labelKey: "os.system" },
];

function adminGroupForHref(href: string): AdminNavGroup["key"] {
  if (href === "/admin/dashboard" || href === "/admin/mission-control") return "mission-control";
  if (href === "/admin/ai-mission-control" || href === "/admin/intelligence") return "ai";
  if (
    href.startsWith("/admin/ops") ||
    href === "/admin/workops" ||
    href === "/admin/field-ops" ||
    href === "/admin/communications" ||
    href === "/admin/domain-events" ||
    href === "/admin/reports" ||
    href === "/admin/coordinator"
  ) {
    return "operations";
  }
  if (
    href === "/admin/marketplace" ||
    href === "/admin/contractors" ||
    href === "/buildops" ||
    href === "/tools"
  ) {
    return "marketplace";
  }
  if (
    href === "/admin/trust" ||
    href === "/admin/disputes" ||
    href === "/admin/compliance" ||
    href === "/admin/finance" ||
    href === "/admin/governance" ||
    href === "/admin/qa"
  ) {
    return "governance";
  }
  if (
    href === "/agents" ||
    href === "/admin/agents" ||
    href === "/admin/autonomy" ||
    href === "/admin/developer-runtime" ||
    href === "/admin/algorithm-engine" ||
    href === "/admin/consciousness" ||
    href === "/admin/ecosystem" ||
    href === "/admin/tool-hub" ||
    href === "/admin/llm-metrics" ||
    href === "/admin/pmo" ||
    href === "/admin/semse-x" ||
    href === "/admin/memory" ||
    href === "/admin/prometeo"
  ) {
    return "ai";
  }
  if (href === "/admin/verticals") return "system";
  return "system";
}

export function buildAdminSidebarGroups(items: ShellNavItem[]): AdminNavGroup[] {
  const grouped = new Map<AdminNavGroup["key"], ShellNavItem[]>();
  for (const item of items) {
    const key = adminGroupForHref(item.href);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(item);
    else grouped.set(key, [item]);
  }

  return ADMIN_GROUP_ORDER.map((group) => ({
    key: group.key,
    labelKey: group.labelKey,
    items: grouped.get(group.key) ?? [],
  })).filter((group) => group.items.length > 0);
}

export const NAV_REGISTRY: Record<NavRole, NavRoleConfig> = {
  worker: {
    labelKey: "role.worker",
    color: "#81c995",
    icon: HardHat,
    items: [
      { labelKey: "nav.workerDashboard", href: "/worker/dashboard",     icon: LayoutDashboard, section: "section.main" },
      { labelKey: "nav.opportunities",   href: "/worker/opportunities",  icon: Store },
      { labelKey: "nav.myBids",          href: "/worker/bids",           icon: Send },
      { labelKey: "nav.agenda",          href: "/worker/agenda",         icon: Calendar },
      { labelKey: "nav.myJobs",          href: "/worker/jobs",           icon: Briefcase },
      { labelKey: "nav.tasks",           href: "/worker/tasks",          icon: CheckSquare },
      { labelKey: "nav.timeTracker",     href: "/worker/tracker",        icon: Clock },
      { labelKey: "nav.evidence",        href: "/worker/evidence",       icon: Camera },
      { labelKey: "nav.materials",       href: "/worker/materials",      icon: Package },
      { labelKey: "nav.incidents",       href: "/worker/incidents",      icon: AlertTriangle },
      { labelKey: "nav.payments",        href: "/worker/payments",       icon: CreditCard },
      { labelKey: "nav.travel",          href: "/worker/travel",         icon: PlaneTakeoff },
      { labelKey: "nav.fieldOps",        href: "/worker/field-ops",      icon: Wrench, section: "section.field" },
      { labelKey: "nav.reviews",         href: "/worker/review",         icon: Star },
      { labelKey: "nav.myProfile",       href: "/worker/profile",        icon: User },
      { labelKey: "nav.aiSettings",      href: "/worker/settings",       icon: Settings },
      { labelKey: "nav.agents",          href: "/agents",                icon: Bot, section: "section.ai" },
    ],
  },
  client: {
    labelKey: "role.client",
    color: "#8ab4f8",
    icon: Building,
    items: [
      { labelKey: "nav.dashboard",          href: "/client/dashboard",     icon: LayoutDashboard, section: "section.main" },
      { labelKey: "nav.leads",              href: "/client/leads",         icon: Users },
      { labelKey: "nav.postJob",            href: "/client/jobs/new",      icon: Plus },
      { labelKey: "nav.myProjects",         href: "/client/jobs",          icon: FolderKanban },
      { labelKey: "nav.aiCopilot",          href: "/client/projects",      icon: Bot },
      { labelKey: "nav.milestones",         href: "/client/milestones",    icon: CheckSquare },
      { labelKey: "nav.professionals",      href: "/client/professionals", icon: Users },
      { labelKey: "nav.clientMarketplace",  href: "/client/marketplace",   icon: Store },
      { labelKey: "nav.myBids",             href: "/client/bids",          icon: Send },
      { labelKey: "nav.protools",           href: "/client/protools",      icon: Wrench },
      { labelKey: "nav.documents",          href: "/client/documents",     icon: FileText },
      { labelKey: "nav.reviews",            href: "/client/reviews",       icon: Star },
      { labelKey: "nav.payments",           href: "/client/payments",      icon: CreditCard },
      { labelKey: "nav.financeHub",         href: "/client/finance",       icon: DollarSign },
      { labelKey: "nav.agents",             href: "/agents",               icon: Bot, section: "section.ai" },
    ],
  },
  admin: {
    labelKey: "role.admin",
    color: "#c58af9",
    icon: ShieldCheck,
    items: [
      { labelKey: "nav.dashboard",      href: "/admin/dashboard",       icon: LayoutDashboard, section: "section.core" },
      { labelKey: "nav.missionControl", href: "/admin/mission-control", icon: Activity,        section: "section.modules" },
      { labelKey: "nav.workops",        href: "/admin/workops",         icon: Wrench },
      { labelKey: "nav.marketplace",    href: "/admin/marketplace",     icon: Store },
      { labelKey: "nav.finance",        href: "/admin/finance",         icon: DollarSign },
      { labelKey: "nav.trust",          href: "/admin/trust",           icon: ShieldCheck },
      { labelKey: "nav.intelligence",   href: "/admin/intelligence",    icon: Brain },
      { labelKey: "nav.toolHub",        href: "/admin/tool-hub",        icon: Package },
      { labelKey: "nav.verticals",      href: "/admin/verticals",       icon: Layers },
      { labelKey: "nav.settings",       href: "/admin/settings",        icon: Settings },
      { labelKey: "nav.agro",           href: "/agro",                  icon: Leaf,            section: "section.verticals" },
      { labelKey: "nav.buildOps",       href: "/buildops",              icon: FolderKanban },
      { labelKey: "nav.semseTools",     href: "/tools",                 icon: Wrench },
      { labelKey: "nav.users",          href: "/admin/users",           icon: Users,           section: "section.quick" },
      { labelKey: "nav.communications", href: "/admin/communications",  icon: MessageSquare },
      { labelKey: "nav.agents",         href: "/agents",                icon: Bot },
    ],
  },
};

export function buildShellNavItems({
  role,
  items,
  collapsed,
  pathname,
  t,
}: {
  role: "worker" | "client" | "admin";
  items: ShellNavItem[];
  collapsed: boolean;
  pathname: string;
  t: (key: string) => string;
}): Array<ShellNavLink | AdminNavGroup> {
  if (role !== "admin") {
    return items.map((item) => {
      const Icon = item.icon;
      const active = pathname.startsWith(item.href);
      const label = t(item.labelKey);

      return {
        key: item.href,
        labelKey: item.labelKey,
        label,
        href: item.href,
        active,
        icon: Icon,
      };
    });
  }

  const groups = buildAdminSidebarGroups(items);
  return groups.map((group) => ({
    ...group,
    label: t(group.labelKey),
    items: group.items.map((item) => ({
      ...item,
      label: t(item.labelKey),
      active: pathname.startsWith(item.href),
    })),
  }));
}
