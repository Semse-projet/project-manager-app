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
  section?: string;
}

/**
 * Whether `items[idx]` starts a new visually-grouped section — i.e. it
 * declares a `section` different from the previous item's. Shared by the
 * two nav renderers that group by the raw `section` field (mobile Sidebar,
 * desktop AppShell) so the "new section" boundary logic lives in one place
 * instead of two copies of the same ternary. All three roles (worker,
 * client, admin) go through this now — admin used to group via a separate
 * href-keyed taxonomy (`buildAdminSidebarGroups`/`adminGroupForHref`); see
 * AUDIT_REMEDIATION_PLAN.md 1.17 for why that was retired in favor of a flat
 * list derived from `ADMIN_MODULES`.
 */
export function isNewNavSection(items: Array<{ section?: string }>, idx: number): boolean {
  const current = items[idx];
  if (!current?.section) return false;
  const previous = idx > 0 ? items[idx - 1] : undefined;
  return current.section !== previous?.section;
}

export function buildShellNavItems({
  items,
  pathname,
  t,
}: {
  role: "worker" | "client" | "admin";
  items: ShellNavItem[];
  collapsed: boolean;
  pathname: string;
  t: (key: string) => string;
}): ShellNavLink[] {
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
      section: item.section,
    };
  });
}
