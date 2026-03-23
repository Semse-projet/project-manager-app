import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderKanban, FileText, ListTodo, Code2, Sparkles,
  Plus, ArrowRight, Clock, Activity
} from "lucide-react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: activity, isLoading: activityLoading } = trpc.dashboard.recentActivity.useQuery();
  const { data: recentProjects } = trpc.projects.list.useQuery();

  const statCards = [
    { label: "Proyectos", value: stats?.projectCount ?? 0, icon: FolderKanban, color: "text-blue-500", path: "/projects" },
    { label: "Archivos", value: stats?.fileCount ?? 0, icon: Code2, color: "text-emerald-500", path: "/projects" },
    { label: "Documentos", value: stats?.documentCount ?? 0, icon: FileText, color: "text-violet-500", path: "/documents" },
    { label: "Tareas Pendientes", value: stats?.pendingTasks ?? 0, icon: ListTodo, color: "text-amber-500", path: "/tasks" },
  ];

  const quickActions = [
    { label: "Nuevo Proyecto", icon: FolderKanban, action: () => setLocation("/projects") },
    { label: "Nuevo Documento", icon: FileText, action: () => setLocation("/documents") },
    { label: "Asistente IA", icon: Sparkles, action: () => setLocation("/ai") },
    { label: "Nueva Tarea", icon: ListTodo, action: () => setLocation("/tasks") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Bienvenido, {user?.name?.split(" ")[0] || "Developer"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Tu centro de desarrollo y documentación inteligente
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card
            key={stat.label}
            className="cursor-pointer hover:shadow-md transition-shadow border-border/50"
            onClick={() => setLocation(stat.path)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    {stat.label}
                  </p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  )}
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Acciones Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="ghost"
                className="w-full justify-start h-10 text-sm"
                onClick={action.action}
              >
                <action.icon className="h-4 w-4 mr-3 text-muted-foreground" />
                {action.label}
                <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Recent Projects */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" />
              Proyectos Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!recentProjects || recentProjects.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No hay proyectos aún</p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1"
                  onClick={() => setLocation("/projects")}
                >
                  Crear primer proyecto
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentProjects.slice(0, 5).map((project) => (
                  <button
                    key={project.id}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors text-left"
                    onClick={() => setLocation(`/projects/${project.id}`)}
                  >
                    <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Code2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {project.language || "General"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !activity || activity.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Sin actividad reciente</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activity.slice(0, 6).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 py-1.5">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{entry.details || entry.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(entry.createdAt), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
