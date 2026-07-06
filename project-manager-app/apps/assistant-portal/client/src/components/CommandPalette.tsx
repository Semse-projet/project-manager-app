import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, FolderKanban, Code2, FileText, ListTodo,
  Sparkles, Settings, History, Bell, Database, Hammer, Atom,
  Search, Moon, Sun, LogOut, User, File
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const navigationItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/", keywords: "inicio home panel" },
  { label: "Proyectos", icon: FolderKanban, path: "/projects", keywords: "proyecto code código" },
  { label: "Documentos", icon: FileText, path: "/documents", keywords: "documento nota texto" },
  { label: "Tareas", icon: ListTodo, path: "/tasks", keywords: "tarea kanban board" },
  { label: "Asistente IA", icon: Sparkles, path: "/ai", keywords: "ia inteligencia artificial chat" },
  { label: "Actividad", icon: History, path: "/activity", keywords: "historial log cambios" },
  { label: "Notificaciones", icon: Bell, path: "/notifications", keywords: "alerta aviso" },
  { label: "RAG Tools", icon: Database, path: "/rag-tools", keywords: "rag visualizer cache hash" },
  { label: "SEMSE OS", icon: Hammer, path: "/semse", keywords: "semse worker client admin" },
  { label: "Ecosistema Prometeo", icon: Atom, path: "/prometeo", keywords: "prometeo matrix adr pipeline" },
  { label: "Configuración", icon: Settings, path: "/settings", keywords: "config preferencias tema" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const { data: projects } = trpc.projects.list.useQuery(undefined, {
    enabled: isAuthenticated && open,
  });
  const { data: documents } = trpc.documents.list.useQuery(undefined, {
    enabled: isAuthenticated && open,
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navigate = useCallback((path: string) => {
    setLocation(path);
    setOpen(false);
  }, [setLocation]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar páginas, proyectos, documentos..." />
      <CommandList>
        <CommandEmpty>No se encontraron resultados.</CommandEmpty>

        <CommandGroup heading="Navegación">
          {navigationItems.map((item) => (
            <CommandItem
              key={item.path}
              value={`${item.label} ${item.keywords}`}
              onSelect={() => navigate(item.path)}
            >
              <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {isAuthenticated && projects && projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Proyectos">
              {projects.slice(0, 8).map((project) => (
                <CommandItem
                  key={`project-${project.id}`}
                  value={`proyecto ${project.name} ${project.language || ""}`}
                  onSelect={() => navigate(`/projects/${project.id}`)}
                >
                  <FolderKanban className="mr-2 h-4 w-4 text-blue-400" />
                  <span>{project.name}</span>
                  {project.language && (
                    <span className="ml-auto text-xs text-muted-foreground">{project.language}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {isAuthenticated && documents && documents.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Documentos">
              {documents.slice(0, 8).map((doc) => (
                <CommandItem
                  key={`doc-${doc.id}`}
                  value={`documento ${doc.title}`}
                  onSelect={() => navigate("/documents")}
                >
                  <File className="mr-2 h-4 w-4 text-violet-400" />
                  <span>{doc.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Acciones">
          <CommandItem
            value="cambiar tema oscuro claro toggle"
            onSelect={() => { toggleTheme?.(); setOpen(false); }}
          >
            {theme === "dark" ? (
              <Sun className="mr-2 h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="mr-2 h-4 w-4 text-blue-400" />
            )}
            <span>Cambiar a tema {theme === "dark" ? "claro" : "oscuro"}</span>
          </CommandItem>
          {isAuthenticated && (
            <CommandItem
              value="cerrar sesión logout salir"
              onSelect={() => { logout(); setOpen(false); }}
            >
              <LogOut className="mr-2 h-4 w-4 text-red-400" />
              <span>Cerrar sesión</span>
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
