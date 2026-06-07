"use client";

import { useState, type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface AppShellNavItem {
  key: string;
  label: string;
  href?: string;
  icon?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  node?: ReactNode;
}

export interface AppShellProps {
  brand: ReactNode;
  navItems: AppShellNavItem[];
  headerTitle?: string;
  headerActions?: ReactNode;
  sidebarFooter?: ReactNode;
  children: ReactNode;
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  sidebarClassName?: string;
  contentClassName?: string;
  hideHeader?: boolean;
}

export function AppShell({
  brand,
  navItems,
  headerTitle,
  headerActions,
  sidebarFooter,
  children,
  className,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  sidebarClassName,
  contentClassName,
  hideHeader = false,
}: AppShellProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;

  function setCollapsed(value: boolean) {
    if (controlledCollapsed === undefined) {
      setInternalCollapsed(value);
    }
    onCollapsedChange?.(value);
  }

  return (
    <div className={cn("min-h-screen bg-[#08101a] text-white", className)}>
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "border-r border-white/10 bg-[#0d1220] transition-[width] duration-200",
            collapsed ? "w-20" : "w-64",
            sidebarClassName
          )}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
            <div className={cn("min-w-0", collapsed && "sr-only")}>{brand}</div>
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-xl border border-white/10 px-2 py-1 text-xs text-slate-300"
            >
              {collapsed ? ">" : "<"}
            </button>
          </div>

          <nav className="space-y-1 p-3">
            {navItems.map((item) =>
              item.node ? (
                <div key={item.key}>{item.node}</div>
              ) : (
                <a
                  key={item.key}
                  href={item.href}
                  onClick={item.onClick}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors",
                    item.active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span className="flex h-5 w-5 items-center justify-center">{item.icon}</span>
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </a>
              )
            )}
          </nav>

          {sidebarFooter ? <div className="mt-auto border-t border-white/10 p-3">{sidebarFooter}</div> : null}
        </aside>

        <div className={cn("flex min-h-screen min-w-0 flex-1 flex-col", contentClassName)}>
          {!hideHeader ? (
            <header className="flex items-center justify-between border-b border-white/10 bg-[#0b1320]/80 px-6 py-4 backdrop-blur">
              <div>
                {headerTitle ? <h1 className="text-lg font-bold tracking-[-0.02em]">{headerTitle}</h1> : null}
              </div>
              {headerActions ? <div className="flex items-center gap-3">{headerActions}</div> : null}
            </header>
          ) : null}

          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
