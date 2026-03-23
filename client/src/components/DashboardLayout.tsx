import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard, FolderKanban, Code2, FileText, ListTodo,
  Sparkles, Settings, History, Bell, LogOut, PanelLeft, Moon, Sun,
  Database, Hammer, Atom, Search, User
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", group: "principal" },
  { icon: FolderKanban, label: "Proyectos", path: "/projects", group: "principal" },
  { icon: FileText, label: "Documentos", path: "/documents", group: "principal" },
  { icon: ListTodo, label: "Tareas", path: "/tasks", group: "principal" },
  { icon: Sparkles, label: "Asistente IA", path: "/ai", group: "principal" },
  { icon: History, label: "Actividad", path: "/activity", group: "principal" },
  { icon: Bell, label: "Notificaciones", path: "/notifications", group: "principal" },
  { icon: Database, label: "RAG Tools", path: "/rag-tools", group: "avanzado" },
  { icon: Hammer, label: "SEMSE OS", path: "/semse", group: "avanzado" },
  { icon: Atom, label: "Ecosistema Prometeo", path: "/prometeo", group: "avanzado" },
  { icon: Settings, label: "Configuración", path: "/settings", group: "config" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 flex flex-col items-center gap-8 p-8 max-w-lg w-full"
        >
          <div className="flex flex-col items-center gap-5">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20"
            >
              <Code2 className="h-8 w-8 text-white" />
            </motion.div>
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">WebAssistant Portal</h1>
              <p className="text-sm text-muted-foreground max-w-sm">
                Plataforma integral de desarrollo y documentación de código con inteligencia artificial generativa.
              </p>
            </div>
          </div>

          <div className="w-full space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { icon: Code2, label: "Editor de Código", desc: "Multi-lenguaje" },
                { icon: Sparkles, label: "IA Generativa", desc: "Comentarios & Docs" },
                { icon: FileText, label: "Live Docs", desc: "Tiempo real" },
              ].map(({ icon: Icon, label, desc }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="p-3 rounded-xl bg-muted/50 border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <Icon className="h-5 w-5 mx-auto mb-1.5 text-primary" />
                  <p className="text-xs font-medium">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </motion.div>
              ))}
            </div>

            <Button
              onClick={() => { window.location.href = getLoginUrl(); }}
              size="lg"
              className="w-full shadow-lg hover:shadow-xl transition-all h-12 text-base bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
            >
              Iniciar sesión
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Autenticación segura con Manus OAuth
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item =>
    item.path === "/" ? location === "/" : location.startsWith(item.path)
  );
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();

  // Notification count
  const { data: notifications } = trpc.activity.list.useQuery(
    { limit: 20 },
    { enabled: !!user }
  );
  const unreadCount = notifications?.filter(n => {
    const hourAgo = new Date(Date.now() - 3600000);
    return new Date(n.createdAt) > hourAgo;
  }).length || 0;

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const principalItems = menuItems.filter(i => i.group === "principal");
  const avanzadoItems = menuItems.filter(i => i.group === "avanzado");
  const configItems = menuItems.filter(i => i.group === "config");

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shrink-0">
                    <Code2 className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="font-semibold tracking-tight truncate text-sm">
                    WebAssistant
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {/* Search hint */}
            {!isCollapsed && (
              <div className="px-3 py-2">
                <button
                  onClick={() => {
                    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-xs text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span className="flex-1 text-left">Buscar...</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">⌘K</kbd>
                </button>
              </div>
            )}

            {/* Principal section */}
            <SidebarMenu className="px-2 py-1">
              {!isCollapsed && (
                <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
                  Principal
                </p>
              )}
              {principalItems.map(item => {
                const isActive = item.path === "/"
                  ? location === "/"
                  : location.startsWith(item.path);
                const isNotif = item.path === "/notifications";
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-9 transition-all font-normal"
                    >
                      <div className="relative">
                        <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                        {isNotif && unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        )}
                      </div>
                      <span className="flex-1">{item.label}</span>
                      {isNotif && unreadCount > 0 && !isCollapsed && (
                        <Badge variant="destructive" className="h-5 min-w-5 px-1 text-[10px] justify-center">
                          {unreadCount}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* Advanced section */}
            <SidebarMenu className="px-2 py-1 mt-2">
              {!isCollapsed && (
                <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
                  Avanzado
                </p>
              )}
              {avanzadoItems.map(item => {
                const isActive = location.startsWith(item.path);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-9 transition-all font-normal"
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* Config section */}
            <SidebarMenu className="px-2 py-1 mt-2">
              {!isCollapsed && (
                <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
                  Sistema
                </p>
              )}
              {configItems.map(item => {
                const isActive = location.startsWith(item.path);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-9 transition-all font-normal"
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 space-y-2">
            {!isCollapsed && toggleTheme && (
              <button
                onClick={toggleTheme}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50 transition-colors w-full text-left text-sm text-muted-foreground"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span>{theme === "dark" ? "Tema claro" : "Tema oscuro"}</span>
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "Usuario"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setLocation("/profile")} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Mi Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/settings")} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configuración</span>
                </DropdownMenuItem>
                {isCollapsed && toggleTheme && (
                  <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                    {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                    <span>{theme === "dark" ? "Tema claro" : "Tema oscuro"}</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (isCollapsed) return; setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {/* Top header bar */}
        <div className="flex border-b h-12 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
          <div className="flex items-center gap-2">
            {isMobile && <SidebarTrigger className="h-8 w-8 rounded-lg" />}
            <span className="tracking-tight text-foreground font-medium text-sm">
              {activeMenuItem?.label ?? "Menu"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
              }}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors text-muted-foreground"
              title="Buscar (⌘K)"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLocation("/notifications")}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors text-muted-foreground relative"
              title="Notificaciones"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </button>
          </div>
        </div>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
