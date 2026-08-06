"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { LanguageProvider, useLanguage, type LanguagePreference } from "../../lib/language-context";
import {
  buildShellNavItems,
  isNewNavSection,
  type ShellNavItem,
} from "../../lib/navigation-shell";
import { ADMIN_MODULES } from "../../lib/admin/admin-navigation";
import { AgentChatPanel } from "../../components/ai/agent-chat-panel";
import { PrometeoCopilot } from "../components/prometeo/PrometeoCopilot";
import { AgentPanelStateProvider } from "../../components/ai/agent-panel-state";
import { MissionControlAlertBanner } from "../../components/ai/mission-control-alert-banner";
import { NotificationBell } from "../../components/semse/NotificationBell";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell } from "@semse/ui";
import {
  Activity,
  AlertTriangle,
  BarChart2,
  Bell,
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  Send,
  Building2,
  Cpu,
  Eye,
  Store,
  Zap,
  Building,
  Calendar,
  Camera,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  FolderKanban,
  GitBranch,
  HardHat,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  DollarSign,
  Infinity,
  Leaf,
  PlaneTakeoff,
  Plus,
  Settings,
  ShieldCheck,
  Star,
  User,
  Users,
  Wrench,
  X,
  Scale,
} from "lucide-react";

type NavRole = "worker" | "client" | "admin";
type ThemePreference = "dark" | "light";

interface NavItem extends ShellNavItem {}

// Icon per ADMIN_MODULES id — same icon each route already used in the
// hand-curated list this replaces (see AUDIT_REMEDIATION_PLAN.md 1.17 and
// the Epic A1 admin-navigation.ts spec).
const ADMIN_MODULE_ICONS: Record<string, typeof HardHat> = {
  "mission-control": Activity,
  workops: Wrench,
  marketplace: Store,
  finance: DollarSign,
  trust: ShieldCheck,
  intelligence: Brain,
  "tool-hub": Package,
  verticals: Layers,
  settings: Settings,
};

const ADMIN_NAV_ITEMS: NavItem[] = [
  ...ADMIN_MODULES.map((module) => ({
    labelKey: module.label,
    href: module.href,
    icon: ADMIN_MODULE_ICONS[module.id] ?? LayoutDashboard,
  })),
  // Routes not represented as an ADMIN_MODULES module or child — kept as
  // quick links so this sidebar swap doesn't drop functionality.
  { labelKey: "nav.accountSecurity", href: "/admin/account", icon: User },
  { labelKey: "nav.agro", href: "/agro", icon: Leaf },
  { labelKey: "nav.buildOps", href: "/buildops", icon: FolderKanban },
  { labelKey: "nav.semseTools", href: "/tools", icon: Wrench },
  { labelKey: "nav.agents", href: "/agents", icon: Bot },
];

const NAV: Record<NavRole, { labelKey: string; color: string; icon: typeof HardHat; items: NavItem[] }> = {
  worker: {
    labelKey: "role.worker",
    color: "#81c995",
    icon: HardHat,
    items: [
      { labelKey: "nav.workerDashboard", href: "/worker/dashboard", icon: LayoutDashboard, section: "section.main" },
      { labelKey: "nav.opportunities", href: "/worker/opportunities", icon: Store },
      { labelKey: "nav.myBids", href: "/worker/bids", icon: Send },
      { labelKey: "nav.agenda", href: "/worker/agenda", icon: Calendar },
      { labelKey: "nav.myJobs", href: "/worker/jobs", icon: Briefcase },
      { labelKey: "nav.tasks", href: "/worker/tasks", icon: CheckSquare },
      { labelKey: "nav.timeTracker", href: "/worker/tracker", icon: Clock },
      { labelKey: "nav.evidence", href: "/worker/evidence", icon: Camera },
      { labelKey: "nav.materials", href: "/worker/materials", icon: Package },
      { labelKey: "nav.incidents", href: "/worker/incidents", icon: AlertTriangle },
      { labelKey: "nav.payments", href: "/worker/payments", icon: CreditCard },
      { labelKey: "nav.travel", href: "/worker/travel", icon: PlaneTakeoff },
      { labelKey: "nav.fieldOps", href: "/worker/field-ops", icon: Wrench, section: "section.field" },
      { labelKey: "nav.reviews", href: "/worker/review", icon: Star },
      { labelKey: "nav.myProfile", href: "/worker/profile", icon: User },
      { labelKey: "nav.accountSecurity", href: "/worker/account", icon: ShieldCheck },
      { labelKey: "nav.aiSettings", href: "/worker/settings", icon: Settings },
      { labelKey: "nav.agents", href: "/agents", icon: Bot, section: "section.ai" },
    ],
  },
  client: {
    labelKey: "role.client",
    color: "#8ab4f8",
    icon: Building,
    // Grouped and explicitly labeled into two contexts a Client account can
    // act in — "buyer" (hiring professionals for your own jobs) vs.
    // "contractor" (bidding on other jobs, running your own lead/CRM
    // pipeline) — instead of one flat undifferentiated list. This was a real
    // source of confusion (e.g. 1.5's "Aplicar" button showing up on the
    // client's own marketplace listing, fixed separately in
    // marketplace.service.ts). See AUDIT_REMEDIATION_PLAN.md 1.5 — kept as
    // one Client role/dashboard per the product decision, not split into two
    // separate roles.
    items: [
      { labelKey: "nav.dashboard", href: "/client/dashboard", icon: LayoutDashboard, section: "section.main" },
      { labelKey: "nav.postJob", href: "/client/jobs/new", icon: Plus, section: "section.buyer" },
      { labelKey: "nav.myProjects", href: "/client/jobs", icon: FolderKanban },
      { labelKey: "nav.aiCopilot", href: "/client/projects", icon: Bot },
      { labelKey: "nav.milestones", href: "/client/milestones", icon: CheckSquare },
      { labelKey: "nav.professionals", href: "/client/professionals", icon: Users },
      { labelKey: "nav.documents", href: "/client/documents", icon: FileText },
      { labelKey: "nav.reviews", href: "/client/reviews", icon: Star },
      { labelKey: "nav.payments", href: "/client/payments", icon: CreditCard },
      { labelKey: "nav.financeHub", href: "/client/finance", icon: DollarSign },
      { labelKey: "nav.leads", href: "/client/leads", icon: Users, section: "section.contractor" },
      { labelKey: "nav.clientMarketplace", href: "/client/marketplace", icon: Store },
      { labelKey: "nav.myBids", href: "/client/bids", icon: Send },
      { labelKey: "nav.protools", href: "/client/protools", icon: Wrench },
      { labelKey: "nav.accountSecurity", href: "/client/account", icon: ShieldCheck, section: "section.account" },
      { labelKey: "nav.agents", href: "/agents", icon: Bot, section: "section.ai" },
    ],
  },
  admin: {
    labelKey: "role.admin",
    color: "#c58af9",
    icon: ShieldCheck,
    // Derived from ADMIN_MODULES (apps/web/lib/admin/admin-navigation.ts) —
    // the single source of truth also used by the /admin/* hub pages. No
    // per-item `section` markers: admin now renders as a flat list through
    // the same path worker/client already use (see isNewNavSection below),
    // instead of its own buildAdminSidebarGroups()-grouped branch. Legacy
    // leaf routes (Jobs, Users, Contractors, etc.) are reachable as cards on
    // each module's hub page rather than as direct sidebar links — see
    // AUDIT_REMEDIATION_PLAN.md 1.17 for why this reduces (not reopens) the
    // nav-renderer duplication documented there.
    items: ADMIN_NAV_ITEMS,
  },
};

// Shared nav-content building blocks — used by both the mobile `Sidebar`
// drawer and the desktop `AppShell` renderer in `AppLayoutInner` below, so
// there is exactly one implementation of what a brand block / section
// header / nav link / sign-out footer looks like. See
// AUDIT_REMEDIATION_PLAN.md 1.17 for why these used to be two separate,
// visually-diverging implementations (inline styles vs Tailwind classes).
function NavBrand({
  nav,
  collapsed,
  mobile,
}: {
  nav: (typeof NAV)[NavRole];
  collapsed: boolean;
  mobile?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "8px",
          background: nav.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <img src="/brand/mark-transparent.png" alt="" width={15} height={15} style={{ display: "block" }} />
      </div>
      {(!collapsed || mobile) && (
        <div>
          <p style={{ fontSize: "13px", fontWeight: 800, color: "var(--ink)", lineHeight: 1 }}>SEMSEproject</p>
          <p style={{ fontSize: "10px", color: nav.color, fontWeight: 600 }}>{t(nav.labelKey)}</p>
        </div>
      )}
    </div>
  );
}

function NavSignOutFooter({ collapsed }: { collapsed: boolean }) {
  const { t } = useLanguage();
  if (collapsed) return null;
  return (
    <a
      href="/logout"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 10px",
        borderRadius: "8px",
        textDecoration: "none",
        color: "var(--muted)",
        fontSize: "13px",
        fontWeight: 500,
      }}
    >
      <LogOut size={15} />
      {t("ui.signOut")}
    </a>
  );
}

function NavSectionHeader({ label, first }: { label: string; first: boolean }) {
  return (
    <div
      style={{
        fontSize: "10px",
        fontWeight: 800,
        color: "var(--faint, #6b7280)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        padding: first ? "2px 10px 6px" : "14px 10px 6px",
      }}
    >
      {label}
    </div>
  );
}

function NavLink({
  item,
  active,
  label,
  color,
  collapsed,
  mobile,
  onClose,
}: {
  item: NavItem;
  active: boolean;
  label: string;
  color: string;
  collapsed: boolean;
  mobile?: boolean;
  onClose?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClose}
      title={collapsed ? label : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "9px 10px",
        borderRadius: "8px",
        marginBottom: "2px",
        textDecoration: "none",
        background: active ? `${color}18` : "transparent",
        color: active ? color : "var(--muted)",
        fontWeight: active ? 700 : 500,
        fontSize: "13px",
        transition: "background 0.12s, color 0.12s",
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      <Icon size={16} style={{ flexShrink: 0 }} />
      {(!collapsed || mobile) && <span>{label}</span>}
    </Link>
  );
}

function Sidebar({
  role,
  collapsed,
  onToggle,
  onClose,
  mobile,
}: {
  role: NavRole;
  collapsed: boolean;
  onToggle: () => void;
  onClose?: () => void;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const nav = NAV[role];

  return (
    <aside
      style={{
        width: collapsed && !mobile ? "60px" : "220px",
        flexShrink: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        transition: "width 0.2s ease",
        zIndex: 50,
        overflowX: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: "56px",
        }}
      >
        <NavBrand nav={nav} collapsed={collapsed} mobile={mobile} />
        <button
          onClick={mobile ? onClose : onToggle}
          style={{
            padding: "4px",
            borderRadius: "6px",
            border: "none",
            background: "transparent",
            color: "var(--muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {mobile ? <X size={16} /> : collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
        {nav.items.map((item, idx) => {
          // A section marker starts a new visual group in the sidebar —
          // e.g. splitting the Client role's buyer tools (post a job,
          // projects, milestones) from its contractor tools (leads,
          // marketplace, my bids), which previously sat in one
          // undifferentiated list and were a real source of "which hat am
          // I wearing" confusion. See AUDIT_REMEDIATION_PLAN.md 1.5. Admin
          // has no `section` markers (flat list from ADMIN_MODULES), so this
          // is always false for that role.
          const showSectionHeader = isNewNavSection(nav.items, idx) && (!collapsed || mobile);

          return (
            <div key={item.href}>
              {showSectionHeader && (
                <NavSectionHeader label={t(item.section!)} first={idx === 0} />
              )}
              <NavLink
                item={item}
                active={(pathname ?? "").startsWith(item.href)}
                label={t(item.labelKey)}
                color={nav.color}
                collapsed={collapsed}
                mobile={mobile}
                onClose={onClose}
              />
            </div>
          );
        })}
      </nav>

      {(!collapsed || mobile) && (
        <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)" }}>
          <NavSignOutFooter collapsed={false} />
        </div>
      )}
    </aside>
  );
}

function Topbar({
  title,
  onMenuOpen,
  theme,
  onThemeChange,
}: {
  title?: string;
  onMenuOpen: () => void;
  theme: ThemePreference;
  onThemeChange: (value: ThemePreference) => void;
}) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header
      style={{
        height: "var(--topbar-h, 56px)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: "12px",
        background: "var(--surface)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <button
        onClick={onMenuOpen}
        style={{
          display: "none",
          padding: "6px",
          borderRadius: "8px",
          border: "none",
          background: "transparent",
          color: "var(--muted)",
          cursor: "pointer",
        }}
        className="mobile-menu-btn"
      >
        <Menu size={18} />
      </button>
      {title ? <h1 style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)", flex: 1 }}>{title}</h1> : null}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <label style={toolbarLabelStyle()}>
          <span>{t("ui.language")}</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value as LanguagePreference)} style={toolbarSelectStyle()}>
            <option value="es">ES</option>
            <option value="en">EN</option>
          </select>
        </label>
        <label style={toolbarLabelStyle()}>
          <span>{t("ui.theme")}</span>
          <select value={theme} onChange={(event) => onThemeChange(event.target.value as ThemePreference)} style={toolbarSelectStyle()}>
            <option value="dark">{t("ui.dark")}</option>
            <option value="light">{t("ui.light")}</option>
          </select>
        </label>
        <NotificationBell />
      </div>
    </header>
  );
}

function useAppRole(): NavRole {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/worker")) return "worker";
  if (pathname.startsWith("/admin")) return "admin";
  if (!pathname.startsWith("/client")) {
    // Neutral routes like /agents — read non-HttpOnly role cookie set at login
    try {
      const roleCookie = document.cookie.split(";").find(c => c.trim().startsWith("semse_app_role="))?.split("=")?.[1]?.trim();
      if (roleCookie === "admin") return "admin";
      if (roleCookie === "worker") return "worker";
    } catch { /* SSR or cookie unavailable */ }
  }
  return "client";
}

function AppLayoutInner({ children }: { children: ReactNode }) {
  const role = useAppRole();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("semse-sidebar-collapsed") === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("dark");
  const { language, t } = useLanguage();
  const nav = NAV[role];

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("semse-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("semse-theme", theme);
  }, [theme]);

  const handleCollapsedChange = (next: boolean) => {
    setCollapsed(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("semse-sidebar-collapsed", String(next));
    }
  };

  const handleThemeChange = (value: ThemePreference) => {
    setTheme(value);
  };

  const shellNavModel = useMemo(
    () =>
      buildShellNavItems({
        role,
        items: nav.items,
        collapsed,
        pathname: pathname ?? "",
        t,
      }),
    [nav.items, pathname, collapsed, role, t],
  );

  const shellNavItems = useMemo(
    () =>
      shellNavModel.map((navItem, idx) => {
        // Mirrors the section-header grouping in the mobile Sidebar component
        // (AUDIT_REMEDIATION_PLAN.md 1.5). Admin now shares this same flat
        // renderer with worker/client instead of its own grouped branch (see
        // AUDIT_REMEDIATION_PLAN.md 1.17) — the boundary-detection logic
        // itself is shared via isNewNavSection; only the surrounding
        // collapse/JSX differs between this renderer and the mobile Sidebar.
        const showSectionHeader = isNewNavSection(shellNavModel, idx) && !collapsed;
        return {
          key: navItem.key,
          label: navItem.label,
          active: navItem.active,
          node: (
            <div key={navItem.key}>
              {showSectionHeader && (
                <NavSectionHeader label={t(navItem.section!)} first={idx === 0} />
              )}
              <NavLink
                item={navItem}
                active={navItem.active}
                label={navItem.label}
                color={nav.color}
                collapsed={collapsed}
              />
            </div>
          ),
        };
      }),
    [shellNavModel, collapsed, t, nav.color],
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <div className="desktop-sidebar">
        <AppShell
          brand={<NavBrand nav={nav} collapsed={collapsed} />}
          navItems={shellNavItems}
          hideHeader
          collapsed={collapsed}
          onCollapsedChange={handleCollapsedChange}
          sidebarFooter={<NavSignOutFooter collapsed={collapsed} />}
          className="min-h-screen"
          contentClassName="hidden"
        >
          <></>
        </AppShell>
      </div>

      {mobileOpen ? (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.6)",
              zIndex: 100,
            }}
          />
          <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 101 }}>
            <Sidebar role={role} collapsed={false} onToggle={() => {}} onClose={() => setMobileOpen(false)} mobile />
          </div>
        </>
      ) : null}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar
          onMenuOpen={() => setMobileOpen(true)}
          theme={theme}
          onThemeChange={handleThemeChange}
        />
        <main style={{ flex: 1, padding: "24px", overflow: "auto", paddingBottom: role === "worker" ? "80px" : "24px" }}>{children}</main>
      </div>

      {role === "worker" && <WorkerMobileBottomNav pathname={pathname ?? ""} />}

      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none; }
          .mobile-menu-btn { display: flex !important; }
        }
        .worker-bottom-nav { display: none; }
        @media (max-width: 768px) {
          .worker-bottom-nav { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

function WorkerMobileBottomNav({ pathname }: { pathname: string }) {
  const tabs = [
    { href: "/worker/dashboard",    icon: LayoutDashboard, label: "Inicio" },
    { href: "/worker/jobs",         icon: Briefcase,        label: "Trabajos" },
    { href: "/worker/tracker",      icon: Clock,            label: "Tiempo" },
    { href: "/worker/evidence",     icon: Camera,           label: "Evidencia" },
    { href: "/worker/opportunities",icon: Store,            label: "Ofertas" },
  ] as const;

  return (
    <nav
      className="worker-bottom-nav"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        background: "var(--surface, #1b1c1d)",
        borderTop: "1px solid rgba(220,231,227,0.08)",
        zIndex: 99,
        alignItems: "center",
        justifyContent: "space-around",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {tabs.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: "8px 12px",
              color: active ? "var(--brand, #8ab4f8)" : "var(--muted, #6b7280)",
              textDecoration: "none",
              minWidth: 56,
            }}
          >
            <Icon size={20} />
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AdminOnlyBanner() {
  const pathname = usePathname() ?? "";
  if (!pathname.startsWith("/admin")) return null;
  return <MissionControlAlertBanner />;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <AgentPanelStateProvider>
        <AppLayoutInner>{children}</AppLayoutInner>
        <AgentChatPanel />
        <PrometeoCopilot />
        <AdminOnlyBanner />
      </AgentPanelStateProvider>
    </LanguageProvider>
  );
}

function toolbarLabelStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 10px",
    borderRadius: "10px",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--muted)",
    fontSize: "12px",
    fontWeight: 600,
  };
}

function toolbarSelectStyle(): CSSProperties {
  return {
    border: "none",
    background: "transparent",
    color: "var(--ink)",
    fontSize: "12px",
    fontWeight: 700,
    outline: "none",
    cursor: "pointer",
  };
}
