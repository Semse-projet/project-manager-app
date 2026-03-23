import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History, FolderKanban, FileText, Code2, ListTodo, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const entityIcons: Record<string, any> = {
  project: FolderKanban,
  file: Code2,
  folder: FolderKanban,
  document: FileText,
  task: ListTodo,
  code: Sparkles,
};

const actionLabels: Record<string, string> = {
  created: "Creado",
  updated: "Actualizado",
  deleted: "Eliminado",
  ai_comment: "IA - Comentarios",
};

const actionColors: Record<string, string> = {
  created: "bg-emerald-500/10 text-emerald-500",
  updated: "bg-blue-500/10 text-blue-500",
  deleted: "bg-red-500/10 text-red-500",
  ai_comment: "bg-violet-500/10 text-violet-500",
};

export default function ActivityPage() {
  const { data: activity, isLoading } = trpc.activity.list.useQuery({ limit: 100 });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historial de Actividad</h1>
        <p className="text-muted-foreground mt-1">Registro de todas tus acciones en la plataforma</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : !activity || activity.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Sin actividad registrada</p>
          <p className="text-sm mt-1">Tu historial aparecerá aquí cuando comiences a trabajar</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-1">
            {activity.map((entry) => {
              const Icon = entityIcons[entry.entityType] || History;
              return (
                <div key={entry.id} className="relative flex items-start gap-4 py-3 pl-12">
                  <div className="absolute left-4 top-4 h-5 w-5 rounded-full bg-card border-2 border-primary flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <Card className="flex-1 border-border/50">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{entry.details || `${entry.action} ${entry.entityType}`}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true, locale: es })}
                          </p>
                        </div>
                        <Badge variant="secondary" className={`text-xs shrink-0 ${actionColors[entry.action] || ""}`}>
                          {actionLabels[entry.action] || entry.action}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
