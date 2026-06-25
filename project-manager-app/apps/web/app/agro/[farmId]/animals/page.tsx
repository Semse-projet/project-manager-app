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
  estimatedAgeMonths?: number;
  currentUnitId?: string;
}

interface Group {
  id: string;
  name: string;
  species: string;
  count: number;
  status: string;
  averageWeight?: number;
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

const SPECIES = ["CATTLE","PIG","GOAT","SHEEP","HORSE","CHICKEN","OTHER"];
const SEXES   = ["MALE","FEMALE","UNKNOWN"];

export default function AnimalsPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const [animals, setAnimals]   = useState<Animal[]>([]);
  const [groups, setGroups]     = useState<Group[]>([]);
  const [units, setUnits]       = useState<FarmUnit[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [tab, setTab]           = useState<"animals" | "groups">("animals");

  // modal state
  const [modal, setModal] = useState<
    | { type: "create-animal" }
    | { type: "create-group" }
    | { type: "weigh";  animal: Animal }
    | { type: "move";   animal: Animal }
    | { type: "status"; animal: Animal }
    | { type: "adjust"; group: Group }
    | null
  >(null);

  const [busy, setBusy]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // create animal form
  const [newSpecies, setNewSpecies]   = useState("CATTLE");
  const [newSex, setNewSex]           = useState("UNKNOWN");
  const [newTag, setNewTag]           = useState("");
  const [newBreed, setNewBreed]       = useState("");
  const [newWeight, setNewWeight]     = useState("");

  // create group form
  const [grpName, setGrpName]         = useState("");
  const [grpSpecies, setGrpSpecies]   = useState("CATTLE");
  const [grpCount, setGrpCount]       = useState("");
  const [grpWeight, setGrpWeight]     = useState("");

  // weigh form
  const [weighVal, setWeighVal] = useState("");

  // move form
  const [moveUnit, setMoveUnit] = useState("");

  // status form
  const [newStatus, setNewStatus] = useState("");

  // adjust count form
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [ar, gr, ur] = await Promise.all([
        fetch(`/api/semse/agro/farms/${farmId}/animals`),
        fetch(`/api/semse/agro/farms/${farmId}/animals?groups=true`),
        fetch(`/api/semse/agro/${farmId}/units`),
      ]);
      const aj = await ar.json();
      if (!ar.ok) throw new Error(aj?.error?.message ?? "Error animales");
      setAnimals((aj.data as any)?.animals ?? []);
      try {
        const gj = await gr.json();
        setGroups((gj.data as any)?.groups ?? []);
      } catch { /* grupos secundario */ }
      try {
        const uj = await ur.json();
        setUnits((uj.data as any)?.units ?? []);
      } catch { /* units secundario */ }
    } catch (err: any) {
      setError(err?.message ?? "Error cargando animales");
    } finally {
      setLoading(false);
    }
  }

  function closeModal() { setModal(null); setFormError(null); setBusy(false); }

  async function handleCreateAnimal(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/animals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          species: newSpecies, sex: newSex,
          tagCode: newTag || undefined,
          breed: newBreed || undefined,
          initialWeight: newWeight ? parseFloat(newWeight) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setNewSpecies("CATTLE"); setNewSex("UNKNOWN"); setNewTag(""); setNewBreed(""); setNewWeight("");
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!grpName.trim() || !grpCount) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/animals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          _isGroup: true,
          name: grpName, species: grpSpecies,
          count: parseInt(grpCount, 10),
          averageWeight: grpWeight ? parseFloat(grpWeight) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setGrpName(""); setGrpSpecies("CATTLE"); setGrpCount(""); setGrpWeight("");
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function handleWeigh(e: React.FormEvent) {
    e.preventDefault();
    if (modal?.type !== "weigh" || !weighVal) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/animals/${modal.animal.id}/weigh`, {
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
    if (modal?.type !== "move") return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/animals/${modal.animal.id}/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUnitId: moveUnit || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setMoveUnit(""); closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function handleStatusChange(e: React.FormEvent) {
    e.preventDefault();
    if (modal?.type !== "status" || !newStatus) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/animals/${modal.animal.id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setNewStatus(""); closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function handleAdjustCount(e: React.FormEvent) {
    e.preventDefault();
    if (modal?.type !== "adjust" || !adjustDelta) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/animal-groups/${modal.group.id}/adjust-count`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ delta: parseInt(adjustDelta, 10), reason: adjustReason || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setAdjustDelta(""); setAdjustReason(""); closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-6 flex items-center gap-2 text-xs text-[var(--muted)]">
        <Link href="/agro" className="hover:text-[var(--accent)]">Agro</Link>
        <span>/</span>
        <Link href={`/agro/${farmId}`} className="hover:text-[var(--accent)]">Finca</Link>
        <span>/</span>
        <span className="text-[var(--ink)]">Animales</span>
      </nav>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--ink)]">Animales</h1>
        <button
          onClick={() => setModal(tab === "animals" ? { type: "create-animal" } : { type: "create-group" })}
          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          + {tab === "animals" ? "Nuevo animal" : "Nuevo grupo"}
        </button>
      </div>

      <div className="mb-4 flex gap-1">
        {(["animals", "groups"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${tab === t ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:bg-[var(--surface)]"}`}>
            {t === "animals" ? "Individuales" : "Grupos"}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm text-[var(--muted)]">Cargando...</div>
      ) : tab === "animals" ? (
        animals.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Sin animales registrados.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface)] text-xs text-[var(--muted)]">
                <tr>
                  {["Tag","Especie","Raza","Sexo","Peso (kg)","Estado",""].map((h) => (
                    <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {animals.map((a) => (
                  <tr key={a.id} className="hover:bg-[var(--surface)]">
                    <td className="px-4 py-2 font-mono text-xs">
                      <Link href={`/agro/${farmId}/animals/${a.id}`} className="hover:text-[var(--accent)] hover:underline">
                        {a.tagCode ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{a.species}</td>
                    <td className="px-4 py-2 text-[var(--muted)]">{a.breed ?? "—"}</td>
                    <td className="px-4 py-2">{a.sex}</td>
                    <td className="px-4 py-2">{a.currentWeight != null ? Number(a.currentWeight).toFixed(1) : "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status] ?? ""}`}>{a.status}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => { setWeighVal(""); setModal({ type: "weigh", animal: a }); }}
                          className="rounded px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]" title="Pesar">⚖️</button>
                        <button onClick={() => { setMoveUnit(a.currentUnitId ?? ""); setModal({ type: "move", animal: a }); }}
                          className="rounded px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]" title="Mover">📍</button>
                        {a.status === "ACTIVE" && (
                          <button onClick={() => { setNewStatus(""); setModal({ type: "status", animal: a }); }}
                            className="rounded px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]" title="Cambiar estado">🔄</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        groups.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Sin grupos registrados.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--ink)]">{g.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[g.status] ?? ""}`}>{g.status}</span>
                </div>
                <p className="text-xs text-[var(--muted)]">{g.species} · {g.count} animales</p>
                {g.averageWeight != null && <p className="text-xs text-[var(--muted)]">Peso prom: {Number(g.averageWeight).toFixed(1)} kg</p>}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => { setAdjustDelta(""); setAdjustReason(""); setModal({ type: "adjust", group: g }); }}
                    className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--ink)]">
                    Ajustar conteo
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Modales ─────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={closeModal}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>

            {/* Create animal */}
            {modal.type === "create-animal" && (
              <>
                <h2 className="mb-4 text-base font-semibold">Nuevo animal</h2>
                <form onSubmit={handleCreateAnimal} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Especie *</label>
                    <select value={newSpecies} onChange={(e) => setNewSpecies(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                      {SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Sexo *</label>
                    <select value={newSex} onChange={(e) => setNewSex(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                      {SEXES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Código de tag</label>
                    <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Ej. MX-001"
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Raza</label>
                    <input value={newBreed} onChange={(e) => setNewBreed(e.target.value)} placeholder="Ej. Angus"
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Peso inicial (kg)</label>
                    <input type="number" step="0.1" min="0" value={newWeight} onChange={(e) => setNewWeight(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  {formError && <p className="text-xs text-red-600">{formError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-[var(--border)] py-2 text-sm">Cancelar</button>
                    <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm text-white disabled:opacity-50">
                      {busy ? "Guardando..." : "Crear"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Create group */}
            {modal.type === "create-group" && (
              <>
                <h2 className="mb-4 text-base font-semibold">Nuevo grupo</h2>
                <form onSubmit={handleCreateGroup} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Nombre del grupo *</label>
                    <input value={grpName} onChange={(e) => setGrpName(e.target.value)} required placeholder="Ej. Lote Norte"
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Especie *</label>
                    <select value={grpSpecies} onChange={(e) => setGrpSpecies(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                      {SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Cantidad *</label>
                    <input type="number" min="1" value={grpCount} onChange={(e) => setGrpCount(e.target.value)} required
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Peso promedio (kg)</label>
                    <input type="number" step="0.1" min="0" value={grpWeight} onChange={(e) => setGrpWeight(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  {formError && <p className="text-xs text-red-600">{formError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-[var(--border)] py-2 text-sm">Cancelar</button>
                    <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm text-white disabled:opacity-50">
                      {busy ? "Guardando..." : "Crear"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Weigh */}
            {modal.type === "weigh" && (
              <>
                <h2 className="mb-1 text-base font-semibold">Registrar pesaje</h2>
                <p className="mb-4 text-xs text-[var(--muted)]">{modal.animal.tagCode ?? modal.animal.species}</p>
                <form onSubmit={handleWeigh} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Peso (kg) *</label>
                    <input type="number" step="0.1" min="0" value={weighVal} onChange={(e) => setWeighVal(e.target.value)} required autoFocus
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  {formError && <p className="text-xs text-red-600">{formError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-[var(--border)] py-2 text-sm">Cancelar</button>
                    <button type="submit" disabled={busy || !weighVal} className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm text-white disabled:opacity-50">
                      {busy ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Move */}
            {modal.type === "move" && (
              <>
                <h2 className="mb-1 text-base font-semibold">Mover animal</h2>
                <p className="mb-4 text-xs text-[var(--muted)]">{modal.animal.tagCode ?? modal.animal.species}</p>
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
                    <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm text-white disabled:opacity-50">
                      {busy ? "Moviendo..." : "Mover"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Status change */}
            {modal.type === "status" && (
              <>
                <h2 className="mb-1 text-base font-semibold">Cambiar estado</h2>
                <p className="mb-4 text-xs text-[var(--muted)]">{modal.animal.tagCode ?? modal.animal.species} — actual: {modal.animal.status}</p>
                <form onSubmit={handleStatusChange} className="space-y-3">
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
                    <button type="submit" disabled={busy || !newStatus} className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm text-white disabled:opacity-50">
                      {busy ? "Guardando..." : "Confirmar"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Adjust group count */}
            {modal.type === "adjust" && (
              <>
                <h2 className="mb-1 text-base font-semibold">Ajustar conteo</h2>
                <p className="mb-4 text-xs text-[var(--muted)]">{modal.group.name} — actual: {modal.group.count}</p>
                <form onSubmit={handleAdjustCount} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Delta (positivo o negativo) *</label>
                    <input type="number" value={adjustDelta} onChange={(e) => setAdjustDelta(e.target.value)} required autoFocus
                      placeholder="Ej. -3 o +5"
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Razón</label>
                    <input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Venta, muerte, nacimiento..."
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  {formError && <p className="text-xs text-red-600">{formError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-[var(--border)] py-2 text-sm">Cancelar</button>
                    <button type="submit" disabled={busy || !adjustDelta} className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm text-white disabled:opacity-50">
                      {busy ? "Guardando..." : "Ajustar"}
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
