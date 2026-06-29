"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Scale, MapPin, RefreshCw, X, TrendingUp, TrendingDown, ChevronRight, Activity, Beef } from "lucide-react";

interface Animal {
  id: string; tagCode?: string; species: string; breed?: string;
  sex: string; status: string; currentWeight?: number; initialWeight?: number;
  estimatedAgeMonths?: number; birthDate?: string; acquisitionDate?: string;
  acquisitionCost?: number; notes?: string; currentUnitId?: string;
}
interface TimelineEvent {
  id: string; action: string; before?: Record<string, unknown>;
  after?: Record<string, unknown>; createdAt: string; actorId?: string;
}
interface FarmUnit { id: string; name: string; type: string; }

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:   "badge badge-green",
  SOLD:     "badge badge-slate",
  DEAD:     "badge badge-red",
  LOST:     "badge badge-amber",
  INACTIVE: "badge badge-slate",
};
const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  "animal.created":        { label: "Registro creado",      color: "var(--brand)"  },
  "animal.updated":        { label: "Datos actualizados",   color: "var(--muted)"  },
  "animal.weighed":        { label: "Pesaje registrado",    color: "#6ee7b7"       },
  "animal.moved":          { label: "Movimiento de unidad", color: "#93c5fd"       },
  "animal.status_changed": { label: "Cambio de estado",     color: "#fca5a5"       },
};

export default function AnimalDetailPage() {
  const { farmId, animalId } = useParams<{ farmId: string; animalId: string }>();
  const [animal, setAnimal]     = useState<Animal | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [units, setUnits]       = useState<FarmUnit[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  type ModalType = { type: "weigh" } | { type: "move" } | { type: "status" };
  const [modal, setModal]         = useState<ModalType | null>(null);
  const [busy, setBusy]           = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [weighVal, setWeighVal]   = useState("");
  const [moveUnit, setMoveUnit]   = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [salePrice, setSalePrice] = useState("");

  useEffect(() => { if (animalId && farmId) void load(); }, [animalId, farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [ar, tr, ur] = await Promise.all([
        fetch(`/api/semse/agro/animals/${animalId}`),
        fetch(`/api/semse/agro/animals/${animalId}/timeline`),
        fetch(`/api/semse/agro/${farmId}/units`),
      ]);
      const aj = await ar.json();
      if (!ar.ok) throw new Error(aj?.error?.message ?? "Error cargando animal");
      setAnimal((aj.data as any)?.animal ?? aj.data);
      try { const tj = await tr.json(); setTimeline((tj.data as any)?.events ?? tj.data ?? []); } catch { /* best-effort */ }
      try { const uj = await ur.json(); setUnits((uj.data as any)?.units ?? []); } catch { /* best-effort */ }
    } catch (err: any) { setError(err?.message ?? "Error"); }
    finally { setLoading(false); }
  }

  function closeModal() { setModal(null); setFormError(null); setBusy(false); }

  async function handleWeigh(e: React.FormEvent) {
    e.preventDefault(); if (!weighVal) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/animals/${animalId}/weigh`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ weight: parseFloat(weighVal) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setWeighVal(""); closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function handleMove(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/animals/${animalId}/move`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUnitId: moveUnit || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setMoveUnit(""); closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function handleStatus(e: React.FormEvent) {
    e.preventDefault(); if (!newStatus) return;
    setBusy(true); setFormError(null);
    try {
      const body: Record<string, unknown> = { status: newStatus };
      if (newStatus === "SOLD" && salePrice) body.salePrice = parseFloat(salePrice);
      const res = await fetch(`/api/semse/agro/animals/${animalId}/status`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setNewStatus(""); setSalePrice(""); closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  if (loading) return (
    <div className="agro-shell">
      <div className="skel" style={{ height: 14, width: 240, marginBottom: 24 }} />
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24 }}>
        {[1,2,3,4].map(i => <div key={i} className="skel" style={{ height: 80 }} />)}
      </div>
      <div className="skel" style={{ height: 160 }} />
    </div>
  );

  if (error || !animal) return (
    <div className="agro-shell">
      <div className="alert-banner alert-critical">{error ?? "Animal no encontrado"}</div>
    </div>
  );

  const weightDelta = animal.currentWeight != null && animal.initialWeight != null
    ? Number(animal.currentWeight) - Number(animal.initialWeight)
    : null;
  const currentUnit = units.find(u => u.id === animal.currentUnitId);

  return (
    <div className="agro-shell" style={{ maxWidth: 780 }}>
      {/* Breadcrumb */}
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}/animals`}>Animales</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>{animal.tagCode ?? animal.species}</span>
      </nav>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(16,185,129,.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Beef size={22} color="#6ee7b7" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              {animal.tagCode ? `#${animal.tagCode}` : animal.species}
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>
              {animal.species}{animal.breed ? ` · ${animal.breed}` : ""} · {animal.sex}
            </p>
          </div>
        </div>
        <span className={STATUS_BADGE[animal.status] ?? "badge badge-slate"} style={{ fontSize: 12, padding: "4px 12px" }}>
          {animal.status}
        </span>
      </div>

      {/* Action buttons */}
      {animal.status === "ACTIVE" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          <button onClick={() => { setWeighVal(""); setModal({ type: "weigh" }); }} className="btn-ghost">
            <Scale size={13} /> Pesar
          </button>
          <button onClick={() => { setMoveUnit(animal.currentUnitId ?? ""); setModal({ type: "move" }); }} className="btn-ghost">
            <MapPin size={13} /> Mover
          </button>
          <button onClick={() => { setNewStatus(""); setModal({ type: "status" }); }} className="btn-danger">
            <RefreshCw size={13} /> Cambiar estado
          </button>
        </div>
      )}

      {/* Stat grid */}
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", marginBottom: 24 }}>
        {/* Peso actual */}
        <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Peso actual</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em", lineHeight: 1 }}>
            {animal.currentWeight != null ? `${Number(animal.currentWeight).toFixed(1)}` : "—"}
            {animal.currentWeight != null && <span style={{ fontSize: 13, fontWeight: 500, color: "var(--muted)", marginLeft: 3 }}>kg</span>}
          </p>
          {weightDelta != null && (
            <p style={{ fontSize: 11, color: weightDelta >= 0 ? "#6ee7b7" : "#fca5a5", display: "flex", alignItems: "center", gap: 3, marginTop: 4 }}>
              {weightDelta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {weightDelta >= 0 ? "+" : ""}{weightDelta.toFixed(1)} kg vs inicial
            </p>
          )}
        </div>
        {/* Peso inicial */}
        <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Peso inicial</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em", lineHeight: 1 }}>
            {animal.initialWeight != null ? `${Number(animal.initialWeight).toFixed(1)}` : "—"}
            {animal.initialWeight != null && <span style={{ fontSize: 13, fontWeight: 500, color: "var(--muted)", marginLeft: 3 }}>kg</span>}
          </p>
        </div>
        {/* Edad */}
        <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Edad</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em", lineHeight: 1 }}>
            {animal.estimatedAgeMonths ?? "—"}
            {animal.estimatedAgeMonths != null && <span style={{ fontSize: 13, fontWeight: 500, color: "var(--muted)", marginLeft: 3 }}>m</span>}
          </p>
        </div>
        {/* Ubicación */}
        <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Ubicación</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>
            {currentUnit ? currentUnit.name : <span style={{ color: "var(--faint)" }}>Sin asignar</span>}
          </p>
          {currentUnit && <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{currentUnit.type}</p>}
        </div>
      </div>

      {/* Details + Timeline grid */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
        {/* Details */}
        <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "18px 20px" }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 14, letterSpacing: "-0.01em" }}>Detalles</h2>
          <dl style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              ["Especie",       animal.species],
              ["Raza",          animal.breed ?? "—"],
              ["Sexo",          animal.sex],
              ["Estado",        animal.status],
              ["Nacimiento",    animal.birthDate ? new Date(animal.birthDate).toLocaleDateString("es-CO") : "—"],
              ["Adquisición",   animal.acquisitionDate ? new Date(animal.acquisitionDate).toLocaleDateString("es-CO") : "—"],
              ["Costo adq.",    animal.acquisitionCost != null ? `$${Number(animal.acquisitionCost).toFixed(2)}` : "—"],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
                <dt style={{ color: "var(--muted)" }}>{label}</dt>
                <dd style={{ fontWeight: 600, color: "var(--ink)", textAlign: "right" }}>{value}</dd>
              </div>
            ))}
          </dl>
          {animal.notes && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Notas</p>
              <p style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.5 }}>{animal.notes}</p>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "18px 20px" }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 14, letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 6 }}>
            <Activity size={13} color="var(--muted)" /> Historial
          </h2>
          {timeline.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--muted)" }}>Sin actividad registrada.</p>
          ) : (
            <ol style={{ position: "relative", paddingLeft: 18, margin: 0, borderLeft: "1px solid var(--line)" }}>
              {timeline.map(ev => {
                const cfg = ACTION_LABELS[ev.action] ?? { label: ev.action, color: "var(--muted)" };
                const after = ev.after as any;
                return (
                  <li key={ev.id} style={{ marginBottom: 14, position: "relative" }}>
                    <div style={{ position: "absolute", left: -22, top: 3, width: 8, height: 8, borderRadius: "50%", background: cfg.color }} />
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>{cfg.label}</p>
                    {ev.action === "animal.weighed" && after?.currentWeight != null && (
                      <p style={{ fontSize: 11, color: "var(--muted)" }}>Peso: {Number(after.currentWeight).toFixed(1)} kg</p>
                    )}
                    {ev.action === "animal.moved" && (
                      <p style={{ fontSize: 11, color: "var(--muted)" }}>→ {after?.currentUnitId ?? "Sin unidad"}</p>
                    )}
                    {ev.action === "animal.status_changed" && (
                      <p style={{ fontSize: 11, color: "var(--muted)" }}>Estado → {after?.status}</p>
                    )}
                    <p style={{ fontSize: 10, color: "var(--faint)", marginTop: 2 }}>
                      {new Date(ev.createdAt).toLocaleString("es-CO")}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>
                {modal.type === "weigh" ? "Registrar pesaje" : modal.type === "move" ? "Mover animal" : "Cambiar estado"}
              </h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}>
                <X size={16} />
              </button>
            </div>

            {formError && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{formError}</div>}

            {modal.type === "weigh" && (
              <form onSubmit={e => void handleWeigh(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><label className="fl">Peso (kg) *</label><input className="fi" type="number" step="0.1" min="0" value={weighVal} onChange={e => setWeighVal(e.target.value)} required autoFocus /></div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" className="btn-accent" disabled={busy || !weighVal} style={{ flex: 1 }}>{busy ? "Guardando…" : "Guardar"}</button>
                  <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
                </div>
              </form>
            )}

            {modal.type === "move" && (
              <form onSubmit={e => void handleMove(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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

            {modal.type === "status" && (
              <form onSubmit={e => void handleStatus(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -8 }}>Estado actual: <strong>{animal.status}</strong></p>
                <div>
                  <label className="fl">Nuevo estado *</label>
                  <select className="fi" value={newStatus} onChange={e => { setNewStatus(e.target.value); if (e.target.value !== "SOLD") setSalePrice(""); }} required>
                    <option value="">Seleccionar…</option>
                    {["SOLD","DEAD","LOST","INACTIVE"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                {newStatus === "SOLD" && (
                  <div>
                    <label className="fl">Precio de venta (opcional)</label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--muted)" }}>$</span>
                      <input className="fi" type="number" step="0.01" min="0" value={salePrice}
                        onChange={e => setSalePrice(e.target.value)} placeholder="0.00"
                        style={{ paddingLeft: 24 }} />
                    </div>
                    <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 4 }}>Registra el valor de la venta para el seguimiento de costos.</p>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" className="btn-danger" disabled={busy || !newStatus} style={{ flex: 1 }}>{busy ? "Guardando…" : newStatus === "SOLD" ? "Registrar venta" : "Confirmar"}</button>
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
