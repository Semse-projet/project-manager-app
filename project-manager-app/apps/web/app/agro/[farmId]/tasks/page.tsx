"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Plus, X, Play, CheckCircle2, Ban, XCircle, CheckSquare, ChevronRight } from "lucide-react";

interface Task {
  id: string; title: string; type: string; status: string;
  priority: string; dueAt?: string; assignedToId?: string; blockReason?: string;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING:     "badge badge-slate",
  IN_PROGRESS: "badge badge-blue",
  COMPLETED:   "badge badge-green",
  BLOCKED:     "badge badge-red",
  CANCELLED:   "badge badge-slate",
};
const PRIORITY_BADGE: Record<string, string> = {
  LOW:    "badge badge-slate",
  MEDIUM: "badge badge-blue",
  HIGH:   "badge badge-amber",
  URGENT: "badge badge-red",
};
const TASK_TYPES = ["FEEDING","VACCINATION","TREATMENT","WEIGHING","MOVEMENT","CLEANING","INSPECTION","INVENTORY","SALE","WATER_CHECK","OTHER"];
const PRIORITIES  = ["LOW","MEDIUM","HIGH","URGENT"];
const FILTERS     = ["ALL","PENDING","IN_PROGRESS","BLOCKED","COMPLETED","CANCELLED"];

function farmTabs(farmId: string) {
  return [
    { href: `/agro/${farmId}`,           label: "Dashboard"  },
    { href: `/agro/${farmId}/animals`,   label: "Animales"   },
    { href: `/agro/${farmId}/tasks`,     label: "Tareas"     },
    { href: `/agro/${farmId}/inventory`, label: "Inventario" },
    { href: `/agro/${farmId}/costs`,     label: "Costos"     },
    { href: `/agro/${farmId}/evidence`,  label: "Evidencia"  },
    { href: `/agro/${farmId}/audit`,     label: "Auditoría"  },
  ];
}

export default function TasksPage() {
  const { farmId }  = useParams<{ farmId: string }>();
  const pathname    = usePathname();
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState("ALL");

  type ModalType = { type: "create" } | { type: "block"; task: Task } | { type: "cancel"; task: Task };
  const [modal, setModal]         = useState<ModalType | null>(null);
  const [busy, setBusy]           = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newTitle, setNewTitle]   = useState("");
  const [newType, setNewType]     = useState("FEEDING");
  const [newPriority, setNewPrio] = useState("MEDIUM");
  const [newDue, setNewDue]       = useState("");
  const [reason, setReason]       = useState("");

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/tasks`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      setTasks((json.data as any)?.tasks ?? []);
    } catch (err: any) { setError(err?.message ?? "Error cargando tareas"); }
    finally { setLoading(false); }
  }

  const filtered = filter === "ALL" ? tasks : tasks.filter(t => t.status === filter);
  function closeModal() { setModal(null); setFormError(null); setBusy(false); setReason(""); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); if (!newTitle.trim()) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/tasks`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: newTitle, type: newType, priority: newPriority, dueAt: newDue || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setNewTitle(""); setNewType("FEEDING"); setNewPrio("MEDIUM"); setNewDue("");
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function taskAction(taskId: string, action: "start" | "complete" | "block" | "cancel", body?: object) {
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/tasks/${taskId}/${action}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); setBusy(false); }
  }

  const tabs = farmId ? farmTabs(farmId) : [];

  return (
    <div className="agro-shell">
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>Tareas</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Tareas operativas</h1>
        <button className="btn-accent" onClick={() => setModal({ type: "create" })}>
          <Plus size={13} /> Nueva tarea
        </button>
      </div>

      <nav className="tab-bar">
        {tabs.map(tab => (
          <Link key={tab.href} href={tab.href} className="tab-item"
            data-active={pathname === tab.href ? "true" : "false"}>
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* Filter strip */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {FILTERS.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{
              padding: "4px 12px", borderRadius: 999, border: "1px solid",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit",
              background: filter === s ? "var(--brand)" : "transparent",
              color: filter === s ? "#fff" : "var(--muted)",
              borderColor: filter === s ? "var(--brand)" : "var(--border)",
              transition: "all 120ms",
            }}
          >
            {s === "ALL" ? "Todas" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      {error && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="skel" style={{ height: 72 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <CheckSquare size={36} className="empty-icon" />
          <p className="empty-title">{filter === "ALL" ? "Sin tareas registradas" : `Sin tareas ${filter}`}</p>
          <p className="empty-desc">Crea tareas para planificar vacunaciones, pesajes, alimentación y más.</p>
          {filter === "ALL" && (
            <button className="btn-accent" onClick={() => setModal({ type: "create" })}>
              <Plus size={13} /> Nueva tarea
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(task => {
            const overdue = task.dueAt && task.status !== "COMPLETED" && task.status !== "CANCELLED"
              && new Date(task.dueAt) < new Date();
            return (
              <div key={task.id} style={{
                borderRadius: 12,
                border: `1px solid ${overdue ? "rgba(239,68,68,.25)" : "var(--border)"}`,
                background: overdue ? "rgba(239,68,68,.04)" : "var(--surface)",
                padding: "14px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>{task.title}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "var(--faint)" }}>{task.type.replace(/_/g, " ")}</span>
                      {task.dueAt && (
                        <span style={{ fontSize: 11, color: overdue ? "#fca5a5" : "var(--muted)" }}>
                          · {overdue ? "vencida " : "vence "}{new Date(task.dueAt).toLocaleDateString("es-CO")}
                        </span>
                      )}
                      {task.blockReason && (
                        <span style={{ fontSize: 11, color: "#fca5a5" }}>· {task.blockReason}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span className={PRIORITY_BADGE[task.priority] ?? "badge badge-slate"}>
                      {task.priority}
                    </span>
                    <span className={STATUS_BADGE[task.status] ?? "badge badge-slate"}>
                      {task.status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                  {task.status === "PENDING" && (
                    <button onClick={() => void taskAction(task.id, "start")} disabled={busy}
                      className="btn-primary" style={{ fontSize: 11, padding: "4px 12px" }}>
                      <Play size={11} /> Iniciar
                    </button>
                  )}
                  {task.status === "IN_PROGRESS" && (
                    <button onClick={() => void taskAction(task.id, "complete")} disabled={busy}
                      className="btn-primary" style={{ fontSize: 11, padding: "4px 12px", background: "var(--ok)" }}>
                      <CheckCircle2 size={11} /> Completar
                    </button>
                  )}
                  {(task.status === "PENDING" || task.status === "IN_PROGRESS") && (
                    <>
                      <button onClick={() => { setReason(""); setModal({ type: "block", task }); }}
                        className="btn-danger" style={{ fontSize: 11, padding: "4px 12px" }}>
                        <Ban size={11} /> Bloquear
                      </button>
                      <button onClick={() => { setReason(""); setModal({ type: "cancel", task }); }}
                        className="btn-ghost" style={{ fontSize: 11, padding: "4px 12px" }}>
                        <XCircle size={11} /> Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>
                {modal.type === "create" ? "Nueva tarea"
                  : modal.type === "block" ? "Bloquear tarea"
                  : "Cancelar tarea"}
              </h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}>
                <X size={16} />
              </button>
            </div>

            {formError && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{formError}</div>}

            {modal.type === "create" && (
              <form onSubmit={e => void handleCreate(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><label className="fl">Título *</label><input className="fi" value={newTitle} onChange={e => setNewTitle(e.target.value)} required autoFocus placeholder="Ej. Vacunación lote norte" /></div>
                <div><label className="fl">Tipo *</label><select className="fi" value={newType} onChange={e => setNewType(e.target.value)}>{TASK_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                <div><label className="fl">Prioridad</label><select className="fi" value={newPriority} onChange={e => setNewPrio(e.target.value)}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div>
                <div><label className="fl">Fecha límite</label><input className="fi" type="date" value={newDue} onChange={e => setNewDue(e.target.value)} /></div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" className="btn-accent" disabled={busy} style={{ flex: 1 }}>{busy ? "Guardando…" : "Crear tarea"}</button>
                  <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
                </div>
              </form>
            )}

            {(modal.type === "block" || modal.type === "cancel") && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -8 }}>{modal.task.title}</p>
                <div><label className="fl">Razón (opcional)</label><input className="fi" value={reason} onChange={e => setReason(e.target.value)} autoFocus placeholder="¿Por qué?" /></div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => void taskAction(modal.task.id, modal.type as "block" | "cancel", { reason: reason || undefined })}
                    disabled={busy}
                    className={modal.type === "block" ? "btn-danger" : "btn-ghost"}
                    style={{ flex: 1 }}
                  >
                    {busy ? "…" : modal.type === "block" ? "Bloquear" : "Cancelar tarea"}
                  </button>
                  <button type="button" className="btn-ghost" onClick={closeModal}>Atrás</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
