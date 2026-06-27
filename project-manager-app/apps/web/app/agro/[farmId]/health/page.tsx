"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  Plus, X, Heart, ChevronRight, Syringe, Stethoscope, ShieldCheck,
  AlertTriangle, CheckCircle2, Clock, Calendar,
} from "lucide-react";

interface HealthTask {
  id: string; title: string; type: string; status: string;
  priority: string; dueAt?: string; notes?: string; completedAt?: string;
}

const HEALTH_TYPES = ["VACCINATION","TREATMENT","INSPECTION"];
const TYPE_LABEL: Record<string, string> = {
  VACCINATION: "Vacunación",
  TREATMENT:   "Tratamiento",
  INSPECTION:  "Inspección",
};
const TYPE_ICON: Record<string, typeof Syringe> = {
  VACCINATION: Syringe,
  TREATMENT:   Stethoscope,
  INSPECTION:  ShieldCheck,
};
const TYPE_COLOR: Record<string, string> = {
  VACCINATION: "#6ee7b7",
  TREATMENT:   "#fca5a5",
  INSPECTION:  "#93c5fd",
};
const TYPE_BG: Record<string, string> = {
  VACCINATION: "rgba(16,185,129,.14)",
  TREATMENT:   "rgba(239,68,68,.14)",
  INSPECTION:  "rgba(59,130,246,.14)",
};
const TYPE_BADGE: Record<string, string> = {
  VACCINATION: "badge badge-green",
  TREATMENT:   "badge badge-red",
  INSPECTION:  "badge badge-blue",
};
const STATUS_BADGE: Record<string, string> = {
  PENDING:     "badge badge-slate",
  IN_PROGRESS: "badge badge-blue",
  COMPLETED:   "badge badge-green",
  BLOCKED:     "badge badge-red",
  CANCELLED:   "badge badge-slate",
};
const PRIORITIES = ["LOW","MEDIUM","HIGH","URGENT"];
const PRIORITY_BADGE: Record<string, string> = {
  LOW:    "badge badge-slate",
  MEDIUM: "badge badge-blue",
  HIGH:   "badge badge-amber",
  URGENT: "badge badge-red",
};
const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function farmTabs(farmId: string) {
  return [
    { href: `/agro/${farmId}`,               label: "Dashboard"       },
    { href: `/agro/${farmId}/animals`,        label: "Animales"        },
    { href: `/agro/${farmId}/tasks`,          label: "Tareas"          },
    { href: `/agro/${farmId}/calendar`,       label: "Calendario"      },
    { href: `/agro/${farmId}/feeding`,        label: "Alimentación"    },
    { href: `/agro/${farmId}/health`,         label: "Salud"           },
    { href: `/agro/${farmId}/inventory`,      label: "Inventario"      },
    { href: `/agro/${farmId}/costs`,          label: "Costos"          },
    { href: `/agro/${farmId}/analytics`,      label: "Analítica"       },
    { href: `/agro/${farmId}/reproduction`,   label: "Reproducción"    },
    { href: `/agro/${farmId}/infrastructure`, label: "Infraestructura" },
    { href: `/agro/${farmId}/evidence`,       label: "Evidencia"       },
    { href: `/agro/${farmId}/audit`,          label: "Auditoría"       },
  ];
}

export default function HealthPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const pathname   = usePathname();
  const [tasks, setTasks]     = useState<HealthTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<"ALL" | string>("ALL");
  const [tab, setTab]         = useState<"list" | "calendar">("list");

  const [showModal, setShowModal]   = useState(false);
  const [busy, setBusy]             = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [newType, setNewType]       = useState("VACCINATION");
  const [newTitle, setNewTitle]     = useState("");
  const [newPriority, setNewPriority] = useState("MEDIUM");
  const [newDue, setNewDue]         = useState("");
  const [newNotes, setNewNotes]     = useState("");

  const tabs = farmId ? farmTabs(farmId) : [];

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/semse/agro/farms/${farmId}/tasks`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      const all: HealthTask[] = (json.data as any)?.tasks ?? [];
      setTasks(all.filter(t => HEALTH_TYPES.includes(t.type)));
    } catch (err: any) { setError(err?.message ?? "Error"); }
    finally { setLoading(false); }
  }

  function closeModal() {
    setShowModal(false); setFormError(null); setBusy(false);
    setNewTitle(""); setNewDue(""); setNewNotes("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); if (!newTitle.trim()) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/tasks`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(), type: newType,
          priority: newPriority,
          dueAt: newDue || undefined,
          notes: newNotes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function complete(taskId: string) {
    try {
      await fetch(`/api/semse/agro/tasks/${taskId}/start`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      await fetch(`/api/semse/agro/tasks/${taskId}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      void load();
    } catch { /* best-effort */ }
  }

  const now     = new Date();
  const in30    = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  const overdue = tasks.filter(t => t.dueAt && new Date(t.dueAt) < now && !["COMPLETED","CANCELLED"].includes(t.status));
  const upcoming = tasks.filter(t => t.dueAt && new Date(t.dueAt) >= now && new Date(t.dueAt) <= in30 && !["COMPLETED","CANCELLED"].includes(t.status));
  const completed = tasks.filter(t => t.status === "COMPLETED");

  const filtered = filter === "ALL" ? tasks : tasks.filter(t => t.type === filter);

  // Stats by type
  const stats = HEALTH_TYPES.reduce<Record<string, { total: number; pending: number; done: number }>>((acc, t) => {
    const byType = tasks.filter(x => x.type === t);
    acc[t] = { total: byType.length, pending: byType.filter(x => !["COMPLETED","CANCELLED"].includes(x.status)).length, done: byType.filter(x => x.status === "COMPLETED").length };
    return acc;
  }, {});

  // Calendar - current month
  const [calYear, setCalYear]   = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selDay, setSelDay]     = useState<number | null>(null);
  const firstDow  = new Date(calYear, calMonth, 1).getDay();
  const daysCount = new Date(calYear, calMonth + 1, 0).getDate();

  function tasksOnDay(day: number) {
    return tasks.filter(t => {
      if (!t.dueAt) return false;
      const d = new Date(t.dueAt);
      return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === day;
    });
  }
  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1);
    setSelDay(null);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1);
    setSelDay(null);
  }

  const selTasks = selDay != null ? tasksOnDay(selDay) : [];
  const DOW_ES   = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

  return (
    <div className="agro-shell">
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>Salud Animal</span>
      </nav>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Salud Animal</h1>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>Vacunaciones, tratamientos e inspecciones</p>
        </div>
        <button className="btn-accent" onClick={() => setShowModal(true)}>
          <Plus size={13} /> Nuevo evento
        </button>
      </div>

      <nav className="tab-bar">
        {tabs.map(t => (
          <Link key={t.href} href={t.href} className="tab-item"
            data-active={pathname === t.href ? "true" : "false"}>{t.label}</Link>
        ))}
      </nav>

      {error && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Alerts */}
      {!loading && overdue.length > 0 && (
        <div className="alert-banner alert-critical" style={{ marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Eventos vencidos: {overdue.length}</strong>
            <p style={{ fontSize: 12, marginTop: 2, opacity: 0.85 }}>
              {overdue.slice(0, 2).map(t => t.title).join(", ")}{overdue.length > 2 ? ` y ${overdue.length - 2} más` : ""}
            </p>
          </div>
        </div>
      )}
      {!loading && upcoming.length > 0 && (
        <div className="alert-banner alert-warning" style={{ marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Clock size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{upcoming.length} evento{upcoming.length !== 1 ? "s" : ""} programado{upcoming.length !== 1 ? "s" : ""} en los próximos 30 días</span>
        </div>
      )}

      {/* Stats strip */}
      {!loading && tasks.length > 0 && (
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(3,1fr)", marginBottom: 20 }}>
          {HEALTH_TYPES.map(type => {
            const Icon  = TYPE_ICON[type] ?? Heart;
            const color = TYPE_COLOR[type];
            const bg    = TYPE_BG[type];
            const s     = stats[type];
            return (
              <button key={type}
                onClick={() => setFilter(filter === type ? "ALL" : type)}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${filter === type ? color : "var(--border)"}`,
                  background: filter === type ? bg : "var(--surface)",
                  padding: "12px 14px", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                }}>
                <Icon size={14} color={color} style={{ marginBottom: 6 }} />
                <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                  {TYPE_LABEL[type]}
                </p>
                <p style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 4 }}>
                  {s?.total ?? 0}
                </p>
                <p style={{ fontSize: 10, color: "var(--muted)" }}>
                  {s?.done ?? 0} completados · {s?.pending ?? 0} pendientes
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Sub-tab: list / calendar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {(["list","calendar"] as const).map(t => (
          <button key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: "1px solid var(--border)", cursor: "pointer", fontFamily: "inherit",
              background: tab === t ? "var(--brand)" : "var(--surface)",
              color:      tab === t ? "#fff"         : "var(--muted)",
              transition: "all 120ms",
            }}>
            {t === "list" ? "Lista" : "Calendario"}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="skel" style={{ height: 72 }} />)}
        </div>
      ) : tab === "calendar" ? (

        /* Calendar view */
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 280px" }}>
          <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <button onClick={prevMonth} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: "4px 8px", borderRadius: 6, fontSize: 18 }}>‹</button>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{MONTHS_ES[calMonth]} {calYear}</span>
              <button onClick={nextMonth} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: "4px 8px", borderRadius: 6, fontSize: 18 }}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 6 }}>
              {DOW_ES.map(d => <div key={d} style={{ fontSize: 10, fontWeight: 700, color: "var(--faint)", textAlign: "center", textTransform: "uppercase" }}>{d}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
              {Array.from({ length: firstDow }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysCount }, (_, i) => i + 1).map(day => {
                const dt     = tasksOnDay(day);
                const isToday = day === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();
                const isSel  = selDay === day;
                const hasOver = dt.some(t => !["COMPLETED","CANCELLED"].includes(t.status) && t.dueAt && new Date(t.dueAt) < now);
                return (
                  <button key={day} onClick={() => setSelDay(day === selDay ? null : day)}
                    style={{
                      border: "none", borderRadius: 8, padding: "6px 2px", cursor: "pointer",
                      background: isSel ? "var(--brand)" : isToday ? "rgba(59,130,246,.12)" : "transparent",
                      fontFamily: "inherit",
                    }}>
                    <span style={{ display: "block", fontSize: 12, fontWeight: isToday || isSel ? 700 : 400, color: isSel ? "#fff" : isToday ? "#93c5fd" : "var(--ink)" }}>{day}</span>
                    {dt.length > 0 && (
                      <div style={{ display: "flex", gap: 1, justifyContent: "center", marginTop: 2 }}>
                        {dt.slice(0, 3).map(t => (
                          <span key={t.id} style={{ width: 5, height: 5, borderRadius: "50%", display: "block",
                            background: isSel ? "#fff" : (TYPE_COLOR[t.type] ?? "#94a3b8") }} />
                        ))}
                        {hasOver && !isSel && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fca5a5", display: "block" }} />}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
              {HEALTH_TYPES.map(type => (
                <div key={type} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: TYPE_COLOR[type], display: "block" }} />
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>{TYPE_LABEL[type]}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "20px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
              {selDay != null ? `${selDay} de ${MONTHS_ES[calMonth]}` : "Selecciona un día"}
            </h3>
            {selTasks.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--muted)" }}>{selDay != null ? "Sin eventos" : "Haz clic en un día para ver los eventos."}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selTasks.map(t => {
                  const Icon = TYPE_ICON[t.type] ?? Heart;
                  const color = TYPE_COLOR[t.type] ?? "#94a3b8";
                  return (
                    <div key={t.id} style={{ borderRadius: 8, border: "1px solid var(--border)", padding: "10px 12px", borderLeft: `3px solid ${color}` }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <Icon size={12} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>{t.title}</p>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            <span className={TYPE_BADGE[t.type] ?? "badge badge-slate"}>{TYPE_LABEL[t.type] ?? t.type}</span>
                            <span className={STATUS_BADGE[t.status] ?? "badge badge-slate"}>{t.status}</span>
                          </div>
                        </div>
                        {t.status === "PENDING" && (
                          <button onClick={() => void complete(t.id)}
                            style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                            ✓
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      ) : filtered.length === 0 ? (

        /* Empty state */
        <div className="empty-state">
          <Heart size={36} className="empty-icon" />
          <p className="empty-title">{filter === "ALL" ? "Sin eventos de salud" : `Sin ${TYPE_LABEL[filter] ?? filter}`}</p>
          <p className="empty-desc">Registra vacunaciones, tratamientos e inspecciones para llevar un control sanitario completo.</p>
          {filter === "ALL" && <button className="btn-accent" onClick={() => setShowModal(true)}><Plus size={13} /> Primer evento</button>}
        </div>

      ) : (

        /* Task list */
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(t => {
            const Icon    = TYPE_ICON[t.type] ?? Heart;
            const color   = TYPE_COLOR[t.type] ?? "#94a3b8";
            const bg      = TYPE_BG[t.type]    ?? "rgba(148,163,184,.1)";
            const isOver  = t.dueAt && new Date(t.dueAt) < now && !["COMPLETED","CANCELLED"].includes(t.status);
            const isDone  = t.status === "COMPLETED";
            return (
              <div key={t.id} style={{
                borderRadius: 12,
                border: `1px solid ${isOver ? "rgba(239,68,68,.3)" : isDone ? "rgba(16,185,129,.2)" : "var(--border)"}`,
                borderLeft: `3px solid ${color}`,
                background: isOver ? "rgba(239,68,68,.04)" : isDone ? "rgba(16,185,129,.04)" : "var(--surface)",
                padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 14,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: isDone ? "rgba(16,185,129,.15)" : bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {isDone
                    ? <CheckCircle2 size={18} color="#6ee7b7" />
                    : <Icon size={18} color={color} />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: isDone ? "var(--muted)" : "var(--ink)", marginBottom: 4, textDecoration: isDone ? "line-through" : "none" }}>
                    {t.title}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
                    <span className={TYPE_BADGE[t.type] ?? "badge badge-slate"}>{TYPE_LABEL[t.type] ?? t.type}</span>
                    <span className={STATUS_BADGE[t.status] ?? "badge badge-slate"}>{t.status.replace("_"," ")}</span>
                    <span className={PRIORITY_BADGE[t.priority] ?? "badge badge-slate"}>{t.priority}</span>
                    {t.dueAt && (
                      <span style={{ fontSize: 11, color: isOver ? "#fca5a5" : "var(--muted)" }}>
                        {isOver ? "⚠ " : "📅 "}{new Date(t.dueAt).toLocaleDateString("es-CO")}
                      </span>
                    )}
                    {t.completedAt && (
                      <span style={{ fontSize: 11, color: "#6ee7b7" }}>
                        ✓ {new Date(t.completedAt).toLocaleDateString("es-CO")}
                      </span>
                    )}
                  </div>
                  {t.notes && <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 4, lineHeight: 1.4 }}>{t.notes}</p>}
                </div>
                {t.status === "PENDING" && (
                  <button
                    onClick={() => void complete(t.id)}
                    className="btn-ghost"
                    style={{ flexShrink: 0, whiteSpace: "nowrap", fontSize: 11 }}>
                    <CheckCircle2 size={13} /> Completar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Nuevo evento de salud</h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex" }}><X size={16} /></button>
            </div>
            {formError && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{formError}</div>}
            <form onSubmit={e => void handleCreate(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="fl">Tipo *</label>
                <select className="fi" value={newType} onChange={e => setNewType(e.target.value)}>
                  {HEALTH_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </div>
              <div><label className="fl">Descripción *</label><input className="fi" value={newTitle} onChange={e => setNewTitle(e.target.value)} required autoFocus placeholder={newType === "VACCINATION" ? "Ej. Vacuna aftosa lote A" : newType === "TREATMENT" ? "Ej. Tratamiento antibiótico vaca #12" : "Ej. Revisión sanitaria mensual"} /></div>
              <div>
                <label className="fl">Prioridad</label>
                <select className="fi" value={newPriority} onChange={e => setNewPriority(e.target.value)}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div><label className="fl">Fecha programada</label><input className="fi" type="date" value={newDue} onChange={e => setNewDue(e.target.value)} /></div>
              <div><label className="fl">Notas</label><textarea className="fi" rows={2} value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Observaciones, medicamento, dosis..." style={{ resize: "none" }} /></div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" className="btn-accent" disabled={busy} style={{ flex: 1 }}>{busy ? "Guardando…" : "Registrar"}</button>
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
