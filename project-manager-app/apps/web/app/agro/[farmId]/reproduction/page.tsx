"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Plus, X, Heart, ChevronRight, Baby, Calendar, Dna } from "lucide-react";
import { farmTabs } from "../farm-tabs";

interface BreedingTask {
  id: string; title: string; type: string; status: string;
  priority: string; dueAt?: string; assignedToId?: string;
  notes?: string;
}

const REPRO_TYPES = ["BREEDING","PREGNANCY_CHECK","BIRTH","WEANING","HEAT_DETECTION"];
const TYPE_LABEL: Record<string, string> = {
  BREEDING:         "Monta / Inseminación",
  PREGNANCY_CHECK:  "Diagnóstico gestación",
  BIRTH:            "Parto / Nacimiento",
  WEANING:          "Destete",
  HEAT_DETECTION:   "Detección de celo",
};
const TYPE_ICON: Record<string, typeof Heart> = {
  BREEDING:        Dna,
  PREGNANCY_CHECK: Calendar,
  BIRTH:           Baby,
  WEANING:         Baby,
  HEAT_DETECTION:  Heart,
};
const TYPE_COLOR: Record<string, string> = {
  BREEDING:        "#c4b5fd",
  PREGNANCY_CHECK: "#93c5fd",
  BIRTH:           "#6ee7b7",
  WEANING:         "#fcd34d",
  HEAT_DETECTION:  "#fca5a5",
};
const TYPE_BADGE: Record<string, string> = {
  BREEDING:        "badge badge-violet",
  PREGNANCY_CHECK: "badge badge-blue",
  BIRTH:           "badge badge-green",
  WEANING:         "badge badge-amber",
  HEAT_DETECTION:  "badge badge-red",
};
const STATUS_BADGE: Record<string, string> = {
  PENDING:     "badge badge-slate",
  IN_PROGRESS: "badge badge-blue",
  COMPLETED:   "badge badge-green",
  BLOCKED:     "badge badge-red",
  CANCELLED:   "badge badge-slate",
};


export default function ReproductionPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const pathname   = usePathname();
  const [tasks, setTasks]     = useState<BreedingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState("ALL");
  const [showModal, setShowModal]   = useState(false);
  const [busy, setBusy]             = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [newTitle, setNewTitle]     = useState("");
  const [newType, setNewType]       = useState("BREEDING");
  const [newDue, setNewDue]         = useState("");
  const [newNotes, setNewNotes]     = useState("");

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/semse/agro/farms/${farmId}/tasks`);
      const json = await res.json();
      const all: BreedingTask[] = (json.data as any)?.tasks ?? [];
      setTasks(all.filter(t => REPRO_TYPES.includes(t.type)));
    } catch (err: any) { setError(err?.message ?? "Error cargando registros"); }
    finally { setLoading(false); }
  }

  function closeModal() { setShowModal(false); setFormError(null); setBusy(false); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); if (!newTitle.trim()) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/tasks`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: newTitle, type: newType, priority: "MEDIUM", dueAt: newDue || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setNewTitle(""); setNewType("BREEDING"); setNewDue(""); setNewNotes("");
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

  const filtered = filter === "ALL" ? tasks : tasks.filter(t => t.type === filter);
  const stats = REPRO_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = tasks.filter(x => x.type === t).length; return acc;
  }, {});
  const tabs = farmId ? farmTabs(farmId) : [];

  return (
    <div className="agro-shell">
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>Reproducción</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Reproducción</h1>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>Montas, gestaciones, partos y destetes</p>
        </div>
        <button className="btn-accent" onClick={() => setShowModal(true)}>
          <Plus size={13} /> Nuevo evento
        </button>
      </div>

      <nav className="tab-bar">
        {tabs.map(tab => (
          <Link key={tab.href} href={tab.href} className="tab-item"
            data-active={pathname === tab.href ? "true" : "false"}>{tab.label}</Link>
        ))}
      </nav>

      {error && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Stats strip */}
      {!loading && tasks.length > 0 && (
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", marginBottom: 20 }}>
          {REPRO_TYPES.map(type => {
            const Icon  = TYPE_ICON[type] ?? Heart;
            const color = TYPE_COLOR[type] ?? "#94a3b8";
            return (
              <button key={type} onClick={() => setFilter(filter === type ? "ALL" : type)}
                style={{
                  borderRadius: 10, border: `1px solid ${filter === type ? color : "var(--border)"}`,
                  background: filter === type ? `rgba(${color === "#c4b5fd" ? "139,92,246" : color === "#93c5fd" ? "59,130,246" : color === "#6ee7b7" ? "16,185,129" : color === "#fcd34d" ? "245,158,11" : "239,68,68"},.12)` : "var(--surface)",
                  padding: "12px 14px", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                }}>
                <Icon size={14} color={color} style={{ marginBottom: 6 }} />
                <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                  {TYPE_LABEL[type]}
                </p>
                <p style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {stats[type] ?? 0}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="skel" style={{ height: 72 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Heart size={36} className="empty-icon" />
          <p className="empty-title">{filter === "ALL" ? "Sin eventos reproductivos" : `Sin ${TYPE_LABEL[filter] ?? filter}`}</p>
          <p className="empty-desc">Registra montas, diagnósticos de gestación, partos y destetes.</p>
          {filter === "ALL" && (
            <button className="btn-accent" onClick={() => setShowModal(true)}>
              <Plus size={13} /> Primer evento
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(task => {
            const Icon  = TYPE_ICON[task.type] ?? Heart;
            const color = TYPE_COLOR[task.type] ?? "#94a3b8";
            const overdue = task.dueAt && task.status !== "COMPLETED" && task.status !== "CANCELLED"
              && new Date(task.dueAt) < new Date();
            return (
              <div key={task.id} style={{
                borderRadius: 12,
                border: `1px solid ${overdue ? "rgba(239,68,68,.25)" : "var(--border)"}`,
                borderLeft: `3px solid ${color}`,
                background: overdue ? "rgba(239,68,68,.04)" : "var(--surface)",
                padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 14,
              }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: `rgba(${color === "#c4b5fd" ? "139,92,246" : color === "#93c5fd" ? "59,130,246" : color === "#6ee7b7" ? "16,185,129" : color === "#fcd34d" ? "245,158,11" : "239,68,68"},.14)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} color={color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>{task.title}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    <span className={TYPE_BADGE[task.type] ?? "badge badge-slate"}>
                      {TYPE_LABEL[task.type] ?? task.type}
                    </span>
                    <span className={STATUS_BADGE[task.status] ?? "badge badge-slate"}>
                      {task.status.replace("_", " ")}
                    </span>
                    {task.dueAt && (
                      <span style={{ fontSize: 11, color: overdue ? "#fca5a5" : "var(--muted)" }}>
                        {new Date(task.dueAt).toLocaleDateString("es-CO")}
                      </span>
                    )}
                  </div>
                </div>
                {task.status === "PENDING" && (
                  <button onClick={() => void complete(task.id)}
                    style={{ fontSize: 11, padding: "4px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    Completar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Nuevo evento reproductivo</h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex" }}><X size={16} /></button>
            </div>
            {formError && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{formError}</div>}
            <form onSubmit={e => void handleCreate(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="fl">Tipo de evento *</label>
                <select className="fi" value={newType} onChange={e => setNewType(e.target.value)}>
                  {REPRO_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
                </select>
              </div>
              <div><label className="fl">Descripción *</label><input className="fi" value={newTitle} onChange={e => setNewTitle(e.target.value)} required autoFocus placeholder="Ej. Monta vaca #12 con toro #03" /></div>
              <div><label className="fl">Fecha</label><input className="fi" type="date" value={newDue} onChange={e => setNewDue(e.target.value)} /></div>
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
