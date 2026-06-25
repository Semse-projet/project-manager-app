"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Animal {
  id: string;
  tagCode?: string;
  species: string;
  breed?: string;
  sex: string;
  status: string;
  currentWeight?: number;
  initialWeight?: number;
  estimatedAgeMonths?: number;
  birthDate?: string;
  acquisitionDate?: string;
  acquisitionCost?: number;
  notes?: string;
  currentUnitId?: string;
}

interface TimelineEvent {
  id: string;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: string;
  actorId?: string;
}

interface FarmUnit {
  id: string;
  name: string;
  type: string;
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:   "bg-green-100 text-green-700",
  SOLD:     "bg-gray-100 text-gray-600",
  DEAD:     "bg-red-100 text-red-700",
  LOST:     "bg-amber-100 text-amber-700",
  INACTIVE: "bg-gray-100 text-gray-500",
};

const ACTION_LABELS: Record<string, string> = {
  "animal.created":       "Registro creado",
  "animal.updated":       "Datos actualizados",
  "animal.weighed":       "Pesaje registrado",
  "animal.moved":         "Movimiento de unidad",
  "animal.status_changed":"Cambio de estado",
};

export default function AnimalDetailPage() {
  const { farmId, animalId } = useParams<{ farmId: string; animalId: string }>();
  const [animal, setAnimal]     = useState<Animal | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [units, setUnits]       = useState<FarmUnit[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  type ModalType =
    | { type: "weigh" }
    | { type: "move" }
    | { type: "status" };
  const [modal, setModal]         = useState<ModalType | null>(null);
  const [busy, setBusy]           = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [weighVal, setWeighVal]   = useState("");
  const [moveUnit, setMoveUnit]   = useState("");
  const [newStatus, setNewStatus] = useState("");

  useEffect(() => {
    if (animalId && farmId) void load();
  }, [animalId, farmId]);

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
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  function closeModal() { setModal(null); setFormError(null); setBusy(false); }

  async function handleWeigh(e: React.FormEvent) {
    e.preventDefault();
    if (!weighVal) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/animals/${animalId}/weigh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weight: parseFloat(weighVal) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setWeighVal(""); closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function handleMove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/animals/${animalId}/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUnitId: moveUnit || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setMoveUnit(""); closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function handleStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!newStatus) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/animals/${animalId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setNewStatus(""); closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  if (loading) return <main className="mx-auto max-w-3xl px-4 py-8 text-sm text-[var(--muted)]">Cargando...</main>;
  if (error || !animal) return <main className="mx-auto max-w-3xl px-4 py-8 text-sm text-red-600">{error ?? "Animal no encontrado"}</main>;

  const weightDelta = animal.currentWeight != null && animal.initialWeight != null
    ? Number(animal.currentWeight) - Number(animal.initialWeight)
    : null;

  const currentUnit = units.find((u) => u.id === animal.currentUnitId);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <nav className="mb-6 flex items-center gap-2 text-xs text-[var(--muted)]">
        <Link href="/agro" className="hover:text-[var(--accent)]">Agro</Link>
        <span>/</span>
        <Link href={`/agro/${farmId}`} className="hover:text-[var(--accent)]">Finca</Link>
        <span>/</span>
        <Link href={`/agro/${farmId}/animals`} className="hover:text-[var(--accent)]">Animales</Link>
        <span>/</span>
        <span className="text-[var(--ink)]">{animal.tagCode ?? animal.species}</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--ink)]">
            {animal.tagCode ? `#${animal.tagCode}` : animal.species}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {animal.species}{animal.breed ? ` · ${animal.breed}` : ""} · {animal.sex}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[animal.status] ?? ""}`}>
          {animal.status}
        </span>
      </div>

      {/* Action buttons */}
      {animal.status === "ACTIVE" && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button onClick={() => { setWeighVal(""); setModal({ type: "weigh" }); }}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface)]">
            ⚖️ Pesar
          </button>
          <button onClick={() => { setMoveUnit(animal.currentUnitId ?? ""); setModal({ type: "move" }); }}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface)]">
            📍 Mover
          </button>
          <button onClick={() => { setNewStatus(""); setModal({ type: "status" }); }}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
            🔄 Cambiar estado
          </button>
        </div>
      )}

      {/* Stats grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs text-[var(--muted)]">Peso actual</p>
          <p className="mt-1 text-xl font-bold text-[var(--ink)]">
            {animal.currentWeight != null ? `${Number(animal.currentWeight).toFixed(1)} kg` : "—"}
          </p>
          {weightDelta != null && (
            <p className={`text-xs mt-1 ${weightDelta >= 0 ? "text-green-600" : "text-red-600"}`}>
              {weightDelta >= 0 ? "+" : ""}{weightDelta.toFixed(1)} kg vs inicial
            </p>
          )}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs text-[var(--muted)]">Peso inicial</p>
          <p className="mt-1 text-xl font-bold text-[var(--ink)]">
            {animal.initialWeight != null ? `${Number(animal.initialWeight).toFixed(1)} kg` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs text-[var(--muted)]">Edad (meses)</p>
          <p className="mt-1 text-xl font-bold text-[var(--ink)]">
            {animal.estimatedAgeMonths ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs text-[var(--muted)]">Ubicación</p>
          <p className="mt-1 text-sm font-semibold text-[var(--ink)] truncate">
            {currentUnit ? currentUnit.name : "Sin asignar"}
          </p>
          {currentUnit && <p className="text-xs text-[var(--muted)]">{currentUnit.type}</p>}
        </div>
      </div>

      {/* Details */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--ink)]">Detalles</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {[
            ["Especie", animal.species],
            ["Raza", animal.breed ?? "—"],
            ["Sexo", animal.sex],
            ["Estado", animal.status],
            ["Nacimiento", animal.birthDate ? new Date(animal.birthDate).toLocaleDateString("es-MX") : "—"],
            ["Adquisición", animal.acquisitionDate ? new Date(animal.acquisitionDate).toLocaleDateString("es-MX") : "—"],
            ["Costo adquisición", animal.acquisitionCost != null ? `$${Number(animal.acquisitionCost).toFixed(2)}` : "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[var(--muted)]">{label}</dt>
              <dd className="font-medium text-[var(--ink)]">{value}</dd>
            </div>
          ))}
        </dl>
        {animal.notes && (
          <div className="mt-3 border-t border-[var(--border)] pt-3">
            <p className="text-xs text-[var(--muted)]">Notas</p>
            <p className="mt-1 text-xs text-[var(--ink)]">{animal.notes}</p>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--ink)]">Historial de actividad</h2>
        {timeline.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">Sin actividad registrada.</p>
        ) : (
          <ol className="relative ml-2 border-l border-[var(--border)]">
            {timeline.map((ev) => {
              const after = ev.after as any;
              return (
                <li key={ev.id} className="mb-4 ml-4">
                  <div className="absolute -left-1.5 h-3 w-3 rounded-full border border-white bg-[var(--accent)]" />
                  <p className="text-xs font-medium text-[var(--ink)]">
                    {ACTION_LABELS[ev.action] ?? ev.action}
                  </p>
                  {ev.action === "animal.weighed" && after?.currentWeight != null && (
                    <p className="text-xs text-[var(--muted)]">Nuevo peso: {Number(after.currentWeight).toFixed(1)} kg</p>
                  )}
                  {ev.action === "animal.moved" && (
                    <p className="text-xs text-[var(--muted)]">
                      Unidad destino: {after?.currentUnitId ?? "Sin asignar"}
                    </p>
                  )}
                  {ev.action === "animal.status_changed" && (
                    <p className="text-xs text-[var(--muted)]">Estado → {after?.status}</p>
                  )}
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {new Date(ev.createdAt).toLocaleString("es-MX")}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Modals */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={closeModal}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>

            {modal.type === "weigh" && (
              <>
                <h2 className="mb-4 text-base font-semibold">Registrar pesaje</h2>
                <form onSubmit={handleWeigh} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Peso (kg) *</label>
                    <input type="number" step="0.1" min="0" value={weighVal}
                      onChange={(e) => setWeighVal(e.target.value)} required autoFocus
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  {formError && <p className="text-xs text-red-600">{formError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-[var(--border)] py-2 text-sm">Cancelar</button>
                    <button type="submit" disabled={busy || !weighVal}
                      className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm text-white disabled:opacity-50">
                      {busy ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {modal.type === "move" && (
              <>
                <h2 className="mb-4 text-base font-semibold">Mover animal</h2>
                <form onSubmit={handleMove} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Destino</label>
                    <select value={moveUnit} onChange={(e) => setMoveUnit(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                      <option value="">Sin unidad asignada</option>
                      {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.type})</option>)}
                    </select>
                  </div>
                  {formError && <p className="text-xs text-red-600">{formError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-[var(--border)] py-2 text-sm">Cancelar</button>
                    <button type="submit" disabled={busy}
                      className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm text-white disabled:opacity-50">
                      {busy ? "Moviendo..." : "Mover"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {modal.type === "status" && (
              <>
                <h2 className="mb-1 text-base font-semibold">Cambiar estado</h2>
                <p className="mb-4 text-xs text-[var(--muted)]">Estado actual: {animal.status}</p>
                <form onSubmit={handleStatus} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Nuevo estado *</label>
                    <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} required
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                      <option value="">Seleccionar...</option>
                      {["SOLD","DEAD","LOST","INACTIVE"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {formError && <p className="text-xs text-red-600">{formError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-[var(--border)] py-2 text-sm">Cancelar</button>
                    <button type="submit" disabled={busy || !newStatus}
                      className="flex-1 rounded-lg bg-red-500 py-2 text-sm text-white disabled:opacity-50">
                      {busy ? "Guardando..." : "Confirmar"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
