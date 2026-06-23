"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  minimumStock?: number;
}

const CAT_ICON: Record<string, string> = {
  FEED: "🌾", MEDICINE: "💊", VACCINE: "💉", FERTILIZER: "🌱", SEED: "🫘",
  FUEL: "⛽", TOOL: "🔧", MATERIAL: "📦", EQUIPMENT: "⚙️", OTHER: "📋",
};

export default function InventoryPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!farmId) return;
    void load();
  }, [farmId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/inventory`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      setItems((json.data as any)?.items ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Error cargando inventario");
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
        <span className="text-[var(--ink)]">Inventario</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--ink)]">Inventario</h1>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm text-[var(--muted)]">Cargando...</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Sin items de inventario registrados.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface)] text-xs text-[var(--muted)]">
              <tr>
                {["Categoría", "Nombre", "Unidad", "Stock mínimo"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-[var(--surface)]">
                  <td className="px-4 py-2">
                    <span title={item.category}>{CAT_ICON[item.category] ?? "📋"} {item.category}</span>
                  </td>
                  <td className="px-4 py-2 font-medium text-[var(--ink)]">{item.name}</td>
                  <td className="px-4 py-2 text-[var(--muted)]">{item.unit}</td>
                  <td className="px-4 py-2 text-[var(--muted)]">
                    {item.minimumStock != null ? item.minimumStock : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
