"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "../../lib/cn";

interface AgroFarm {
  id: string;
  name: string;
  operationType: "LIVESTOCK" | "MIXED" | "CROP";
  locationLabel?: string;
  createdAt: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  return (json as { data: T }).data;
}

const OP_TYPE_LABEL: Record<string, string> = {
  LIVESTOCK: "Ganadería",
  MIXED: "Mixta",
  CROP: "Cultivos",
};

export default function AgroPage() {
  const [farms, setFarms] = useState<AgroFarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [operationType, setOperationType] = useState<"LIVESTOCK" | "MIXED" | "CROP">("LIVESTOCK");
  const [locationLabel, setLocationLabel] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { farms: list } = await apiFetch<{ farms: AgroFarm[] }>("/api/semse/agro/farms");
      setFarms(list);
    } catch (err: any) {
      setError(err?.message ?? "Error cargando fincas");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await apiFetch("/api/semse/agro/farms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), operationType, locationLabel: locationLabel.trim() || undefined }),
      });
      setShowCreate(false);
      setName("");
      setLocationLabel("");
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error creando finca");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--ink)]">SEMSE Agro</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Gestión de fincas y operaciones ganaderas</p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + Nueva finca
        </button>
      </div>

      {showCreate && (
        <form onSubmit={(e) => void handleCreate(e)} className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Crear finca</h2>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Nombre *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              placeholder="Mi finca"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Tipo de operación</label>
            <select
              value={operationType}
              onChange={(e) => setOperationType(e.target.value as any)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            >
              <option value="LIVESTOCK">Ganadería</option>
              <option value="MIXED">Mixta</option>
              <option value="CROP">Cultivos</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Ubicación</label>
            <input
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              placeholder="Departamento, País"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {creating ? "Creando..." : "Crear"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-[var(--muted)]">Cargando...</div>
      ) : farms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
          <p className="text-sm text-[var(--muted)]">No tienes fincas registradas.</p>
          <button onClick={() => setShowCreate(true)} className="mt-3 text-sm text-[var(--accent)] underline">
            Crear tu primera finca
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {farms.map((farm) => (
            <Link
              key={farm.id}
              href={`/agro/${farm.id}`}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--accent)] hover:shadow-sm transition-all"
            >
              <div className="mb-2 flex items-start justify-between">
                <h3 className="text-sm font-semibold text-[var(--ink)]">{farm.name}</h3>
                <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-xs text-[var(--accent)]">
                  {OP_TYPE_LABEL[farm.operationType] ?? farm.operationType}
                </span>
              </div>
              {farm.locationLabel && (
                <p className="text-xs text-[var(--muted)]">{farm.locationLabel}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
