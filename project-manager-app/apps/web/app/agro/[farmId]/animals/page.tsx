"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Plus, X, Scale, MapPin, RefreshCw, ChevronRight, Beef, Users, Download, Search } from "lucide-react";

interface Animal {
  id: string; tagCode?: string; species: string; breed?: string;
  sex: string; status: string; currentWeight?: number;
  estimatedAgeMonths?: number; currentUnitId?: string;
}
interface Group {
  id: string; name: string; species: string; count: number;
  status: string; averageWeight?: number;
}
interface FarmUnit { id: string; name: string; type: string; }

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:   "badge badge-green",
  SOLD:     "badge badge-slate",
  DEAD:     "badge badge-red",
  LOST:     "badge badge-amber",
  INACTIVE: "badge badge-slate",
};
const SPECIES = ["CATTLE","PIG","GOAT","SHEEP","HORSE","CHICKEN","OTHER"];
const SEXES   = ["MALE","FEMALE","UNKNOWN"];

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

function downloadCSV(animals: Animal[]) {
  if (!animals.length) return;
  const headers = ["ID","Código","Especie","Raza","Sexo","Estado","Peso (kg)","Edad (meses)"];
  const rows = animals.map(a => [
    a.id, a.tagCode ?? "", a.species, a.breed ?? "", a.sex, a.status,
    a.currentWeight ?? "", a.estimatedAgeMonths ?? "",
  ].map(v => `"${v}"`).join(","));
  const csv  = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `animales-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function AnimalsPage() {
  const { farmId }  = useParams<{ farmId: string }>();
  const pathname    = usePathname();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [groups, setGroups]   = useState<Group[]>([]);
  const [units, setUnits]     = useState<FarmUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [view, setView]       = useState<"animals" | "groups">("animals");

  type ModalType =
    | { type: "create-animal" } | { type: "create-group" }
    | { type: "weigh";  animal: Animal } | { type: "move";  animal: Animal }
    | { type: "status"; animal: Animal } | { type: "adjust"; group: Group };
  const [modal, setModal]         = useState<ModalType | null>(null);
  const [busy, setBusy]           = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [newSpecies, setNewSpecies] = useState("CATTLE");
  const [newSex, setNewSex]         = useState("UNKNOWN");
  const [newTag, setNewTag]         = useState("");
  const [newBreed, setNewBreed]     = useState("");
  const [newWeight, setNewWeight]   = useState("");
  const [grpName, setGrpName]       = useState("");
  const [grpSpecies, setGrpSpecies] = useState("CATTLE");
  const [grpCount, setGrpCount]     = useState("");
  const [grpWeight, setGrpWeight]   = useState("");
  const [weighVal, setWeighVal]     = useState("");
  const [moveUnit, setMoveUnit]     = useState("");
  const [newStatus, setNewStatus]   = useState("");
  const [adjustDelta, setAdjustDelta]   = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [speciesFilter, setSpeciesFilter] = useState("ALL");

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [ar, gr, ur] = await Promise.all([
        fetch(`/api/semse/agro/farms/${farmId}/animals`),
        fetch(`/api/semse/agro/farms/${farmId}/animals?groups=true`),
        fetch(`/api/semse/agro/${farmId}/units`),
      ]);
      const aj = await ar.json();
      if (!ar.ok) throw new Error(aj?.error?.message ?? "Error animales");
      setAnimals((aj.data as any)?.animals ?? []);
      try { const gj = await gr.json(); setGroups((gj.data as any)?.groups ?? []); } catch { /* secundario */ }
      try { const uj = await ur.json(); setUnits((uj.data as any)?.units ?? []); } catch { /* secundario */ }
    } catch (err: any) { setError(err?.message ?? "Error cargando animales"); }
    finally { setLoading(false); }
  }

  function closeModal() { setModal(null); setFormError(null); setBusy(false); }

  async function handleCreateAnimal(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/animals`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ species: newSpecies, sex: newSex, tagCode: newTag || undefined, breed: newBreed || undefined, initialWeight: newWeight ? parseFloat(newWeight) : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setNewSpecies("CATTLE"); setNewSex("UNKNOWN"); setNewTag(""); setNewBreed(""); setNewWeight("");
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault(); if (!grpName.trim() || !grpCount) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/animals`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ _isGroup: true, name: grpName, species: grpSpecies, count: parseInt(grpCount, 10), averageWeight: grpWeight ? parseFloat(grpWeight) : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setGrpName(""); setGrpSpecies("CATTLE"); setGrpCount(""); setGrpWeight("");
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function handleWeigh(e: React.FormEvent) {
    e.preventDefault(); if (modal?.type !== "weigh" || !weighVal) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/animals/${modal.animal.id}/weigh`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ weight: parseFloat(weighVal) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setWeighVal(""); closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function handleMove(e: React.FormEvent) {
    e.preventDefault(); if (modal?.type !== "move") return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/animals/${modal.animal.id}/move`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUnitId: moveUnit || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setMoveUnit(""); closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function handleStatusChange(e: React.FormEvent) {
    e.preventDefault(); if (modal?.type !== "status" || !newStatus) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/animals/${modal.animal.id}/status`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setNewStatus(""); closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function handleAdjustCount(e: React.FormEvent) {
    e.preventDefault(); if (modal?.type !== "adjust" || !adjustDelta) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/animal-groups/${modal.group.id}/adjust-count`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ delta: parseInt(adjustDelta, 10), reason: adjustReason || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setAdjustDelta(""); setAdjustReason(""); closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  const tabs = farmId ? farmTabs(farmId) : [];

  const filteredAnimals = animals.filter(a => {
    const q = search.toLowerCase();
    if (q && !((a.tagCode ?? "").toLowerCase().includes(q) || a.species.toLowerCase().includes(q) || (a.breed ?? "").toLowerCase().includes(q))) return false;
    if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
    if (speciesFilter !== "ALL" && a.species !== speciesFilter) return false;
    return true;
  });

  const activeSpecies = [...new Set(animals.map(a => a.species))];
  const activeStatuses = [...new Set(animals.map(a => a.status))];

  return (
    <div className="agro-shell">
      {/* Breadcrumb */}
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>Animales</span>
      </nav>

      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Animales</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {view === "animals" && animals.length > 0 && (
            <button className="btn-ghost" onClick={() => downloadCSV(animals)}>
              <Download size={13} /> Exportar CSV
            </button>
          )}
          <button
            className="btn-accent"
            onClick={() => setModal(view === "animals" ? { type: "create-animal" } : { type: "create-group" })}
          >
            <Plus size={13} /> {view === "animals" ? "Nuevo animal" : "Nuevo grupo"}
          </button>
        </div>
      </div>

      {/* Farm tabs */}
      <nav className="tab-bar">
        {tabs.map(tab => (
          <Link key={tab.href} href={tab.href} className="tab-item"
            data-active={pathname === tab.href || (tab.href.includes("/animals") && (pathname ?? "").includes("/animals")) ? "true" : "false"}>
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* View toggle + Search + Filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {(["animals", "groups"] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={view === v ? "btn-primary" : "btn-ghost"}
            style={{ fontSize: 12, padding: "5px 14px" }}
          >
            {v === "animals" ? (<><Beef size={12} /> Individuales</>) : (<><Users size={12} /> Grupos</>)}
          </button>
        ))}
      </div>

      {view === "animals" && animals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search size={13} color="var(--muted)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              className="fi"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por código, especie o raza…"
              style={{ paddingLeft: 34, margin: 0 }}
            />
          </div>
          {/* Status filter chips */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--muted)", alignSelf: "center", fontWeight: 600 }}>Estado:</span>
            {["ALL", ...activeStatuses].map(s => (
              <button key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600,
                  border: `1px solid ${statusFilter === s ? "var(--brand)" : "var(--border)"}`,
                  background: statusFilter === s ? "var(--brand)" : "transparent",
                  color: statusFilter === s ? "#fff" : "var(--muted)",
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                {s === "ALL" ? "Todos" : s}
              </button>
            ))}
          </div>
          {/* Species filter chips */}
          {activeSpecies.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--muted)", alignSelf: "center", fontWeight: 600 }}>Especie:</span>
              {["ALL", ...activeSpecies].map(sp => (
                <button key={sp}
                  onClick={() => setSpeciesFilter(sp)}
                  style={{
                    padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600,
                    border: `1px solid ${speciesFilter === sp ? "var(--brand)" : "var(--border)"}`,
                    background: speciesFilter === sp ? "var(--brand)" : "transparent",
                    color: speciesFilter === sp ? "#fff" : "var(--muted)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                  {sp === "ALL" ? "Todas" : sp}
                </button>
              ))}
            </div>
          )}
          {filteredAnimals.length !== animals.length && (
            <p style={{ fontSize: 11, color: "var(--muted)" }}>
              Mostrando {filteredAnimals.length} de {animals.length} animales
              {(search || statusFilter !== "ALL" || speciesFilter !== "ALL") && (
                <button onClick={() => { setSearch(""); setStatusFilter("ALL"); setSpeciesFilter("ALL"); }}
                  style={{ marginLeft: 8, fontSize: 11, color: "var(--brand)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  Limpiar filtros ×
                </button>
              )}
            </p>
          )}
        </div>
      )}

      {error && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3,4].map(i => <div key={i} className="skel" style={{ height: 48 }} />)}
        </div>
      ) : view === "animals" ? (
        animals.length === 0 ? (
          <div className="empty-state">
            <Beef size={36} className="empty-icon" />
            <p className="empty-title">Sin animales registrados</p>
            <p className="empty-desc">Registra el primer animal para comenzar el seguimiento individual.</p>
            <button className="btn-accent" onClick={() => setModal({ type: "create-animal" })}>
              <Plus size={13} /> Nuevo animal
            </button>
          </div>
        ) : (
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", overflow: "hidden" }}>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 60px 80px 90px 88px", gap: 0, padding: "8px 16px", borderBottom: "1px solid var(--line)", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <span>Tag / Especie</span><span>Raza</span><span>Sexo</span><span>Peso</span><span>Ubicación</span><span>Estado</span><span style={{ textAlign: "right" }}>Acciones</span>
            </div>
            {filteredAnimals.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "var(--muted)" }}>Sin resultados para la búsqueda actual</p>
              </div>
            ) : null}
            {filteredAnimals.map(a => (
              <div key={a.id} className="data-row" style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 60px 80px 90px 88px", alignItems: "center", opacity: a.status !== "ACTIVE" ? 0.7 : 1 }}>
                <div>
                  <Link href={`/agro/${farmId}/animals/${a.id}`}
                    style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)", textDecoration: "none", fontFamily: "var(--font-mono)" }}>
                    {a.tagCode ?? "—"}
                  </Link>
                  <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{a.species}</p>
                </div>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{a.breed ?? "—"}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{a.sex}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                  {a.currentWeight != null ? `${Number(a.currentWeight).toFixed(1)} kg` : "—"}
                </span>
                <span style={{ fontSize: 11, color: "var(--faint)" }}>
                  {a.currentUnitId ? units.find(u => u.id === a.currentUnitId)?.name ?? "—" : "—"}
                </span>
                <span className={STATUS_BADGE[a.status] ?? "badge badge-slate"}>{a.status}</span>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => { setWeighVal(""); setModal({ type: "weigh", animal: a }); }}
                    title="Pesar"
                    style={{ padding: "4px 7px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "flex" }}
                  ><Scale size={13} /></button>
                  <button
                    onClick={() => { setMoveUnit(a.currentUnitId ?? ""); setModal({ type: "move", animal: a }); }}
                    title="Mover"
                    style={{ padding: "4px 7px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "flex" }}
                  ><MapPin size={13} /></button>
                  {a.status === "ACTIVE" && (
                    <button
                      onClick={() => { setNewStatus(""); setModal({ type: "status", animal: a }); }}
                      title="Cambiar estado"
                      style={{ padding: "4px 7px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "flex" }}
                    ><RefreshCw size={13} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        groups.length === 0 ? (
          <div className="empty-state">
            <Users size={36} className="empty-icon" />
            <p className="empty-title">Sin grupos registrados</p>
            <p className="empty-desc">Crea grupos para gestionar lotes de animales con seguimiento colectivo.</p>
            <button className="btn-accent" onClick={() => setModal({ type: "create-group" })}>
              <Plus size={13} /> Nuevo grupo
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {groups.map(g => (
              <div key={g.id} style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{g.name}</span>
                  <span className={STATUS_BADGE[g.status] ?? "badge badge-slate"}>{g.status}</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{g.species}</p>
                <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                  <div>
                    <p style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Cantidad</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>{g.count}</p>
                  </div>
                  {g.averageWeight != null && (
                    <div>
                      <p style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Peso prom.</p>
                      <p style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>{Number(g.averageWeight).toFixed(0)} kg</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setAdjustDelta(""); setAdjustReason(""); setModal({ type: "adjust", group: g }); }}
                  className="btn-ghost"
                  style={{ fontSize: 12, padding: "5px 12px", width: "100%" }}
                >
                  Ajustar conteo
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>
                {modal.type === "create-animal" ? "Nuevo animal"
                  : modal.type === "create-group" ? "Nuevo grupo"
                  : modal.type === "weigh" ? "Registrar pesaje"
                  : modal.type === "move" ? "Mover animal"
                  : modal.type === "status" ? "Cambiar estado"
                  : "Ajustar conteo"}
              </h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}>
                <X size={16} />
              </button>
            </div>

            {formError && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{formError}</div>}

            {/* Create animal */}
            {modal.type === "create-animal" && (
              <form onSubmit={e => void handleCreateAnimal(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><label className="fl">Especie *</label><select className="fi" value={newSpecies} onChange={e => setNewSpecies(e.target.value)}>{SPECIES.map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label className="fl">Sexo *</label><select className="fi" value={newSex} onChange={e => setNewSex(e.target.value)}>{SEXES.map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label className="fl">Código tag</label><input className="fi" value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Ej. MX-001" /></div>
                <div><label className="fl">Raza</label><input className="fi" value={newBreed} onChange={e => setNewBreed(e.target.value)} placeholder="Ej. Angus" /></div>
                <div><label className="fl">Peso inicial (kg)</label><input className="fi" type="number" step="0.1" min="0" value={newWeight} onChange={e => setNewWeight(e.target.value)} /></div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" className="btn-accent" disabled={busy} style={{ flex: 1 }}>{busy ? "Guardando…" : "Crear animal"}</button>
                  <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
                </div>
              </form>
            )}

            {/* Create group */}
            {modal.type === "create-group" && (
              <form onSubmit={e => void handleCreateGroup(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><label className="fl">Nombre *</label><input className="fi" value={grpName} onChange={e => setGrpName(e.target.value)} required placeholder="Ej. Lote Norte" /></div>
                <div><label className="fl">Especie *</label><select className="fi" value={grpSpecies} onChange={e => setGrpSpecies(e.target.value)}>{SPECIES.map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label className="fl">Cantidad *</label><input className="fi" type="number" min="1" value={grpCount} onChange={e => setGrpCount(e.target.value)} required /></div>
                <div><label className="fl">Peso promedio (kg)</label><input className="fi" type="number" step="0.1" min="0" value={grpWeight} onChange={e => setGrpWeight(e.target.value)} /></div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" className="btn-accent" disabled={busy} style={{ flex: 1 }}>{busy ? "Guardando…" : "Crear grupo"}</button>
                  <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
                </div>
              </form>
            )}

            {/* Weigh */}
            {modal.type === "weigh" && (
              <form onSubmit={e => void handleWeigh(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -8 }}>{modal.animal.tagCode ?? modal.animal.species}</p>
                <div><label className="fl">Peso (kg) *</label><input className="fi" type="number" step="0.1" min="0" value={weighVal} onChange={e => setWeighVal(e.target.value)} required autoFocus /></div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" className="btn-accent" disabled={busy || !weighVal} style={{ flex: 1 }}>{busy ? "Guardando…" : "Guardar peso"}</button>
                  <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
                </div>
              </form>
            )}

            {/* Move */}
            {modal.type === "move" && (
              <form onSubmit={e => void handleMove(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -8 }}>{modal.animal.tagCode ?? modal.animal.species}</p>
                <div>
                  <label className="fl">Destino</label>
                  <select className="fi" value={moveUnit} onChange={e => setMoveUnit(e.target.value)}>
                    <option value="">Sin unidad asignada</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.type})</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" className="btn-accent" disabled={busy} style={{ flex: 1 }}>{busy ? "Moviendo…" : "Mover"}</button>
                  <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
                </div>
              </form>
            )}

            {/* Status */}
            {modal.type === "status" && (
              <form onSubmit={e => void handleStatusChange(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -8 }}>{modal.animal.tagCode ?? modal.animal.species} — actual: <strong>{modal.animal.status}</strong></p>
                <div>
                  <label className="fl">Nuevo estado *</label>
                  <select className="fi" value={newStatus} onChange={e => setNewStatus(e.target.value)} required>
                    <option value="">Seleccionar…</option>
                    {["SOLD","DEAD","LOST","INACTIVE"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" className="btn-accent" disabled={busy || !newStatus} style={{ flex: 1 }}>{busy ? "Guardando…" : "Confirmar"}</button>
                  <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
                </div>
              </form>
            )}

            {/* Adjust count */}
            {modal.type === "adjust" && (
              <form onSubmit={e => void handleAdjustCount(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -8 }}>{modal.group.name} — actual: <strong>{modal.group.count}</strong></p>
                <div><label className="fl">Delta (± número) *</label><input className="fi" type="number" value={adjustDelta} onChange={e => setAdjustDelta(e.target.value)} required autoFocus placeholder="Ej. -3 o 5" /></div>
                <div><label className="fl">Razón</label><input className="fi" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Venta, muerte, nacimiento…" /></div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" className="btn-accent" disabled={busy || !adjustDelta} style={{ flex: 1 }}>{busy ? "Guardando…" : "Ajustar"}</button>
                  <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
