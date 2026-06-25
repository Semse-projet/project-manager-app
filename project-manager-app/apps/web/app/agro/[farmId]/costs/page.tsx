"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface CostEntry {
  id: string;
  category: string;
  amount: number;
  currency: string;
  description?: string;
  occurredAt: string;
  targetType: string;
}

const CAT_ICON: Record<string, string> = {
  FEED: "🌾", VETERINARY: "🩺", LABOR: "👷", EQUIPMENT: "⚙️",
  TRANSPORT: "🚛", INFRASTRUCTURE: "🏗️", SEED: "🫘", FERTILIZER: "🌱",
  FUEL: "⛽", OTHER: "📋",
};

const COST_CATS = ["FEED","VETERINARY","LABOR","EQUIPMENT","TRANSPORT","INFRASTRUCTURE","SEED","FERTILIZER","FUEL","OTHER"];

export default function CostsPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const [costs, setCosts]     = useState<CostEntry[]>([]);
  const [catSummary, setCatSummary] = useState<{ category: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy]           = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [newCat, setNewCat]     = useState("FEED");
  const [newAmt, setNewAmt]     = useState("");
  const [newDesc, setNewDesc]   = useState("");
  const [newDate, setNewDate]   = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [cr, sr] = await Promise.all([
        fetch(`/api/semse/agro/farms/${farmId}/costs`),
        fetch(`/api/semse/agro/farms/${farmId}/costs/summary`),
      ]);
      const cj = await cr.json();
      if (!cr.ok) throw new Error(cj?.error?.message ?? "Error");
      setCosts((cj.data as any)?.costs ?? []);
      try {
        const sj = await sr.json();
        setCatSummary((sj.data as any)?.summary ?? []);
      } catch { /* best-effort */ }
    } catch (err: any) {
      setError(err?.message ?? "Error cargando costos");
    } finally {
      setLoading(false);
    }
  }

  function closeModal() { setShowModal(false); setFormError(null); setBusy(false); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newAmt) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/costs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType: "FARM",
          category: newCat,
          amount: parseFloat(newAmt),
          description: newDesc || undefined,
          occurredAt: newDate ? new Date(newDate).toISOString() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setNewCat("FEED"); setNewAmt(""); setNewDesc(""); setNewDate(new Date().toISOString().split("T")[0]);
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  const total = costs.reduce((s, c) => s + Number(c.amount), 0);
  const topCats = catSummary.length > 0
    ? catSummary.sort((a, b) => b.total - a.total).slice(0, 2)
    : costs.reduce<{ category: string; total: number }[]>((acc, c) => {
        const ex = acc.find((x) => x.category === c.category);
        if (ex) ex.total += Number(c.amount);
        else acc.push({ category: c.category, total: Number(c.amount) });
        return acc;
      }, []).sort((a, b) => b.total - a.total).slice(0, 2);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-6 flex items-center gap-2 text-xs text-[var(--muted)]">
        <Link href="/agro" className="hover:text-[var(--accent)]">Agro</Link>
        <span>/</span>
        <Link href={`/agro/${farmId}`} className="hover:text-[var(--accent)]">Finca</Link>
        <span>/</span>
        <span className="text-[var(--ink)]">Costos</span>
      </nav>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--ink)]">Registro de costos</h1>
        <button onClick={() => setShowModal(true)}
          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
          + Registrar costo
        </button>
      </div>

      {/* Summary cards */}
      {costs.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-xs text-[var(--muted)]">Total registrado</p>
            <p className="mt-1 text-2xl font-bold text-[var(--ink)]">${total.toFixed(2)}</p>
          </div>
          {topCats.map(({ category, total: amt }) => (
            <div key={category} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs text-[var(--muted)]">{CAT_ICON[category]} {category}</p>
              <p className="mt-1 text-xl font-semibold text-[var(--ink)]">${Number(amt).toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm text-[var(--muted)]">Cargando...</div>
      ) : costs.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Sin costos registrados.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface)] text-xs text-[var(--muted)]">
              <tr>
                {["Fecha","Categoría","Descripción","Monto"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {costs.map((c) => (
                <tr key={c.id} className="hover:bg-[var(--surface)]">
                  <td className="px-4 py-2 text-xs text-[var(--muted)]">
                    {new Date(c.occurredAt).toLocaleDateString("es-MX")}
                  </td>
                  <td className="px-4 py-2">
                    <span>{CAT_ICON[c.category] ?? "📋"} {c.category}</span>
                  </td>
                  <td className="px-4 py-2 text-[var(--muted)]">{c.description ?? "—"}</td>
                  <td className="px-4 py-2 font-medium text-[var(--ink)]">
                    ${Number(c.amount).toFixed(2)} {c.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={closeModal}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-base font-semibold">Registrar costo</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Categoría *</label>
                <select value={newCat} onChange={(e) => setNewCat(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                  {COST_CATS.map((c) => <option key={c} value={c}>{CAT_ICON[c]} {c}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Monto *</label>
                <input type="number" step="0.01" min="0" value={newAmt} onChange={(e) => setNewAmt(e.target.value)} required autoFocus
                  placeholder="0.00"
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Descripción</label>
                <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Ej. Compra de vacuna aftosa"
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Fecha</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
              </div>
              {formError && <p className="text-xs text-red-600">{formError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-[var(--border)] py-2 text-sm">Cancelar</button>
                <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm text-white disabled:opacity-50">
                  {busy ? "Guardando..." : "Registrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
