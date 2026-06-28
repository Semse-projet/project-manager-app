import type { ComponentType, CSSProperties } from "react";

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
