import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, GripVertical, ListTodo } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const COLUMNS = [
  { id: "backlog" as const, label: "Backlog", color: "bg-slate-500" },
  { id: "todo" as const, label: "Por Hacer", color: "bg-blue-500" },
  { id: "in_progress" as const, label: "En Progreso", color: "bg-amber-500" },
  { id: "review" as const, label: "Revisión", color: "bg-violet-500" },
  { id: "done" as const, label: "Completado", color: "bg-emerald-500" },
];

const PRIORITIES = [
  { value: "low" as const, label: "Baja", color: "text-slate-500" },
  { value: "medium" as const, label: "Media", color: "text-blue-500" },
  { value: "high" as const, label: "Alta", color: "text-amber-500" },
  { value: "urgent" as const, label: "Urgente", color: "text-red-500" },
];

export default function TasksPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "", description: "",
    status: "todo" as "backlog" | "todo" | "in_progress" | "review" | "done",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
  });

  const utils = trpc.useUtils();
  const { data: tasks } = trpc.tasks.list.useQuery();

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      utils.dashboard.stats.invalidate();
      setCreateOpen(false);
      setNewTask({ title: "", description: "", status: "todo", priority: "medium" });
      toast.success("Tarea creada");
    },
  });

  const updateMutation = trpc.tasks.update.useMutation({
    onMutate: async (newData) => {
      await utils.tasks.list.cancel();
      const prev = utils.tasks.list.getData();
      utils.tasks.list.setData(undefined, (old) =>
        old?.map(t => t.id === newData.id ? { ...t, ...newData } : t)
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.tasks.list.setData(undefined, context.prev);
    },
    onSettled: () => utils.tasks.list.invalidate(),
  });

  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("Tarea eliminada");
    },
  });

  const tasksByColumn = useMemo(() => {
    const map: Record<string, typeof tasks> = {};
    COLUMNS.forEach(c => { map[c.id] = []; });
    tasks?.forEach(t => {
      if (map[t.status]) map[t.status]!.push(t);
    });
    return map;
  }, [tasks]);

  const moveTask = (taskId: number, newStatus: "backlog" | "todo" | "in_progress" | "review" | "done") => {
    updateMutation.mutate({ id: taskId, status: newStatus });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tareas</h1>
          <p className="text-muted-foreground mt-1">Gestiona tus tareas con tablero Kanban</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nueva Tarea</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Crear Tarea</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (!newTask.title.trim()) return; createMutation.mutate(newTask); }} className="space-y-4">
              <Input placeholder="Título de la tarea" value={newTask.title} onChange={(e) => setNewTask(t => ({ ...t, title: e.target.value }))} required />
              <Textarea placeholder="Descripción (opcional)" value={newTask.description} onChange={(e) => setNewTask(t => ({ ...t, description: e.target.value }))} rows={3} />
              <div className="grid grid-cols-2 gap-3">
                <Select value={newTask.status} onValueChange={(v: any) => setNewTask(t => ({ ...t, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={newTask.priority} onValueChange={(v: any) => setNewTask(t => ({ ...t, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>Crear Tarea</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(column => (
          <div key={column.id} className="min-w-[280px] flex-1">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className={`h-2.5 w-2.5 rounded-full ${column.color}`} />
              <h3 className="text-sm font-semibold">{column.label}</h3>
              <Badge variant="secondary" className="text-xs ml-auto">
                {tasksByColumn[column.id]?.length ?? 0}
              </Badge>
            </div>
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-2 pr-2">
                {(!tasksByColumn[column.id] || tasksByColumn[column.id]!.length === 0) ? (
                  <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground text-xs">
                    <ListTodo className="h-5 w-5 mx-auto mb-1 opacity-30" />
                    Sin tareas
                  </div>
                ) : (
                  tasksByColumn[column.id]!.map(task => {
                    const priority = PRIORITIES.find(p => p.value === task.priority);
                    return (
                      <Card key={task.id} className="border-border/50 group">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 cursor-grab" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{task.title}</p>
                              {task.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={`text-xs ${priority?.color}`}>
                                  {priority?.label}
                                </Badge>
                                <Select
                                  value={task.status}
                                  onValueChange={(v: any) => moveTask(task.id, v)}
                                >
                                  <SelectTrigger className="h-6 text-xs w-auto border-none bg-transparent p-0 shadow-none">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <Button
                              variant="ghost" size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive shrink-0"
                              onClick={() => deleteMutation.mutate({ id: task.id })}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>
    </div>
  );
}
