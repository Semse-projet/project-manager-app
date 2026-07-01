"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { LanguageProvider, useLanguage, type LanguagePreference } from "../../lib/language-context";
import { buildShellNavItems, NAV_REGISTRY, type NavRole, type ShellNavItem, type ShellNavLink } from "../../lib/navigation-shell";
import { AgentChatPanel } from "../../components/ai/agent-chat-panel";
import { AgentPanelStateProvider } from "../../components/ai/agent-panel-state";
import { MissionControlAlertBanner } from "../../components/ai/mission-control-alert-banner";
import { NotificationBell } from "../../components/semse/NotificationBell";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell } from "@semse/ui";
import {
  Briefcase,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutDashboard,
  LogOut,
  Menu,
  Store,
  X,
} from "lucide-react";

type ThemePreference = "dark" | "light";

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
  const nav = NAV_REGISTRY[role];
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
              <RoleIcon size={15} color="#ecfffb" />
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
            <RoleIcon size={15} color="#ecfffb" />
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
  const nav = NAV_REGISTRY[role];
  const RoleIcon = nav.icon;

  useState(() => {
    if (typeof window === "undefined") return;
    const savedTheme = window.localStorage.getItem("semse-theme");
    if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
  });

  const handleCollapsedChange = (next: boolean) => {
    setCollapsed(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("semse-sidebar-collapsed", String(next));
    }
  };

  const handleThemeChange = (value: ThemePreference) => {
    setTheme(value);
    document.documentElement.dataset.theme = value;
    window.localStorage.setItem("semse-theme", value);
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
      role === "admin"
        ? shellNavModel.map((group) => {
            const navGroup = group as unknown as { key: string; label: string; items: ShellNavLink[] };
            return {
              key: navGroup.key,
              label: navGroup.label,
              node: (
                <div className="space-y-2">
                  {!collapsed ? (
                    <div className="px-3 pt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      {navGroup.label}
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    {navGroup.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={`${item.href}-${item.labelKey}`}
                          href={item.href}
                          title={collapsed ? item.label : undefined}
                          className={[
                            "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors",
                            item.active ? "bg-blue-300/10 text-[color:var(--ink)]" : "text-slate-400 hover:bg-blue-300/5 hover:text-[color:var(--ink)]",
                          ].join(" ")}
                        >
                          <span className="flex h-5 w-5 items-center justify-center">
                            <Icon size={16} />
                          </span>
                          {!collapsed ? <span className="truncate">{item.label}</span> : null}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ),
            };
          })
        : shellNavModel.map((item) => {
            const navItem = item as ShellNavLink;
            const Icon = navItem.icon;
            return {
              key: navItem.key,
              label: navItem.label,
              active: navItem.active,
              node: (
                <Link
                  href={navItem.href}
                  title={collapsed ? navItem.label : undefined}
                  className={[
                    "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors",
                    navItem.active ? "bg-blue-300/10 text-[color:var(--ink)]" : "text-slate-400 hover:bg-blue-300/5 hover:text-[color:var(--ink)]",
                  ].join(" ")}
                >
                  <span className="flex h-5 w-5 items-center justify-center">
                    <Icon size={16} />
                  </span>
                  {!collapsed ? <span className="truncate">{navItem.label}</span> : null}
                </Link>
              ),
            };
          }),
    [shellNavModel, role, collapsed],
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
                <RoleIcon size={15} color="#ecfffb" />
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
          onCollapsedChange={handleCollapsedChange}
          sidebarFooter={
            !collapsed ? (
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
