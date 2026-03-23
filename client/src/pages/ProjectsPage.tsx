import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban, Plus, Code2, MoreVertical, Archive, Trash2, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

const LANGUAGES = ["JavaScript", "TypeScript", "Python", "Java", "C++", "Rust", "Go", "PHP", "Ruby", "SQL", "HTML/CSS", "Other"];

export default function ProjectsPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "", language: "" });

  const utils = trpc.useUtils();
  const { data: projects, isLoading } = trpc.projects.list.useQuery();
  const createMutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      utils.dashboard.stats.invalidate();
      setDialogOpen(false);
      setNewProject({ name: "", description: "", language: "" });
      toast.success("Proyecto creado exitosamente");
    },
  });
  const updateMutation = trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      utils.dashboard.stats.invalidate();
    },
  });

  const filtered = projects?.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proyectos</h1>
          <p className="text-muted-foreground mt-1">Gestiona tus proyectos de desarrollo</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuevo Proyecto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Proyecto</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newProject.name.trim()) return;
                createMutation.mutate(newProject);
              }}
            >
              <Input
                placeholder="Nombre del proyecto"
                value={newProject.name}
                onChange={(e) => setNewProject(p => ({ ...p, name: e.target.value }))}
                required
              />
              <Textarea
                placeholder="Descripción (opcional)"
                value={newProject.description}
                onChange={(e) => setNewProject(p => ({ ...p, description: e.target.value }))}
                rows={3}
              />
              <Select
                value={newProject.language}
                onValueChange={(v) => setNewProject(p => ({ ...p, language: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Lenguaje principal" /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creando..." : "Crear Proyecto"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar proyectos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No hay proyectos</p>
          <p className="text-sm mt-1">Crea tu primer proyecto para comenzar</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(project => (
            <Card
              key={project.id}
              className="cursor-pointer hover:shadow-md transition-all border-border/50 group"
              onClick={() => setLocation(`/projects/${project.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Code2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{project.name}</h3>
                      {project.language && (
                        <Badge variant="secondary" className="mt-1 text-xs">{project.language}</Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: project.id, status: "archived" }); toast.success("Proyecto archivado"); }}>
                        <Archive className="mr-2 h-4 w-4" />Archivar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: project.id, status: "deleted" }); toast.success("Proyecto eliminado"); }}>
                        <Trash2 className="mr-2 h-4 w-4" />Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {project.description && (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{project.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-3">
                  Actualizado {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true, locale: es })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
