"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Plus, X, ChevronRight, Users, ArrowRight, BarChart2, Layers } from "lucide-react";
import { farmTabs } from "../farm-tabs";

interface AnimalGroup {
  id: string;
  name: string;
  species?: string;
  breed?: string;
  count: number;
  status: "ACTIVE" | "INACTIVE" | "SOLD" | "CULLED";
  unitId?: string;
  notes?: string;
  createdAt: string;
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

export default function GroupsPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const pathname = usePathname();
  const [groups, setGroups] = useState<AnimalGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [count, setCount] = useState("1");
  const [notes, setNotes] = useState("");

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/groups`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      setGroups((json.data as any)?.groups ?? []);
    } catch (err: any) { setError(err?.message ?? "Error cargando grupos"); }
    finally { setLoading(false); }
  }

  function closeModal() { setShowModal(false); setFormError(null); setCreating(false); }
  function resetForm() { setName(""); setSpecies(""); setBreed(""); setCount("1"); setNotes(""); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true); setFormError(null);
    try {
      const body: Record<string, unknown> = { name: name.trim(), count: parseInt(count, 10) || 1 };
      if (species.trim()) body.species = species.trim();
      if (breed.trim())   body.breed   = breed.trim();
      if (notes.trim())   body.notes   = notes.trim();

      const res = await fetch(`/api/semse/agro/farms/${farmId}/groups`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const json = await res.json(); throw new Error(json?.error?.message ?? "Error"); }
      resetForm(); closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setCreating(false); }
  }

  const tabs = farmId ? farmTabs(farmId) : [];
  const active = groups.filter(g => g.status === "ACTIVE");
  const totalHead = groups.reduce((s, g) => s + g.count, 0);

  return (
    <div className="agro-shell">
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>Grupos</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Grupos de animales</h1>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>Manejo colectivo de lotes, razas y categorías productivas</p>
        </div>
        <button className="btn-accent" onClick={() => setShowModal(true)}>
          <Plus size={13} /> Nuevo grupo
        </button>
      </div>

      <nav className="tab-bar">
        {tabs.map(tab => (
          <Link key={tab.href} href={tab.href} className="tab-item"
            data-active={pathname === tab.href ? "true" : "false"}>{tab.label}</Link>
        ))}
      </nav>

      {error && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Summary strip */}
      {!loading && groups.length > 0 && (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", marginBottom: 16 }}>
          {[
            { label: "Grupos activos", value: active.length,  color: "#6ee7b7", Icon: Layers },
            { label: "Cabezas totales", value: totalHead,     color: "#93c5fd", Icon: Users },
            { label: "Total grupos",   value: groups.length,  color: "#fcd34d", Icon: BarChart2 },
          ].map(s => (
            <div key={s.label} style={{
              borderRadius: 10, border: "1px solid var(--border)", borderTop: `3px solid ${s.color}`,
              background: "var(--surface)", padding: "12px 14px",
            }}>
              <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1,2,3].map(i => <div key={i} className="skel" style={{ height: 90 }} />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <Users size={36} className="empty-icon" />
          <p className="empty-title">Sin grupos registrados</p>
          <p className="empty-desc">Organiza tus animales en grupos por lote, raza o categoría productiva para un manejo más eficiente.</p>
          <button className="btn-accent" onClick={() => setShowModal(true)}>
            <Plus size={13} /> Crear primer grupo
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {groups.map(group => {
            const color = STATUS_COLOR[group.status] ?? "#94a3b8";
            return (
              <div key={group.id} style={{
                borderRadius: 12, border: "1px solid var(--border)", borderLeft: `3px solid ${color}`,
                background: "var(--surface)", padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 14,
              }}>
                {/* Icon avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: `${color}15`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Users size={16} color={color} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{group.name}</p>
                    <span className={`badge badge-${group.status === "ACTIVE" ? "green" : group.status === "SOLD" ? "amber" : "red"}`}
                      style={{ fontSize: 10 }}>
                      {STATUS_LABEL[group.status] ?? group.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--muted)" }}>
                    {[group.species, group.breed].filter(Boolean).join(" · ") || "Sin especificación"}
                    {group.notes && <span style={{ color: "var(--faint)" }}> · {group.notes}</span>}
                  </p>
                </div>

                {/* Head count */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 20, fontWeight: 800, color }}>
                    {group.count}
                  </p>
                  <p style={{ fontSize: 10, color: "var(--faint)" }}>cabezas</p>
                </div>

                {/* Link to group detail */}
                <Link href={`/agro/${farmId}/groups/${group.id}`} style={{
                  width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)",
                  background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, color: "var(--muted)", textDecoration: "none",
                }}>
                  <ArrowRight size={13} />
                </Link>
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
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Nuevo grupo de animales</h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex" }}><X size={16} /></button>
            </div>
            {formError && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{formError}</div>}
            <form onSubmit={e => void handleCreate(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="fl">Nombre del grupo *</label>
                <input className="fi" required value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Lote A — Novillos 2024" />
              </div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <label className="fl">Especie</label>
                  <input className="fi" value={species} onChange={e => setSpecies(e.target.value)} placeholder="Bovino, Porcino…" />
                </div>
                <div>
                  <label className="fl">Raza</label>
                  <input className="fi" value={breed} onChange={e => setBreed(e.target.value)} placeholder="Angus, Holstein…" />
                </div>
              </div>
              <div>
                <label className="fl">Número de cabezas</label>
                <input className="fi" type="number" min="1" value={count} onChange={e => setCount(e.target.value)} />
              </div>
              <div>
                <label className="fl">Notas (opcional)</label>
                <textarea className="fi" rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                  style={{ resize: "vertical" }} placeholder="Observaciones generales del lote…" />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" className="btn-accent" disabled={creating} style={{ flex: 1 }}>{creating ? "Creando…" : "Crear grupo"}</button>
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
