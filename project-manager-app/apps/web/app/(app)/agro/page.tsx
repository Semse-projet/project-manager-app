"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Leaf, MapPin, ChevronRight, X } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { listFarms, createFarm, type AgroFarm } from "../../semse-api";

const OP_TYPE_LABELS: Record<string, string> = {
  LIVESTOCK: "Ganadería",
  MIXED: "Mixta",
  CROP: "Cultivo",
};

const OP_TYPE_COLORS: Record<string, string> = {
  LIVESTOCK: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  MIXED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  CROP: "bg-green-500/10 text-green-400 border-green-500/20",
};

function CreateFarmModal({ onClose, onCreated }: { onClose: () => void; onCreated: (farm: AgroFarm) => void }) {
  const [name, setName] = useState("");
  const [operationType, setOperationType] = useState<"LIVESTOCK" | "MIXED" | "CROP">("LIVESTOCK");
  const [locationLabel, setLocationLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const farm = await createFarm({
        name: name.trim(),
        operationType,
        locationLabel: locationLabel.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onCreated(farm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la finca");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#1a1a2e] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-ink">Nueva Finca</h2>
          <button onClick={onClose} className="text-muted hover:text-ink transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-6">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wider">Nombre *</label>
            <input
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand/50 focus:outline-none"
              placeholder="Ej. Finca El Paraíso"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wider">Tipo de Operación</label>
            <select
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink focus:border-brand/50 focus:outline-none"
              value={operationType}
              onChange={(e) => setOperationType(e.target.value as "LIVESTOCK" | "MIXED" | "CROP")}
            >
              <option value="LIVESTOCK">Ganadería</option>
              <option value="MIXED">Mixta</option>
              <option value="CROP">Cultivo</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wider">Ubicación</label>
            <input
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand/50 focus:outline-none"
              placeholder="Ej. Vereda La Esperanza, Antioquia"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wider">Notas</label>
            <textarea
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand/50 focus:outline-none"
              rows={3}
              placeholder="Descripción opcional..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-muted hover:text-ink transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 rounded-lg bg-brand py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-brand/90 transition-colors"
            >
              {loading ? "Creando..." : "Crear Finca"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AgroPage() {
  const [farms, setFarms] = useState<AgroFarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    let alive = true;
    void listFarms().then((data) => { if (alive) { setFarms(data); setLoading(false); } }).catch((err) => { if (alive) { setError(err instanceof Error ? err.message : "Error"); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <section className="flex items-start justify-between gap-4">
          <div className="grid gap-2">
            <Badge variant="brand" className="w-fit">SEMSE Agro</Badge>
            <h1 className="text-3xl font-bold tracking-tight text-ink">Mis Fincas</h1>
            <p className="text-sm text-muted">Gestiona tus predios agrícolas, potreros y unidades productivas.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
          >
            <Plus size={16} />
            Nueva Finca
          </button>
        </section>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {loading && <p className="text-sm text-muted">Cargando fincas...</p>}

        {!loading && farms.length === 0 && !error && (
          <Card className="flex flex-col items-center gap-4 py-16 text-center">
            <Leaf size={40} className="text-muted/40" />
            <div>
              <p className="font-medium text-ink">Sin fincas registradas</p>
              <p className="mt-1 text-sm text-muted">Crea tu primera finca para comenzar a gestionar tus predios.</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
            >
              <Plus size={16} />
              Crear primera finca
            </button>
          </Card>
        )}

        {farms.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {farms.map((farm) => (
              <Link key={farm.id} href={`/agro/${farm.id}`}>
                <Card className="group cursor-pointer border-white/5 hover:border-brand/20 hover:bg-brand/[0.03] transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${OP_TYPE_COLORS[farm.operationType] ?? "bg-white/5 text-muted border-white/10"}`}>
                          {OP_TYPE_LABELS[farm.operationType] ?? farm.operationType}
                        </span>
                      </div>
                      <p className="truncate font-semibold text-ink">{farm.name}</p>
                      {farm.locationLabel && (
                        <div className="flex items-center gap-1 text-xs text-muted">
                          <MapPin size={12} />
                          <span className="truncate">{farm.locationLabel}</span>
                        </div>
                      )}
                      {farm.notes && (
                        <p className="line-clamp-2 text-xs text-muted">{farm.notes}</p>
                      )}
                    </div>
                    <ChevronRight size={16} className="mt-1 shrink-0 text-muted/40 group-hover:text-brand transition-colors" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateFarmModal
          onClose={() => setShowCreate(false)}
          onCreated={(farm) => {
            setFarms((prev) => [farm, ...prev]);
            setShowCreate(false);
          }}
        />
      )}
    </main>
  );
}
