"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Layers, MapPin, Edit2, X, Check } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import {
  getFarm, updateFarm, listFarmUnits, createFarmUnit,
  type AgroFarm, type AgroFarmUnit,
} from "../../../semse-api";

const UNIT_TYPE_LABELS: Record<string, string> = {
  PASTURE: "Potrero",
  CORRAL: "Corral",
  BARN: "Establo",
  STORAGE: "Bodega",
  WATER_SOURCE: "Fuente de Agua",
  WORK_AREA: "Área de Trabajo",
  FIELD: "Campo",
  GREENHOUSE: "Invernadero",
  OTHER: "Otro",
};

const AREA_UNIT_LABELS: Record<string, string> = {
  SQFT: "ft²",
  ACRE: "acres",
  HECTARE: "ha",
  MANZANA: "mz",
  OTHER: "",
};

function AddUnitModal({ farmId, onClose, onCreated }: { farmId: string; onClose: () => void; onCreated: (u: AgroFarmUnit) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("PASTURE");
  const [areaValue, setAreaValue] = useState("");
  const [areaUnit, setAreaUnit] = useState("HECTARE");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const unit = await createFarmUnit(farmId, {
        name: name.trim(),
        type,
        areaValue: areaValue ? Number(areaValue) : undefined,
        areaUnit: areaValue ? areaUnit : undefined,
        notes: notes.trim() || undefined,
      });
      onCreated(unit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear unidad");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#1a1a2e] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-ink">Nueva Unidad</h2>
          <button onClick={onClose} className="text-muted hover:text-ink transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-6">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wider">Nombre *</label>
            <input
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand/50 focus:outline-none"
              placeholder="Ej. Potrero Norte"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wider">Tipo</label>
            <select className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink focus:border-brand/50 focus:outline-none" value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(UNIT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wider">Área</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand/50 focus:outline-none"
                placeholder="0.00"
                value={areaValue}
                onChange={(e) => setAreaValue(e.target.value)}
              />
            </div>
            <div className="w-28 space-y-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wider">Unidad</label>
              <select className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink focus:border-brand/50 focus:outline-none" value={areaUnit} onChange={(e) => setAreaUnit(e.target.value)}>
                <option value="HECTARE">Hectárea</option>
                <option value="ACRE">Acre</option>
                <option value="MANZANA">Manzana</option>
                <option value="SQFT">ft²</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wider">Notas</label>
            <textarea className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand/50 focus:outline-none" rows={2} placeholder="Descripción opcional..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-muted hover:text-ink transition-colors">Cancelar</button>
            <button type="submit" disabled={loading || !name.trim()} className="flex-1 rounded-lg bg-brand py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-brand/90 transition-colors">
              {loading ? "Guardando..." : "Crear Unidad"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InlineEdit({ value, onSave }: { value: string; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!draft.trim() || draft === value) { setEditing(false); return; }
    setLoading(true);
    await onSave(draft.trim());
    setLoading(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button onClick={() => { setDraft(value); setEditing(true); }} className="group flex items-center gap-2">
        <span className="text-3xl font-bold tracking-tight text-ink">{value}</span>
        <Edit2 size={16} className="text-muted/40 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        className="rounded-lg border border-brand/50 bg-white/5 px-3 py-1 text-2xl font-bold text-ink focus:outline-none"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") setEditing(false); }}
      />
      <button onClick={() => void save()} disabled={loading} className="text-brand hover:text-brand/80 disabled:opacity-50">
        <Check size={18} />
      </button>
      <button onClick={() => setEditing(false)} className="text-muted hover:text-ink">
        <X size={18} />
      </button>
    </div>
  );
}

export default function FarmDetailPage({ params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = use(params);
  const [farm, setFarm] = useState<AgroFarm | null>(null);
  const [units, setUnits] = useState<AgroFarmUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddUnit, setShowAddUnit] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getFarm(farmId), listFarmUnits(farmId)])
      .then(([f, u]) => { if (alive) { setFarm(f); setUnits(u); setLoading(false); } })
      .catch((err) => { if (alive) { setError(err instanceof Error ? err.message : "Error"); setLoading(false); } });
    return () => { alive = false; };
  }, [farmId]);

  async function saveName(name: string) {
    if (!farm) return;
    const updated = await updateFarm(farm.id, { name });
    setFarm(updated);
  }

  if (loading) return <main className="px-6 py-8 text-sm text-muted">Cargando...</main>;
  if (error) return <main className="px-6 py-8 text-sm text-red-400">{error}</main>;
  if (!farm) return null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="grid gap-8">
        <div className="flex flex-col gap-4">
          <Link href="/agro" className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors">
            <ArrowLeft size={14} />
            Mis Fincas
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="brand" className="w-fit">SEMSE Agro</Badge>
                <span className="text-xs text-muted border border-white/10 rounded-full px-2 py-0.5">
                  {farm.operationType === "LIVESTOCK" ? "Ganadería" : farm.operationType === "MIXED" ? "Mixta" : "Cultivo"}
                </span>
              </div>
              <InlineEdit value={farm.name} onSave={saveName} />
              {farm.locationLabel && (
                <div className="flex items-center gap-1.5 text-sm text-muted">
                  <MapPin size={14} />
                  {farm.locationLabel}
                </div>
              )}
              {farm.notes && <p className="max-w-2xl text-sm text-muted">{farm.notes}</p>}
            </div>
          </div>
        </div>

        <section className="grid gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Unidades ({units.length})</h2>
            <button
              onClick={() => setShowAddUnit(true)}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-muted hover:border-brand/30 hover:text-ink transition-all"
            >
              <Plus size={14} />
              Agregar unidad
            </button>
          </div>

          {units.length === 0 ? (
            <Card className="flex flex-col items-center gap-4 py-12 text-center">
              <Layers size={32} className="text-muted/40" />
              <div>
                <p className="font-medium text-ink">Sin unidades registradas</p>
                <p className="mt-1 text-sm text-muted">Agrega potreros, corrales, bodegas y otras áreas de esta finca.</p>
              </div>
              <button onClick={() => setShowAddUnit(true)} className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors">
                <Plus size={16} /> Agregar primera unidad
              </button>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {units.map((unit) => (
                <Card key={unit.id} className="border-white/5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-muted">
                        {UNIT_TYPE_LABELS[unit.type] ?? unit.type}
                      </span>
                    </div>
                    <p className="font-semibold text-ink">{unit.name}</p>
                    {unit.areaValue && (
                      <p className="text-xs text-muted">
                        {Number(unit.areaValue).toLocaleString("es-CO")} {AREA_UNIT_LABELS[unit.areaUnit ?? ""] ?? unit.areaUnit}
                      </p>
                    )}
                    {unit.notes && <p className="line-clamp-2 text-xs text-muted">{unit.notes}</p>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      {showAddUnit && (
        <AddUnitModal
          farmId={farmId}
          onClose={() => setShowAddUnit(false)}
          onCreated={(u) => { setUnits((prev) => [...prev, u]); setShowAddUnit(false); }}
        />
      )}
    </main>
  );
}
