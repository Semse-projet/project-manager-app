"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ChevronRight, Users, ArrowLeft, Plus, Minus, RefreshCw, Tag } from "lucide-react";
import { farmTabs } from "../../farm-tabs";

interface AnimalGroup {
  id: string;
  name: string;
  species?: string;
  breed?: string;
  count: number;
  status: "ACTIVE" | "INACTIVE" | "SOLD" | "CULLED";
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

interface TimelineEvent {
  id?: string;
  type: string;
  description?: string;
  meta?: Record<string, unknown>;
  occurredAt: string;
  createdByUserId?: string;
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:   "#6ee7b7",
  INACTIVE: "#94a3b8",
  SOLD:     "#fcd34d",
  CULLED:   "#fca5a5",
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE:   "Activo",
  INACTIVE: "Inactivo",
  SOLD:     "Vendido",
  CULLED:   "Descartado",
};
const STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "SOLD", "CULLED"] as const;

export default function GroupDetailPage() {
  const { farmId, groupId } = useParams<{ farmId: string; groupId: string }>();
  const pathname = usePathname();
  const [group, setGroup] = useState<AnimalGroup | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Adjust count
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Status change
  const [newStatus, setNewStatus] = useState<string>("");
  const [statusReason, setStatusReason] = useState("");
  const [changingStatus, setChangingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => { if (groupId) void load(); }, [groupId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [gr, tr] = await Promise.all([
        fetch(`/api/semse/agro/animal-groups/${groupId}`),
        fetch(`/api/semse/agro/animal-groups/${groupId}/timeline`),
      ]);
      const gj = await gr.json();
      if (!gr.ok) throw new Error(gj?.error?.message ?? "Error");
      const g: AnimalGroup = (gj.data as any)?.group ?? gj.data;
      setGroup(g);
      setNewStatus(g.status);
      if (tr.ok) {
        const tj = await tr.json();
        setEvents((tj.data as any)?.events ?? []);
      }
    } catch (err: any) { setError(err?.message ?? "Error"); }
    finally { setLoading(false); }
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    const delta = parseInt(adjustDelta, 10);
    if (isNaN(delta) || delta === 0) return;
    setAdjusting(true); setAdjustError(null);
    try {
      const res = await fetch(`/api/semse/agro/animal-groups/${groupId}/adjust-count`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ delta, reason: adjustReason.trim() || undefined }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j?.error?.message ?? "Error"); }
      setAdjustDelta(""); setAdjustReason("");
      void load();
    } catch (err: any) { setAdjustError(err?.message); } finally { setAdjusting(false); }
  }

  async function handleStatus(e: React.FormEvent) {
    e.preventDefault();
    setChangingStatus(true); setStatusError(null);
    try {
      const res = await fetch(`/api/semse/agro/animal-groups/${groupId}/status`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus, reason: statusReason.trim() || undefined }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j?.error?.message ?? "Error"); }
      setStatusReason("");
      void load();
    } catch (err: any) { setStatusError(err?.message); } finally { setChangingStatus(false); }
  }

  const tabs = farmId ? farmTabs(farmId) : [];
  const color = group ? (STATUS_COLOR[group.status] ?? "#94a3b8") : "#94a3b8";

  return (
    <div className="agro-shell">
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}/groups`}>Grupos</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>{group?.name ?? "Detalle"}</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Link href={`/agro/${farmId}/groups`} style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 4, fontSize: 12, textDecoration: "none" }}>
          <ArrowLeft size={13} /> Grupos
        </Link>
      </div>

      <nav className="tab-bar">
        {tabs.map(tab => (
          <Link key={tab.href} href={tab.href} className="tab-item"
            data-active={pathname?.startsWith(`/agro/${farmId}/groups`) ? tab.href === `/agro/${farmId}/groups` ? "true" : "false" : pathname === tab.href ? "true" : "false"}
          >{tab.label}</Link>
        ))}
      </nav>

      {error && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="skel" style={{ height: 100 }} />
          <div className="skel" style={{ height: 140 }} />
        </div>
      ) : group && (
        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 340px" }}>

          {/* Left: group info + timeline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Header card */}
            <div style={{
              borderRadius: 14, border: "1px solid var(--border)", borderTop: `4px solid ${color}`,
              background: "var(--surface)", padding: "20px 22px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Users size={20} color={color} />
                </div>
                <div>
                  <h1 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.02em" }}>{group.name}</h1>
                  <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {[group.species, group.breed].filter(Boolean).join(" · ") || "Sin clasificar"}
                  </p>
                </div>
                <span className={`badge badge-${group.status === "ACTIVE" ? "green" : group.status === "SOLD" ? "amber" : "red"}`} style={{ marginLeft: "auto" }}>
                  {STATUS_LABEL[group.status] ?? group.status}
                </span>
              </div>

              <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1 }}>{group.count}</p>
                  <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>cabezas</p>
                </div>
                {group.notes && (
                  <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, flex: 1 }}>{group.notes}</p>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
                Historial ({events.length})
              </p>
              {events.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "var(--faint)", fontSize: 13 }}>
                  Sin eventos registrados
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {events.map((ev, i) => (
                    <div key={ev.id ?? i} style={{
                      borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)",
                      padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start",
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6ee7b7", marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{ev.type}</p>
                        {ev.description && <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>{ev.description}</p>}
                      </div>
                      <span style={{ fontSize: 11, color: "var(--faint)", flexShrink: 0 }}>
                        {new Date(ev.occurredAt).toLocaleDateString("es-MX")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: actions panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Adjust count */}
            <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "16px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={11} /> Ajustar conteo
              </p>
              {adjustError && <div className="alert-banner alert-critical" style={{ marginBottom: 12, fontSize: 12 }}>{adjustError}</div>}
              <form onSubmit={e => void handleAdjust(e)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label className="fl">Delta (+ agregar / - retirar)</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => setAdjustDelta(prev => String((parseInt(prev || "0", 10) - 1)))}
                      style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Minus size={12} />
                    </button>
                    <input className="fi" type="number" value={adjustDelta}
                      onChange={e => setAdjustDelta(e.target.value)}
                      style={{ textAlign: "center", flex: 1 }} placeholder="0" />
                    <button type="button" onClick={() => setAdjustDelta(prev => String((parseInt(prev || "0", 10) + 1)))}
                      style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="fl">Motivo (opcional)</label>
                  <input className="fi" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Compra, venta, muerte…" />
                </div>
                <button type="submit" className="btn-accent" disabled={adjusting || !adjustDelta || adjustDelta === "0"} style={{ width: "100%" }}>
                  {adjusting ? "Aplicando…" : "Aplicar ajuste"}
                </button>
              </form>
            </div>

            {/* Change status */}
            <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "16px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Tag size={11} /> Cambiar estado
              </p>
              {statusError && <div className="alert-banner alert-critical" style={{ marginBottom: 12, fontSize: 12 }}>{statusError}</div>}
              <form onSubmit={e => void handleStatus(e)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label className="fl">Estado</label>
                  <select className="fi" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="fl">Motivo (opcional)</label>
                  <input className="fi" value={statusReason} onChange={e => setStatusReason(e.target.value)} placeholder="Ej. Vendido en feria…" />
                </div>
                <button type="submit" className="btn-ghost" disabled={changingStatus || newStatus === group.status} style={{ width: "100%" }}>
                  {changingStatus ? "Aplicando…" : "Cambiar estado"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
