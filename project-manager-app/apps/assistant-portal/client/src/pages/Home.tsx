import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/PageTransition";
import {
  FolderKanban, FileText, ListTodo, Code2, Sparkles,
  Plus, ArrowRight, Clock, Activity, Database, Hammer,
  Zap, Brain, Terminal, ChevronRight, Atom
} from "lucide-react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: activity, isLoading: activityLoading } = trpc.dashboard.recentActivity.useQuery();
  const { data: recentProjects } = trpc.projects.list.useQuery();

  const statCards = [
    { label: "Proyectos", value: stats?.projectCount ?? 0, icon: FolderKanban, color: "text-blue-400", bgColor: "bg-blue-500/10", path: "/projects" },
    { label: "Archivos", value: stats?.fileCount ?? 0, icon: Code2, color: "text-emerald-400", bgColor: "bg-emerald-500/10", path: "/projects" },
    { label: "Documentos", value: stats?.documentCount ?? 0, icon: FileText, color: "text-violet-400", bgColor: "bg-violet-500/10", path: "/documents" },
    { label: "Tareas Pendientes", value: stats?.pendingTasks ?? 0, icon: ListTodo, color: "text-amber-400", bgColor: "bg-amber-500/10", path: "/tasks" },
  ];

  const quickActions = [
    { label: "Nuevo Proyecto", description: "Crea un proyecto de código", icon: FolderKanban, color: "text-blue-400", action: () => setLocation("/projects") },
    { label: "Nuevo Documento", description: "Editor de texto enriquecido", icon: FileText, color: "text-violet-400", action: () => setLocation("/documents") },
    { label: "Asistente IA", description: "Chat con IA generativa", icon: Sparkles, color: "text-pink-400", action: () => setLocation("/ai") },
    { label: "Nueva Tarea", description: "Gestiona tu trabajo", icon: ListTodo, color: "text-amber-400", action: () => setLocation("/tasks") },
  ];

  const toolCards = [
    {
      title: "RAG Architect Tools",
      description: "Herramientas interactivas para construir sistemas RAG",
      icon: Database,
      color: "from-blue-500/20 to-purple-500/20",
      borderColor: "border-blue-500/30",
      badges: ["Flujo RAG", "Caché", "Hash", "Session State"],
      path: "/rag-tools",
    },
    {
      title: "SEMSE OS",
      description: "Sistema de gestión de proyectos de construcción",
      icon: Hammer,
      color: "from-amber-500/20 to-orange-500/20",
      borderColor: "border-amber-500/30",
      badges: ["Worker", "Client", "Admin", "Prometeo"],
      path: "/semse",
    },
    {
      title: "Ecosistema Prometeo",
      description: "Arquitectura integral: 83+ módulos, IA, cuántico, RAG",
      icon: Atom,
      color: "from-violet-500/20 to-pink-500/20",
      borderColor: "border-violet-500/30",
      badges: ["Knowledge Matrix", "ADRs", "RAG Pipeline", "Evolución"],
      path: "/prometeo",
    },
  ];

  return (
    <PageTransition className="space-y-6">
      {/* Welcome Hero */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-primary/5 via-background to-purple-500/5 p-4 sm:p-6"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
              <Zap className="w-3 h-3 mr-1" />
              IA Generativa
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-3">
            Bienvenido, {user?.name?.split(" ")[0] || "Developer"}
          </h1>
          <p className="text-muted-foreground mt-1 max-w-lg text-sm">
            Tu centro de desarrollo y documentación inteligente. Gestiona proyectos, genera documentación con IA y colabora eficientemente.
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-4">
            <Button size="sm" onClick={() => setLocation("/projects")}>
              <Plus className="w-4 h-4 mr-2" />Nuevo Proyecto
            </Button>
            <Button size="sm" variant="outline" onClick={() => setLocation("/ai")}>
              <Brain className="w-4 h-4 mr-2" />Asistente IA
            </Button>
          </div>
        </div>
        <div className="absolute top-4 right-4 opacity-5 hidden sm:block">
          <Terminal className="w-32 h-32" />
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        variants={stagger}
        initial="initial"
        animate="animate"
      >
        {statCards.map((stat) => (
          <motion.div key={stat.label} variants={fadeUp}>
            <Card
              className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30 border-border/50"
              onClick={() => setLocation(stat.path)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      {stat.label}
                    </p>
                    {statsLoading ? (
                      <Skeleton className="h-7 w-12 mt-1" />
                    ) : (
                      <p className="text-xl sm:text-2xl font-bold mt-1">{stat.value}</p>
                    )}
                  </div>
                  <div className={`p-2 sm:p-2.5 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Tool Cards - RAG, SEMSE & Prometeo */}
      <motion.div
        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
        variants={stagger}
        initial="initial"
        animate="animate"
      >
        {toolCards.map((tool) => (
          <motion.div key={tool.title} variants={fadeUp}>
            <Card
              className={`cursor-pointer hover:shadow-lg transition-all ${tool.borderColor} overflow-hidden group`}
              onClick={() => setLocation(tool.path)}
            >
              <div className={`bg-gradient-to-r ${tool.color} p-4 sm:p-5`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-background/50 backdrop-blur-sm shrink-0">
                      <tool.icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base truncate">{tool.title}</h3>
                      <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {tool.badges.map((badge) => (
                    <Badge key={badge} variant="outline" className="text-[10px] sm:text-xs bg-background/30 backdrop-blur-sm border-border/50">
                      {badge}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Quick Actions */}
        <motion.div variants={fadeUp} initial="initial" animate="animate">
          <Card className="border-border/50 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Acciones Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors text-left group"
                  onClick={action.action}
                >
                  <div className="p-1.5 rounded-md bg-muted group-hover:bg-muted/80 transition-colors">
                    <action.icon className={`h-4 w-4 ${action.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </button>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Projects */}
        <motion.div variants={fadeUp} initial="initial" animate="animate">
          <Card className="border-border/50 h-full">
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
                  <Button variant="link" size="sm" className="mt-1" onClick={() => setLocation("/projects")}>
                    Crear primer proyecto
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentProjects.slice(0, 5).map((project) => (
                    <button
                      key={project.id}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors text-left group"
                      onClick={() => setLocation(`/projects/${project.id}`)}
                    >
                      <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Code2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{project.name}</p>
                        <p className="text-xs text-muted-foreground">{project.language || "General"}</p>
                      </div>
                      <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={fadeUp} initial="initial" animate="animate">
          <Card className="border-border/50 h-full">
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
                <div className="space-y-1">
                  {activity.slice(0, 6).map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 p-1.5 rounded-lg">
                      <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{entry.details || entry.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true, locale: es })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </PageTransition>
  );
}
