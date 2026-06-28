"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Leaf, MapPin, ChevronRight, X, Tractor, Wheat, Blend, Users, ClipboardList, AlertTriangle } from "lucide-react";

interface AgroFarm {
  id: string;
  name: string;
  operationType: "LIVESTOCK" | "MIXED" | "CROP";
  locationLabel?: string;
  createdAt: string;
}

interface FarmDash {
  totalAnimals?: number;
  animalGroups?: number;
  pendingTasks?: number;
  overdueTasks?: number;
  lowStockItems?: number;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  return (json as { data: T }).data;
}

const OP_TYPE: Record<string, { label: string; color: string; bg: string; Icon: typeof Leaf }> = {
  LIVESTOCK: { label: "Ganadería",  color: "#6ee7b7", bg: "rgba(16,185,129,.12)",  Icon: Tractor },
  MIXED:     { label: "Mixta",      color: "#93c5fd", bg: "rgba(59,130,246,.12)",   Icon: Blend   },
  CROP:      { label: "Cultivos",   color: "#fcd34d", bg: "rgba(245,158,11,.12)",   Icon: Wheat   },
};

function FarmCardSkeleton() {
  return (
    <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: 20 }}>
      <div className="skel" style={{ height: 14, width: "60%", marginBottom: 10 }} />
      <div className="skel" style={{ height: 10, width: "35%" }} />
    </div>
  );
}

export default function AgroPage() {
  const [farms, setFarms]         = useState<AgroFarm[]>([]);
  const [dashes, setDashes]       = useState<Record<string, FarmDash>>({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating]   = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName]           = useState("");
  const [operationType, setType]  = useState<"LIVESTOCK" | "MIXED" | "CROP">("LIVESTOCK");
  const [locationLabel, setLocation] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true); setError(null);
    try {
      const { farms: list } = await apiFetch<{ farms: AgroFarm[] }>("/api/semse/agro/farms");
      setFarms(list);
      setLoading(false);
      // Load dashboards in background
      await Promise.all(list.map(async (farm) => {
        try {
          const res  = await fetch(`/api/semse/agro/farms/${farm.id}/dashboard`);
          const json = await res.json();
          const stats: FarmDash = res.ok ? ((json.data as any)?.stats ?? json.data ?? {}) : {};
          setDashes(prev => ({ ...prev, [farm.id]: stats }));
        } catch { /* silent */ }
      }));
    } catch (err: any) { setError(err?.message ?? "Error cargando fincas"); setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true); setFormError(null);
    try {
      await apiFetch("/api/semse/agro/farms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), operationType, locationLabel: locationLabel.trim() || undefined }),
      });
      setShowModal(false); setName(""); setLocation("");
      await load();
    } catch (err: any) { setFormError(err?.message ?? "Error creando finca"); }
    finally { setCreating(false); }
  }

  // Aggregate KPIs
  const dashValues = Object.values(dashes);
  const hasAnyDash = dashValues.length > 0;
  const totalAnimals  = dashValues.reduce((s, d) => s + (d.totalAnimals  ?? 0), 0);
  const totalTasks    = dashValues.reduce((s, d) => s + (d.pendingTasks  ?? 0), 0);
  const totalOverdue  = dashValues.reduce((s, d) => s + (d.overdueTasks  ?? 0), 0);
  const totalGroups   = dashValues.reduce((s, d) => s + (d.animalGroups  ?? 0), 0);

  return (
    <div className="agro-shell">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(16,185,129,.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Leaf size={18} color="#6ee7b7" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>SEMSE Agro</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Gestión de fincas y operaciones ganaderas</p>
        </div>
        <button className="btn-accent" onClick={() => setShowModal(true)}>
          <Plus size={14} /> Nueva finca
        </button>
      </div>

      {/* Aggregate KPIs */}
      {!loading && hasAnyDash && (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", marginBottom: 24 }}>
          {[
            { label: "Fincas",         value: farms.length,  color: "#6ee7b7",  Icon: Leaf },
            { label: "Animales",       value: totalAnimals,  color: "#93c5fd",  Icon: Users },
            { label: "Grupos",         value: totalGroups,   color: "#c4b5fd",  Icon: Leaf },
            { label: "Tareas pend.",   value: totalTasks,    color: "#fcd34d",  Icon: ClipboardList },
            { label: "Vencidas",       value: totalOverdue,  color: totalOverdue > 0 ? "#fca5a5" : "#6ee7b7", Icon: AlertTriangle },
          ].map(s => (
            <div key={s.label} style={{
              borderRadius: 10, border: "1px solid var(--border)", borderTop: `3px solid ${s.color}`,
              background: "var(--surface)", padding: "12px 14px",
            }}>
              <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="alert-banner alert-critical" style={{ marginBottom: 20 }}>{error}</div>
      )}

      {/* Farm grid */}
      {loading ? (
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {[1, 2, 3].map(i => <FarmCardSkeleton key={i} />)}
        </div>
      ) : farms.length === 0 ? (
        <div className="empty-state">
          <Leaf size={40} className="empty-icon" />
          <p className="empty-title">Sin fincas registradas</p>
          <p className="empty-desc">Crea tu primera finca para empezar a gestionar animales, tareas e inventario.</p>
          <button className="btn-accent" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Crear primera finca
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {farms.map(farm => {
            const op = OP_TYPE[farm.operationType] ?? OP_TYPE.LIVESTOCK;
            const OpIcon = op.Icon;
            const dash = dashes[farm.id];
            return (
              <Link key={farm.id} href={`/agro/${farm.id}`} style={{ textDecoration: "none" }}>
                <div className="card-lift" style={{
                  borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)",
                  padding: "18px 20px", borderLeft: `3px solid ${op.color}`, cursor: "pointer",
                  display: "flex", flexDirection: "column", gap: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: op.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <OpIcon size={16} color={op.color} />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>{farm.name}</span>
                    </div>
                    <ChevronRight size={15} color="var(--faint)" style={{ flexShrink: 0 }} />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="badge" style={{ background: op.bg, color: op.color }}>{op.label}</span>
                    {farm.locationLabel && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--muted)" }}>
                        <MapPin size={10} /> {farm.locationLabel}
                      </span>
                    )}
                  </div>

                  {/* Mini stats row from dashboard */}
                  {dash && (
                    <div style={{ display: "flex", gap: 14, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                      {[
                        { label: "Animales",  value: dash.totalAnimals ?? 0,  color: "#93c5fd" },
                        { label: "Grupos",    value: dash.animalGroups ?? 0,  color: "#c4b5fd" },
                        { label: "Tareas",    value: dash.pendingTasks ?? 0,  color: "#fcd34d" },
                        ...(dash.overdueTasks ? [{ label: "Vencidas", value: dash.overdueTasks, color: "#fca5a5" }] : []),
                      ].map(s => (
                        <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</span>
                          <span style={{ fontSize: 9, color: "var(--faint)", textTransform: "uppercase" }}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Crear nueva finca</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}>
                <X size={16} />
              </button>
            </div>
            {formError && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{formError}</div>}
            <form onSubmit={(e) => void handleCreate(e)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="fl">Nombre *</label>
                <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="Finca Las Palmas" required />
              </div>
              <div>
                <label className="fl">Tipo de operación</label>
                <select className="fi" value={operationType} onChange={e => setType(e.target.value as "LIVESTOCK" | "MIXED" | "CROP")}>
                  <option value="LIVESTOCK">Ganadería</option>
                  <option value="MIXED">Mixta</option>
                  <option value="CROP">Cultivos</option>
                </select>
              </div>
              <div>
                <label className="fl">Ubicación</label>
                <input className="fi" value={locationLabel} onChange={e => setLocation(e.target.value)} placeholder="Ej. Antioquia, Colombia" />
              </div>
              <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                <button type="submit" className="btn-accent" disabled={creating} style={{ flex: 1 }}>
                  {creating ? "Creando…" : "Crear finca"}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
