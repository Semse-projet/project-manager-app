"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
type LanguagePreference = "es" | "en";

interface NavItem {
  label: string;
  labelEn?: string;
  href: string;
  icon: typeof LayoutDashboard;
  section?: string;
}

const NAV: Record<NavRole, { label: string; labelEn: string; color: string; icon: typeof HardHat; items: NavItem[] }> = {
  worker: {
    label: "Profesional",
    labelEn: "Worker",
    color: "#10b981",
    icon: HardHat,
    items: [
      { label: "Dashboard", labelEn: "Dashboard", href: "/worker/dashboard", icon: LayoutDashboard, section: "Principal" },
      { label: "Agenda", labelEn: "Agenda", href: "/worker/agenda", icon: Calendar },
      { label: "Mis trabajos", labelEn: "My jobs", href: "/worker/jobs", icon: Briefcase },
      { label: "Tareas", labelEn: "Tasks", href: "/worker/tasks", icon: CheckSquare },
      { label: "Time Tracker", labelEn: "Time Tracker", href: "/worker/tracker", icon: Clock },
      { label: "Evidencia", labelEn: "Evidence", href: "/worker/evidence", icon: Camera },
      { label: "Materiales", labelEn: "Materials", href: "/worker/materials", icon: Package },
      { label: "Incidencias", labelEn: "Incidents", href: "/worker/incidents", icon: AlertTriangle },
      { label: "Pagos", labelEn: "Payments", href: "/worker/payments", icon: CreditCard },
      { label: "Movilidad", labelEn: "Travel Ops", href: "/worker/travel", icon: PlaneTakeoff },
      { label: "Field Ops", labelEn: "Field Ops", href: "/worker/field-ops", icon: Wrench, section: "Campo" },
      { label: "Mi perfil", labelEn: "My profile", href: "/worker/profile", icon: User },
      { label: "Asistente IA", labelEn: "AI Settings", href: "/worker/settings", icon: Settings },
      { label: "Agentes", labelEn: "Agents", href: "/agents", icon: Bot, section: "IA" },
    ],
  },
  client: {
    label: "Cliente",
    labelEn: "Client",
    color: "#3b82f6",
    icon: Building,
    items: [
      { label: "Dashboard", labelEn: "Dashboard", href: "/client/dashboard", icon: LayoutDashboard, section: "Principal" },
      { label: "Leads & Clientes", labelEn: "Leads & Clients", href: "/client/leads", icon: Users },
      { label: "Publicar trabajo", labelEn: "Post job", href: "/client/jobs/new", icon: Plus },
      { label: "Mis proyectos", labelEn: "My projects", href: "/client/jobs", icon: FolderKanban },
      { label: "Copiloto IA", labelEn: "AI Copilot", href: "/client/projects", icon: Bot },
      { label: "Milestones", labelEn: "Milestones", href: "/client/milestones", icon: CheckSquare },
      { label: "Profesionales", labelEn: "Professionals", href: "/client/professionals", icon: Users },
      { label: "Documentos", labelEn: "Documents", href: "/client/documents", icon: FileText },
      { label: "Reseñas", labelEn: "Reviews", href: "/client/reviews", icon: Star },
      { label: "Pagos", labelEn: "Payments", href: "/client/payments", icon: CreditCard },
      { label: "Finance Hub", labelEn: "Finance Hub", href: "/client/finance", icon: DollarSign },
      { label: "Agentes", labelEn: "Agents", href: "/agents", icon: Bot, section: "IA" },
    ],
  },
  admin: {
    label: "Admin",
    labelEn: "Admin",
    color: "#8b5cf6",
    icon: ShieldCheck,
    items: [
      { label: "Dashboard", labelEn: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, section: "Principal" },
      { label: "Operaciones", labelEn: "Operations", href: "/admin/ops", icon: Activity },
      { label: "Autonomía", labelEn: "Autonomy", href: "/admin/autonomy", icon: GitBranch },
      { label: "Developer Runtime", labelEn: "Developer Runtime", href: "/admin/developer-runtime", icon: Bot },
      { label: "Domain Events", labelEn: "Domain Events", href: "/admin/domain-events", icon: Bell },
      { label: "Usuarios", labelEn: "Users", href: "/admin/users", icon: Users },
      { label: "Disputas", labelEn: "Disputes", href: "/admin/disputes", icon: AlertTriangle },
      { label: "QA Center", labelEn: "QA Center", href: "/admin/qa", icon: ShieldCheck, section: "Control" },
      { label: "Compliance", labelEn: "Compliance", href: "/admin/compliance", icon: CheckSquare },
      { label: "Finanzas", labelEn: "Finance", href: "/admin/finance", icon: CreditCard },
      { label: "Travel Ops", labelEn: "Travel Ops", href: "/admin/travel", icon: PlaneTakeoff },
      { label: "Reportes", labelEn: "Reports", href: "/admin/reports", icon: BarChart2 },
      { label: "Field Ops", labelEn: "Field Ops", href: "/admin/field-ops", icon: Wrench, section: "Operaciones" },
      { label: "Config", labelEn: "Settings", href: "/admin/settings", icon: Settings },
      { label: "HTML Canvas", labelEn: "HTML Canvas", href: "/admin/html-in-canvas", icon: Layers, section: "Lab" },
      { label: "SEMSE Tools", labelEn: "SEMSE Tools", href: "/tools", icon: Wrench, section: "Lab" },
      { label: "Agentes", labelEn: "Agents", href: "/agents", icon: Bot, section: "IA" },
      { label: "Coordinator", labelEn: "Coordinator", href: "/admin/coordinator", icon: GitBranch },
      { label: "Métricas LLM", labelEn: "LLM Metrics", href: "/admin/llm-metrics", icon: BarChart2 },
      { label: "AI Mission Control", labelEn: "AI Mission Control", href: "/admin/ai-mission-control", icon: Activity },
      { label: "PMO Automatizado", labelEn: "PMO Dashboard", href: "/admin/pmo", icon: BarChart2 },
      { label: "SEMSE_X", labelEn: "SEMSE_X", href: "/admin/semse-x", icon: Infinity },
      { label: "Agent Memory", labelEn: "Agent Memory", href: "/admin/memory", icon: Brain },
      { label: "Prometeo RAG", labelEn: "Prometeo RAG", href: "/admin/prometeo", icon: BookOpen },
    ],
  },
};

const COPY: Record<LanguagePreference, Record<string, string>> = {
  es: {
    signOut: "Salir",
    language: "Idioma",
    theme: "Tema",
    dark: "Oscuro",
    light: "Claro",
    notifications: "Notificaciones",
  },
  en: {
    signOut: "Sign out",
    language: "Language",
    theme: "Theme",
    dark: "Dark",
    light: "Light",
    notifications: "Notifications",
  },
};

function navLabel(role: NavRole, language: LanguagePreference) {
  return language === "en" ? NAV[role].labelEn : NAV[role].label;
}

function itemLabel(item: NavItem, language: LanguagePreference) {
  return language === "en" ? item.labelEn ?? item.label : item.label;
}

function Sidebar({
  role,
  collapsed,
  onToggle,
  onClose,
  mobile,
  language,
}: {
  role: NavRole;
  collapsed: boolean;
  onToggle: () => void;
  onClose?: () => void;
  mobile?: boolean;
  language: LanguagePreference;
}) {
  const pathname = usePathname();
  const nav = NAV[role];
  const RoleIcon = nav.icon;
  const copy = COPY[language];

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
              <p style={{ fontSize: "10px", color: nav.color, fontWeight: 600 }}>{navLabel(role, language)}</p>
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
          const label = itemLabel(item, language);

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
            {copy.signOut}
          </Link>
        </div>
      )}
    </aside>
  );
}

function Topbar({
  title,
  onMenuOpen,
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: {
  title?: string;
  onMenuOpen: () => void;
  language: LanguagePreference;
  theme: ThemePreference;
  onLanguageChange: (value: LanguagePreference) => void;
  onThemeChange: (value: ThemePreference) => void;
}) {
  const copy = COPY[language];

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
          <span>{copy.language}</span>
          <select value={language} onChange={(event) => onLanguageChange(event.target.value as LanguagePreference)} style={toolbarSelectStyle()}>
            <option value="es">ES</option>
            <option value="en">EN</option>
          </select>
        </label>
        <label style={toolbarLabelStyle()}>
          <span>{copy.theme}</span>
          <select value={theme} onChange={(event) => onThemeChange(event.target.value as ThemePreference)} style={toolbarSelectStyle()}>
            <option value="dark">{copy.dark}</option>
            <option value="light">{copy.light}</option>
          </select>
        </label>
        <button
          title={copy.notifications}
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
  const [language, setLanguage] = useState<LanguagePreference>("es");
  const nav = NAV[role];
  const RoleIcon = nav.icon;
  const copy = COPY[language];

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("semse-theme");
    const savedLanguage = window.localStorage.getItem("semse-language");

    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    }
    if (savedLanguage === "es" || savedLanguage === "en") {
      setLanguage(savedLanguage);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("semse-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("semse-language", language);
  }, [language]);

  const shellNavItems = useMemo(
    () =>
      nav.items.map((item) => {
        const Icon = item.icon;
        const active = (pathname ?? "").startsWith(item.href);
        const label = itemLabel(item, language);

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
    [nav.items, pathname, collapsed, language],
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
                  <p style={{ fontSize: "10px", color: nav.color, fontWeight: 600 }}>{navLabel(role, language)}</p>
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
                {copy.signOut}
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
            <Sidebar role={role} collapsed={false} onToggle={() => {}} onClose={() => setMobileOpen(false)} mobile language={language} />
          </div>
        </>
      ) : null}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar
          onMenuOpen={() => setMobileOpen(true)}
          language={language}
          theme={theme}
          onLanguageChange={setLanguage}
          onThemeChange={setTheme}
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
    <AgentPanelStateProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
      <AgentChatPanel />
      <AdminOnlyBanner />
    </AgentPanelStateProvider>
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
