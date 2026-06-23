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

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:   "bg-green-100 text-green-700",
  SOLD:     "bg-gray-100 text-gray-600",
  DEAD:     "bg-red-100 text-red-700",
  LOST:     "bg-amber-100 text-amber-700",
  INACTIVE: "bg-gray-100 text-gray-500",
};

export default function AnimalsPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"animals" | "groups">("animals");

  useEffect(() => {
    if (!farmId) return;
    void load();
  }, [farmId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [animalsRes, groupsRes] = await Promise.all([
        fetch(`/api/semse/agro/farms/${farmId}/animals`),
        fetch(`/api/semse/agro/farms/${farmId}/animals?groups=true`),
      ]);
      const animalsJson = await animalsRes.json();
      if (!animalsRes.ok) throw new Error(animalsJson?.error?.message ?? "Error");
      setAnimals((animalsJson.data as any)?.animals ?? []);

      // Groups use a separate endpoint — best effort
      try {
        const groupsJson = await groupsRes.json();
        setGroups((groupsJson.data as any)?.groups ?? []);
      } catch {
        // groups are secondary
      }
    } catch (err: any) {
      setError(err?.message ?? "Error cargando animales");
    } finally {
      setLoading(false);
    }
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
      </div>

      <div className="mb-4 flex gap-1">
        {(["animals", "groups"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              tab === t
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:bg-[var(--surface)]"
            }`}
          >
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
                  {["Tag", "Especie", "Raza", "Sexo", "Peso (kg)", "Estado"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {animals.map((a) => (
                  <tr key={a.id} className="hover:bg-[var(--surface)]">
                    <td className="px-4 py-2 font-mono text-xs">{a.tagCode ?? "—"}</td>
                    <td className="px-4 py-2">{a.species}</td>
                    <td className="px-4 py-2 text-[var(--muted)]">{a.breed ?? "—"}</td>
                    <td className="px-4 py-2">{a.sex}</td>
                    <td className="px-4 py-2">{a.currentWeight != null ? Number(a.currentWeight).toFixed(1) : "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status] ?? ""}`}>
                        {a.status}
                      </span>
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
                {g.averageWeight != null && (
                  <p className="text-xs text-[var(--muted)]">Peso prom: {Number(g.averageWeight).toFixed(1)} kg</p>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </main>
  );
}
