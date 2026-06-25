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
  notes?: string;
}

interface StockInfo {
  currentStock: number;
  isLow: boolean;
}

const CAT_ICON: Record<string, string> = {
  FEED: "🌾", MEDICINE: "💊", VACCINE: "💉", FERTILIZER: "🌱", SEED: "🫘",
  FUEL: "⛽", TOOL: "🔧", MATERIAL: "📦", EQUIPMENT: "⚙️", OTHER: "📋",
};

const CATEGORIES = ["FEED","MEDICINE","VACCINE","FERTILIZER","SEED","FUEL","TOOL","MATERIAL","EQUIPMENT","OTHER"];
const UNITS       = ["UNIT","LB","KG","TON","LITER","GALLON","BAG","BOX","DOSE","BOTTLE","OTHER"];
const MOV_TYPES   = [{ v: "IN", label: "Entrada" }, { v: "OUT", label: "Salida" }, { v: "ADJUSTMENT", label: "Ajuste" }];

export default function InventoryPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const [items, setItems]     = useState<InventoryItem[]>([]);
  const [stock, setStock]     = useState<Record<string, StockInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  type ModalType = { type: "create" } | { type: "movement"; item: InventoryItem };
  const [modal, setModal]         = useState<ModalType | null>(null);
  const [busy, setBusy]           = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [newName, setNewName]         = useState("");
  const [newCat, setNewCat]           = useState("FEED");
  const [newUnit, setNewUnit]         = useState("KG");
  const [newMinStock, setNewMinStock] = useState("");

  const [movType, setMovType]   = useState("IN");
  const [movQty, setMovQty]     = useState("");
  const [movNotes, setMovNotes] = useState("");

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/inventory`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      const list: InventoryItem[] = (json.data as any)?.items ?? [];
      setItems(list);
      const stockMap: Record<string, StockInfo> = {};
      await Promise.allSettled(
        list.map(async (item) => {
          try {
            const sr = await fetch(`/api/semse/agro/inventory/${item.id}/stock`);
            if (sr.ok) {
              const sj = await sr.json();
              const s = (sj.data as any);
              stockMap[item.id] = {
                currentStock: s?.currentStock ?? 0,
                isLow: item.minimumStock != null && (s?.currentStock ?? 0) < item.minimumStock,
              };
            }
          } catch { /* best-effort */ }
        }),
      );
      setStock(stockMap);
    } catch (err: any) {
      setError(err?.message ?? "Error cargando inventario");
    } finally {
      setLoading(false);
    }
  }

  function closeModal() { setModal(null); setFormError(null); setBusy(false); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/inventory`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName, category: newCat, unit: newUnit,
          minimumStock: newMinStock ? parseFloat(newMinStock) : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setNewName(""); setNewCat("FEED"); setNewUnit("KG"); setNewMinStock("");
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function handleMovement(e: React.FormEvent) {
    e.preventDefault();
    if (modal?.type !== "movement" || !movQty) return;
    setBusy(true); setFormError(null);
    try {
      const body: Record<string, unknown> = {
        itemId: modal.item.id, movementType: movType,
        notes: movNotes || undefined,
      };
      if (movType === "ADJUSTMENT") body.adjustmentDelta = parseFloat(movQty);
      else body.quantity = parseFloat(movQty);
      const res = await fetch(`/api/semse/agro/farms/${farmId}/movements`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setMovType("IN"); setMovQty(""); setMovNotes("");
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
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

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--ink)]">Inventario</h1>
        <button onClick={() => setModal({ type: "create" })}
          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
          + Nuevo item
        </button>
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
                {["Categoría","Nombre","Unidad","Stock actual","Stock mín.",""].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.map((item) => {
                const s = stock[item.id];
                return (
                  <tr key={item.id} className="hover:bg-[var(--surface)]">
                    <td className="px-4 py-2"><span title={item.category}>{CAT_ICON[item.category] ?? "📋"} {item.category}</span></td>
                    <td className="px-4 py-2 font-medium text-[var(--ink)]">{item.name}</td>
                    <td className="px-4 py-2 text-[var(--muted)]">{item.unit}</td>
                    <td className="px-4 py-2">
                      {s != null ? (
                        <span className={`font-medium ${s.isLow ? "text-red-600" : "text-green-700"}`}>
                          {s.currentStock.toFixed(1)} {s.isLow ? "⚠️" : ""}
                        </span>
                      ) : <span className="text-[var(--muted)]">—</span>}
                    </td>
                    <td className="px-4 py-2 text-[var(--muted)]">{item.minimumStock != null ? item.minimumStock : "—"}</td>
                    <td className="px-4 py-2">
                      <button onClick={() => { setMovType("IN"); setMovQty(""); setMovNotes(""); setModal({ type: "movement", item }); }}
                        className="rounded px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]" title="Movimiento">±</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={closeModal}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>

            {modal.type === "create" && (
              <>
                <h2 className="mb-4 text-base font-semibold">Nuevo item de inventario</h2>
                <form onSubmit={handleCreate} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Nombre *</label>
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus
                      placeholder="Ej. Concentrado bovino"
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Categoría *</label>
                    <select value={newCat} onChange={(e) => setNewCat(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Unidad *</label>
                    <select value={newUnit} onChange={(e) => setNewUnit(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Stock mínimo (alerta)</label>
                    <input type="number" step="0.1" min="0" value={newMinStock} onChange={(e) => setNewMinStock(e.target.value)}
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

            {modal.type === "movement" && (
              <>
                <h2 className="mb-1 text-base font-semibold">Registrar movimiento</h2>
                <p className="mb-4 text-xs text-[var(--muted)]">{modal.item.name} ({modal.item.unit})</p>
                <form onSubmit={handleMovement} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Tipo *</label>
                    <div className="flex gap-2">
                      {MOV_TYPES.map((m) => (
                        <button key={m.v} type="button" onClick={() => setMovType(m.v)}
                          className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${movType === m.v ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] text-[var(--muted)]"}`}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                      {movType === "ADJUSTMENT" ? "Delta (±)" : "Cantidad"} *
                    </label>
                    <input type="number" step="0.01" value={movQty} onChange={(e) => setMovQty(e.target.value)} required autoFocus
                      placeholder={movType === "ADJUSTMENT" ? "Ej. -5 o 10" : "Ej. 50"}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Notas</label>
                    <input value={movNotes} onChange={(e) => setMovNotes(e.target.value)} placeholder="Opcional"
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  {formError && <p className="text-xs text-red-600">{formError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-[var(--border)] py-2 text-sm">Cancelar</button>
                    <button type="submit" disabled={busy || !movQty} className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm text-white disabled:opacity-50">
                      {busy ? "Guardando..." : "Registrar"}
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
