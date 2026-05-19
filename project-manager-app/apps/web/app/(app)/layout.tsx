"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { LanguageProvider, useLanguage, type LanguagePreference } from "../../lib/language-context";
import { AgentChatPanel } from "../../components/ai/agent-chat-panel";
import { AgentPanelStateProvider } from "../../components/ai/agent-panel-state";
import { MissionControlAlertBanner } from "../../components/ai/mission-control-alert-banner";
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
  Eye,
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
  PlaneTakeoff,
  Plus,
  Settings,
  ShieldCheck,
  Star,
  User,
  Users,
  Wrench,
  X,
} from "lucide-react";

type NavRole = "worker" | "client" | "admin";
type ThemePreference = "dark" | "light";

interface NavItem {
  labelKey: string;
  href: string;
  icon: typeof LayoutDashboard;
  section?: string;
}

const NAV: Record<NavRole, { labelKey: string; color: string; icon: typeof HardHat; items: NavItem[] }> = {
  worker: {
    labelKey: "role.worker",
    color: "#10b981",
    icon: HardHat,
    items: [
      { labelKey: "nav.workerDashboard", href: "/worker/dashboard", icon: LayoutDashboard, section: "section.main" },
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
      { labelKey: "nav.myProfile", href: "/worker/profile", icon: User },
      { labelKey: "nav.aiSettings", href: "/worker/settings", icon: Settings },
      { labelKey: "nav.agents", href: "/agents", icon: Bot, section: "section.ai" },
    ],
  },
  client: {
    labelKey: "role.client",
    color: "#3b82f6",
    icon: Building,
    items: [
      { labelKey: "nav.dashboard", href: "/client/dashboard", icon: LayoutDashboard, section: "section.main" },
      { labelKey: "nav.leads", href: "/client/leads", icon: Users },
      { labelKey: "nav.postJob", href: "/client/jobs/new", icon: Plus },
      { labelKey: "nav.myProjects", href: "/client/jobs", icon: FolderKanban },
      { labelKey: "nav.aiCopilot", href: "/client/projects", icon: Bot },
      { labelKey: "nav.milestones", href: "/client/milestones", icon: CheckSquare },
      { labelKey: "nav.professionals", href: "/client/professionals", icon: Users },
      { labelKey: "nav.documents", href: "/client/documents", icon: FileText },
      { labelKey: "nav.reviews", href: "/client/reviews", icon: Star },
      { labelKey: "nav.payments", href: "/client/payments", icon: CreditCard },
      { labelKey: "nav.financeHub", href: "/client/finance", icon: DollarSign },
      { labelKey: "nav.agents", href: "/agents", icon: Bot, section: "section.ai" },
    ],
  },
  admin: {
    labelKey: "role.admin",
    color: "#8b5cf6",
    icon: ShieldCheck,
    items: [
      { labelKey: "nav.dashboard", href: "/admin/dashboard", icon: LayoutDashboard, section: "section.main" },
      { labelKey: "nav.operations", href: "/admin/ops", icon: Activity },
      { labelKey: "nav.autonomy", href: "/admin/autonomy", icon: GitBranch },
      { labelKey: "nav.developerRuntime", href: "/admin/developer-runtime", icon: Bot },
      { labelKey: "nav.domainEvents", href: "/admin/domain-events", icon: Bell },
      { labelKey: "nav.users", href: "/admin/users", icon: Users },
      { labelKey: "nav.disputes", href: "/admin/disputes", icon: AlertTriangle },
      { labelKey: "nav.qaCenter", href: "/admin/qa", icon: ShieldCheck, section: "section.control" },
      { labelKey: "nav.compliance", href: "/admin/compliance", icon: CheckSquare },
      { labelKey: "nav.finance", href: "/admin/finance", icon: CreditCard },
      { labelKey: "nav.travelOps", href: "/admin/travel", icon: PlaneTakeoff },
      { labelKey: "nav.reports", href: "/admin/reports", icon: BarChart2 },
      { labelKey: "nav.fieldOps", href: "/admin/field-ops", icon: Wrench, section: "section.operations" },
      { labelKey: "nav.settings", href: "/admin/settings", icon: Settings },
      { labelKey: "nav.htmlCanvas", href: "/admin/html-in-canvas", icon: Layers, section: "section.lab" },
      { labelKey: "nav.buildOps", href: "/buildops", icon: FolderKanban, section: "section.lab" },
      { labelKey: "nav.semseTools", href: "/tools", icon: Wrench, section: "section.lab" },
      { labelKey: "nav.agents", href: "/agents", icon: Bot, section: "section.ai" },
      { labelKey: "nav.coordinator", href: "/admin/coordinator", icon: GitBranch },
      { labelKey: "nav.missionControl", href: "/admin/mission-control", icon: Activity, section: "section.control" },
      { labelKey: "nav.algorithmEngine", href: "/admin/algorithm-engine", icon: BarChart2 },
      { labelKey: "nav.aiMissionControl", href: "/admin/ai-mission-control", icon: Brain },
      { labelKey: "nav.consciousness", href: "/admin/consciousness", icon: Eye },
      { labelKey: "nav.llmMetrics", href: "/admin/llm-metrics", icon: BarChart2 },
      { labelKey: "nav.pmo", href: "/admin/pmo", icon: BarChart2 },
      { labelKey: "nav.semseX", href: "/admin/semse-x", icon: Infinity },
      { labelKey: "nav.agentMemory", href: "/admin/memory", icon: Brain },
      { labelKey: "nav.prometeo", href: "/admin/prometeo", icon: BookOpen },
    ],
  },
};

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
  const RoleIcon = nav.icon;

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
        {(!collapsed || mobile) && (
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
              <RoleIcon size={15} color="#fff" />
            </div>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 800, color: "var(--ink)", lineHeight: 1 }}>SEMSE</p>
              <p style={{ fontSize: "10px", color: nav.color, fontWeight: 600 }}>{t(nav.labelKey)}</p>
            </div>
          </div>
        )}
        {collapsed && !mobile && (
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              background: nav.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RoleIcon size={15} color="#fff" />
          </div>
        )}
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
        {nav.items.map((item) => {
          const Icon = item.icon;
          const active = (pathname ?? "").startsWith(item.href);
          const label = t(item.labelKey);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              title={collapsed && !mobile ? label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "9px 10px",
                borderRadius: "8px",
                marginBottom: "2px",
                textDecoration: "none",
                background: active ? `${nav.color}18` : "transparent",
                color: active ? nav.color : "var(--muted)",
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
        })}
      </nav>

      {(!collapsed || mobile) && (
        <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)" }}>
          <Link
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
          </Link>
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
        <button
          title={t("ui.notifications")}
          style={{
            padding: "6px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--muted)",
            cursor: "pointer",
            position: "relative",
          }}
        >
          <Bell size={16} />
        </button>
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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("dark");
  const { language, t } = useLanguage();
  const nav = NAV[role];
  const RoleIcon = nav.icon;

  useState(() => {
    if (typeof window === "undefined") return;
    const savedTheme = window.localStorage.getItem("semse-theme");
    if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
  });

  const handleThemeChange = (value: ThemePreference) => {
    setTheme(value);
    document.documentElement.dataset.theme = value;
    window.localStorage.setItem("semse-theme", value);
  };

  const shellNavItems = useMemo(
    () =>
      nav.items.map((item) => {
        const Icon = item.icon;
        const active = (pathname ?? "").startsWith(item.href);
        const label = t(item.labelKey);

        return {
          key: item.href,
          label,
          active,
          node: (
            <Link
              href={item.href}
              title={collapsed ? label : undefined}
              className={[
                "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors",
                active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              <span className="flex h-5 w-5 items-center justify-center">
                <Icon size={16} />
              </span>
              {!collapsed ? <span className="truncate">{label}</span> : null}
            </Link>
          ),
        };
      }),
    [nav.items, pathname, collapsed, language, t],
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <div className="desktop-sidebar">
        <AppShell
          brand={
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
                <RoleIcon size={15} color="#fff" />
              </div>
              {!collapsed ? (
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 800, color: "var(--ink)", lineHeight: 1 }}>SEMSE</p>
                  <p style={{ fontSize: "10px", color: nav.color, fontWeight: 600 }}>{t(nav.labelKey)}</p>
                </div>
              ) : null}
            </div>
          }
          navItems={shellNavItems}
          hideHeader
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          sidebarFooter={
            !collapsed ? (
              <Link
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
              </Link>
            ) : null
          }
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
        <main style={{ flex: 1, padding: "24px", overflow: "auto" }}>{children}</main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
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
