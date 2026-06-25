"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Task {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueAt?: string;
  assignedToId?: string;
  blockReason?: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:     "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED:   "bg-green-100 text-green-700",
  BLOCKED:     "bg-red-100 text-red-700",
  CANCELLED:   "bg-gray-100 text-gray-400",
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW:    "text-gray-400",
  MEDIUM: "text-blue-500",
  HIGH:   "text-amber-500",
  URGENT: "text-red-600 font-semibold",
};

const TASK_TYPES = ["FEEDING","VACCINATION","TREATMENT","WEIGHING","MOVEMENT","CLEANING","INSPECTION","INVENTORY","SALE","WATER_CHECK","OTHER"];
const PRIORITIES = ["LOW","MEDIUM","HIGH","URGENT"];

export default function TasksPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const [tasks, setTasks]   = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<string>("ALL");

  type ModalType =
    | { type: "create" }
    | { type: "block"; task: Task }
    | { type: "cancel"; task: Task };
  const [modal, setModal]         = useState<ModalType | null>(null);
  const [busy, setBusy]           = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // create form
  const [newTitle, setNewTitle]       = useState("");
  const [newType, setNewType]         = useState("FEEDING");
  const [newPriority, setNewPriority] = useState("MEDIUM");
  const [newDue, setNewDue]           = useState("");

  // block/cancel reason
  const [reason, setReason] = useState("");

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/tasks`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      setTasks((json.data as any)?.tasks ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Error cargando tareas");
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter === "ALL" ? tasks : tasks.filter((t) => t.status === filter);

  function closeModal() { setModal(null); setFormError(null); setBusy(false); setReason(""); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: newTitle, type: newType, priority: newPriority,
          dueAt: newDue || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setNewTitle(""); setNewType("FEEDING"); setNewPriority("MEDIUM"); setNewDue("");
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function taskAction(taskId: string, action: "start" | "complete" | "block" | "cancel", body?: object) {
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/tasks/${taskId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-6 flex items-center gap-2 text-xs text-[var(--muted)]">
        <Link href="/agro" className="hover:text-[var(--accent)]">Agro</Link>
        <span>/</span>
        <Link href={`/agro/${farmId}`} className="hover:text-[var(--accent)]">Finca</Link>
        <span>/</span>
        <span className="text-[var(--ink)]">Tareas</span>
      </nav>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--ink)]">Tareas operativas</h1>
        <button onClick={() => setModal({ type: "create" })}
          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
          + Nueva tarea
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {["ALL","PENDING","IN_PROGRESS","BLOCKED","COMPLETED","CANCELLED"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filter === s ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:bg-[var(--surface)]"}`}>
            {s === "ALL" ? "Todas" : s}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm text-[var(--muted)]">Cargando...</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No hay tareas con este filtro.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <div key={task.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--ink)]">{task.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {task.type}
                    {task.dueAt && ` · vence ${new Date(task.dueAt).toLocaleDateString("es-MX")}`}
                    {task.blockReason && ` · bloqueado: ${task.blockReason}`}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className={`text-xs ${PRIORITY_STYLES[task.priority] ?? ""}`}>{task.priority}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[task.status] ?? ""}`}>{task.status}</span>
                </div>
              </div>
              {/* Actions */}
              <div className="mt-3 flex gap-2">
                {task.status === "PENDING" && (
                  <button onClick={() => taskAction(task.id, "start")} disabled={busy}
                    className="rounded-lg border border-blue-200 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50">
                    Iniciar
                  </button>
                )}
                {task.status === "IN_PROGRESS" && (
                  <button onClick={() => taskAction(task.id, "complete")} disabled={busy}
                    className="rounded-lg border border-green-200 px-2 py-1 text-xs text-green-600 hover:bg-green-50 disabled:opacity-50">
                    Completar
                  </button>
                )}
                {(task.status === "PENDING" || task.status === "IN_PROGRESS") && (
                  <>
                    <button onClick={() => { setReason(""); setModal({ type: "block", task }); }}
                      className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                      Bloquear
                    </button>
                    <button onClick={() => { setReason(""); setModal({ type: "cancel", task }); }}
                      className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface)]">
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={closeModal}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>

            {modal.type === "create" && (
              <>
                <h2 className="mb-4 text-base font-semibold">Nueva tarea</h2>
                <form onSubmit={handleCreate} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Título *</label>
                    <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required autoFocus
                      placeholder="Ej. Vacunación lote norte"
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Tipo *</label>
                    <select value={newType} onChange={(e) => setNewType(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                      {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Prioridad</label>
                    <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Fecha límite</label>
                    <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  {formError && <p className="text-xs text-red-600">{formError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-[var(--border)] py-2 text-sm">Cancelar</button>
                    <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm text-white disabled:opacity-50">
                      {busy ? "Guardando..." : "Crear"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {(modal.type === "block" || modal.type === "cancel") && (
              <>
                <h2 className="mb-1 text-base font-semibold">
                  {modal.type === "block" ? "Bloquear tarea" : "Cancelar tarea"}
                </h2>
                <p className="mb-4 text-xs text-[var(--muted)]">{modal.task.title}</p>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Razón (opcional)</label>
                    <input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
                      placeholder="¿Por qué?"
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  {formError && <p className="text-xs text-red-600">{formError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-[var(--border)] py-2 text-sm">Cancelar</button>
                    <button
                      onClick={() => taskAction(modal.task.id, modal.type as "block" | "cancel", { reason: reason || undefined })}
                      disabled={busy}
                      className={`flex-1 rounded-lg py-2 text-sm text-white disabled:opacity-50 ${modal.type === "block" ? "bg-red-500" : "bg-gray-500"}`}>
                      {busy ? "..." : modal.type === "block" ? "Bloquear" : "Cancelar tarea"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
