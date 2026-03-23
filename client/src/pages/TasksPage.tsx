import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, GripVertical, ListTodo, Clock, AlertTriangle, CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { useState, useMemo, useRef, DragEvent } from "react";
import { toast } from "sonner";

const COLUMNS = [
  { id: "backlog" as const, label: "Backlog", color: "bg-slate-500", icon: Circle },
  { id: "todo" as const, label: "Por Hacer", color: "bg-blue-500", icon: Clock },
  { id: "in_progress" as const, label: "En Progreso", color: "bg-amber-500", icon: ArrowRight },
  { id: "review" as const, label: "Revisión", color: "bg-violet-500", icon: AlertTriangle },
  { id: "done" as const, label: "Completado", color: "bg-emerald-500", icon: CheckCircle2 },
];

type ColumnId = "backlog" | "todo" | "in_progress" | "review" | "done";

const PRIORITIES = [
  { value: "low" as const, label: "Baja", color: "text-slate-400", bgColor: "bg-slate-500/10 border-slate-500/20" },
  { value: "medium" as const, label: "Media", color: "text-blue-400", bgColor: "bg-blue-500/10 border-blue-500/20" },
  { value: "high" as const, label: "Alta", color: "text-amber-400", bgColor: "bg-amber-500/10 border-amber-500/20" },
  { value: "urgent" as const, label: "Urgente", color: "text-red-400", bgColor: "bg-red-500/10 border-red-500/20" },
];

export default function TasksPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "", description: "",
    status: "todo" as ColumnId,
    priority: "medium" as "low" | "medium" | "high" | "urgent",
  });
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dragCounter = useRef<Record<string, number>>({});

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
      toast.error("Error al mover tarea");
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

  // Drag and Drop handlers
  const handleDragStart = (e: DragEvent, taskId: number) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId.toString());
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: DragEvent) => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
    dragCounter.current = {};
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  };

  const handleDragEnter = (e: DragEvent, columnId: string) => {
    e.preventDefault();
    dragCounter.current[columnId] = (dragCounter.current[columnId] || 0) + 1;
    setDragOverColumn(columnId);
  };

  const handleDragLeave = (_e: DragEvent, columnId: string) => {
    dragCounter.current[columnId] = (dragCounter.current[columnId] || 0) - 1;
    if (dragCounter.current[columnId] <= 0) {
      dragCounter.current[columnId] = 0;
      if (dragOverColumn === columnId) {
        setDragOverColumn(null);
      }
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: DragEvent, columnId: ColumnId) => {
    e.preventDefault();
    setDragOverColumn(null);
    dragCounter.current = {};
    const taskId = parseInt(e.dataTransfer.getData("text/plain"));
    if (!isNaN(taskId)) {
      const task = tasks?.find(t => t.id === taskId);
      if (task && task.status !== columnId) {
        updateMutation.mutate({ id: taskId, status: columnId });
        const col = COLUMNS.find(c => c.id === columnId);
        toast.success(`Tarea movida a "${col?.label}"`);
      }
    }
  };

  const totalTasks = tasks?.length ?? 0;
  const doneTasks = tasksByColumn["done"]?.length ?? 0;
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <PageTransition className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tareas</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-muted-foreground">Gestiona tus tareas con tablero Kanban</p>
            {totalTasks > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{progressPercent}%</span>
              </div>
            )}
          </div>
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
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creando..." : "Crear Tarea"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(column => {
          const ColIcon = column.icon;
          const isOver = dragOverColumn === column.id;
          return (
            <div
              key={column.id}
              className="min-w-[280px] flex-1"
              onDragEnter={(e) => handleDragEnter(e, column.id)}
              onDragLeave={(e) => handleDragLeave(e, column.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`h-2.5 w-2.5 rounded-full ${column.color}`} />
                <ColIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{column.label}</h3>
                <Badge variant="secondary" className="text-xs ml-auto">
                  {tasksByColumn[column.id]?.length ?? 0}
                </Badge>
              </div>
              <div
                className={`rounded-xl border-2 border-dashed transition-all duration-200 min-h-[200px] ${
                  isOver
                    ? "border-primary/50 bg-primary/5 scale-[1.02]"
                    : "border-transparent"
                }`}
              >
                <ScrollArea className="h-[calc(100vh-16rem)]">
                  <div className="space-y-2 p-1">
                    {(!tasksByColumn[column.id] || tasksByColumn[column.id]!.length === 0) ? (
                      <div className={`border border-dashed rounded-lg p-6 text-center text-muted-foreground text-xs transition-all ${
                        isOver ? "border-primary/30 bg-primary/5" : ""
                      }`}>
                        <ListTodo className="h-5 w-5 mx-auto mb-1 opacity-30" />
                        {isOver ? "Soltar aquí" : "Sin tareas"}
                      </div>
                    ) : (
                      tasksByColumn[column.id]!.map(task => {
                        const priority = PRIORITIES.find(p => p.value === task.priority);
                        const isDragging = draggedTaskId === task.id;
                        return (
                          <Card
                            key={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDragEnd={handleDragEnd}
                            className={`border-border/50 group cursor-grab active:cursor-grabbing transition-all duration-200 ${
                              isDragging ? "opacity-50 scale-95 rotate-1" : "hover:shadow-md hover:border-primary/20"
                            }`}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0 opacity-30 group-hover:opacity-100 transition-opacity" />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                                    {task.title}
                                  </p>
                                  {task.description && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline" className={`text-xs border ${priority?.bgColor}`}>
                                      {priority?.label}
                                    </Badge>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive shrink-0 transition-opacity"
                                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ id: task.id }); }}
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
            </div>
          );
        })}
      </div>
    </PageTransition>
  );
}
