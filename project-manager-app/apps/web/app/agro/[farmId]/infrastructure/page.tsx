"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Plus, X, Building2, ChevronRight, Scale, Fence, Tractor } from "lucide-react";

interface FarmUnit {
  id: string; name: string; type: string;
  capacity?: number; notes?: string;
}

const UNIT_TYPES = ["PADDOCK","CORRAL","BARN","PASTURE","MILKING_AREA","FEEDLOT","QUARANTINE","SCALE","OTHER"];
const TYPE_LABEL: Record<string, string> = {
  PADDOCK:      "Potrero",
  CORRAL:       "Corral",
  BARN:         "Establo",
  PASTURE:      "Pastizal",
  MILKING_AREA: "Sala de ordeño",
  FEEDLOT:      "Manga / Embarcadero",
  QUARANTINE:   "Cuarentena",
  SCALE:        "Báscula",
  OTHER:        "Otro",
};
const TYPE_ICON: Record<string, typeof Building2> = {
  PADDOCK: Fence, CORRAL: Fence, BARN: Building2, PASTURE: Fence,
  MILKING_AREA: Building2, FEEDLOT: Tractor, QUARANTINE: Building2,
  SCALE: Scale, OTHER: Building2,
};
const TYPE_COLOR: Record<string, string> = {
  PADDOCK:      "#6ee7b7", CORRAL:       "#fcd34d", BARN:  "#93c5fd",
  PASTURE:      "#6ee7b7", MILKING_AREA: "#c4b5fd", FEEDLOT: "#fcd34d",
  QUARANTINE:   "#fca5a5", SCALE:        "#67e8f9", OTHER: "#94a3b8",
};
const TYPE_BG: Record<string, string> = {
  PADDOCK:      "rgba(16,185,129,.12)",  CORRAL:       "rgba(245,158,11,.12)",
  BARN:         "rgba(59,130,246,.12)",  PASTURE:      "rgba(16,185,129,.12)",
  MILKING_AREA: "rgba(139,92,246,.12)", FEEDLOT:      "rgba(245,158,11,.12)",
  QUARANTINE:   "rgba(239,68,68,.12)",  SCALE:        "rgba(6,182,212,.12)",
  OTHER:        "rgba(148,163,184,.1)",
};

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

export default function InfrastructurePage() {
  const { farmId } = useParams<{ farmId: string }>();
  const pathname   = usePathname();
  const [units, setUnits]     = useState<FarmUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [showModal, setShowModal]   = useState(false);
  const [busy, setBusy]             = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [newName, setNewName]       = useState("");
  const [newType, setNewType]       = useState("CORRAL");
  const [newCap, setNewCap]         = useState("");
  const [newNotes, setNewNotes]     = useState("");

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/semse/agro/${farmId}/units`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      setUnits((json.data as any)?.units ?? []);
    } catch (err: any) { setError(err?.message ?? "Error cargando infraestructura"); }
    finally { setLoading(false); }
  }

  function closeModal() { setShowModal(false); setFormError(null); setBusy(false); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); if (!newName.trim()) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/${farmId}/units`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName, type: newType, capacity: newCap ? parseFloat(newCap) : undefined, notes: newNotes || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setNewName(""); setNewType("CORRAL"); setNewCap(""); setNewNotes("");
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  const byType = UNIT_TYPES.reduce<Record<string, FarmUnit[]>>((acc, t) => {
    acc[t] = units.filter(u => u.type === t); return acc;
  }, {});
  const tabs = farmId ? farmTabs(farmId) : [];

  return (
    <div className="agro-shell">
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>Infraestructura</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Infraestructura</h1>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>Corrales, potreros, mangas, básculas y más</p>
        </div>
        <button className="btn-accent" onClick={() => setShowModal(true)}>
          <Plus size={13} /> Nueva unidad
        </button>
      </div>

      <nav className="tab-bar">
        {tabs.map(tab => (
          <Link key={tab.href} href={tab.href} className="tab-item"
            data-active={pathname === tab.href ? "true" : "false"}>{tab.label}</Link>
        ))}
      </nav>

      {error && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="skel" style={{ height: 100 }} />)}
        </div>
      ) : units.length === 0 ? (
        <div className="empty-state">
          <Building2 size={36} className="empty-icon" />
          <p className="empty-title">Sin infraestructura registrada</p>
          <p className="empty-desc">Agrega corrales, potreros, mangas y básculas para organizar tu finca.</p>
          <button className="btn-accent" onClick={() => setShowModal(true)}>
            <Plus size={13} /> Agregar primera unidad
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {UNIT_TYPES.filter(t => byType[t].length > 0).map(type => {
            const Icon = TYPE_ICON[type] ?? Building2;
            const color = TYPE_COLOR[type] ?? "#94a3b8";
            const bg    = TYPE_BG[type]    ?? "rgba(148,163,184,.1)";
            return (
              <div key={type}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={14} color={color} />
                  </div>
                  <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                    {TYPE_LABEL[type] ?? type}
                    <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>({byType[type].length})</span>
                  </h2>
                </div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                  {byType[type].map(unit => (
                    <div key={unit.id} style={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      borderLeft: `3px solid ${color}`,
                      background: "var(--surface)",
                      padding: "14px 16px",
                    }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{unit.name}</p>
                      {unit.capacity != null && (
                        <p style={{ fontSize: 12, color: "var(--muted)" }}>Cap: {unit.capacity} animales</p>
                      )}
                      {unit.notes && (
                        <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 4, lineHeight: 1.4 }}>{unit.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Nueva unidad de infraestructura</h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex" }}><X size={16} /></button>
            </div>
            {formError && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{formError}</div>}
            <form onSubmit={e => void handleCreate(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label className="fl">Nombre *</label><input className="fi" value={newName} onChange={e => setNewName(e.target.value)} required autoFocus placeholder="Ej. Corral Norte A" /></div>
              <div>
                <label className="fl">Tipo *</label>
                <select className="fi" value={newType} onChange={e => setNewType(e.target.value)}>
                  {UNIT_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
                </select>
              </div>
              <div><label className="fl">Capacidad (animales)</label><input className="fi" type="number" min="0" value={newCap} onChange={e => setNewCap(e.target.value)} placeholder="Ej. 50" /></div>
              <div><label className="fl">Notas</label><input className="fi" value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Opcional" /></div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" className="btn-accent" disabled={busy} style={{ flex: 1 }}>{busy ? "Guardando…" : "Crear"}</button>
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
