"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Plus, X, Package, ArrowDown, ArrowUp, SlidersHorizontal, ChevronRight, AlertTriangle } from "lucide-react";

interface InventoryItem {
  id: string; name: string; category: string; unit: string;
  minimumStock?: number; notes?: string;
}
interface StockInfo { currentStock: number; isLow: boolean; }

const CAT_ICON: Record<string, string> = {
  FEED: "🌾", MEDICINE: "💊", VACCINE: "💉", FERTILIZER: "🌱", SEED: "🫘",
  FUEL: "⛽", TOOL: "🔧", MATERIAL: "📦", EQUIPMENT: "⚙️", OTHER: "📋",
};
const CATEGORIES = ["FEED","MEDICINE","VACCINE","FERTILIZER","SEED","FUEL","TOOL","MATERIAL","EQUIPMENT","OTHER"];
const UNITS       = ["UNIT","LB","KG","TON","LITER","GALLON","BAG","BOX","DOSE","BOTTLE","OTHER"];
const MOV_TYPES   = [{ v: "IN", label: "Entrada", Icon: ArrowDown }, { v: "OUT", label: "Salida", Icon: ArrowUp }, { v: "ADJUSTMENT", label: "Ajuste", Icon: SlidersHorizontal }];

function farmTabs(farmId: string) {
  return [
    { href: `/agro/${farmId}`,               label: "Dashboard"       },
    { href: `/agro/${farmId}/animals`,        label: "Animales"        },
    { href: `/agro/${farmId}/tasks`,          label: "Tareas"          },
    { href: `/agro/${farmId}/calendar`,       label: "Calendario"      },
    { href: `/agro/${farmId}/inventory`,      label: "Inventario"      },
    { href: `/agro/${farmId}/costs`,          label: "Costos"          },
    { href: `/agro/${farmId}/reproduction`,   label: "Reproducción"    },
    { href: `/agro/${farmId}/infrastructure`, label: "Infraestructura" },
    { href: `/agro/${farmId}/evidence`,       label: "Evidencia"       },
    { href: `/agro/${farmId}/audit`,          label: "Auditoría"       },
  ];
}

export default function InventoryPage() {
  const { farmId }  = useParams<{ farmId: string }>();
  const pathname    = usePathname();
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
  const [movType, setMovType]         = useState("IN");
  const [movQty, setMovQty]           = useState("");
  const [movNotes, setMovNotes]       = useState("");

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
      await Promise.allSettled(list.map(async item => {
        try {
          const sr = await fetch(`/api/semse/agro/inventory/${item.id}/stock`);
          if (sr.ok) {
            const sj = await sr.json();
            const s = sj.data as any;
            stockMap[item.id] = {
              currentStock: s?.currentStock ?? 0,
              isLow: item.minimumStock != null && (s?.currentStock ?? 0) < item.minimumStock,
            };
          }
        } catch { /* best-effort */ }
      }));
      setStock(stockMap);
    } catch (err: any) { setError(err?.message ?? "Error cargando inventario"); }
    finally { setLoading(false); }
  }

  function closeModal() { setModal(null); setFormError(null); setBusy(false); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); if (!newName.trim()) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/inventory`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName, category: newCat, unit: newUnit, minimumStock: newMinStock ? parseFloat(newMinStock) : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setNewName(""); setNewCat("FEED"); setNewUnit("KG"); setNewMinStock("");
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function handleMovement(e: React.FormEvent) {
    e.preventDefault(); if (modal?.type !== "movement" || !movQty) return;
    setBusy(true); setFormError(null);
    try {
      const body: Record<string, unknown> = { itemId: modal.item.id, movementType: movType, notes: movNotes || undefined };
      if (movType === "ADJUSTMENT") body.adjustmentDelta = parseFloat(movQty);
      else body.quantity = parseFloat(movQty);
      const res = await fetch(`/api/semse/agro/farms/${farmId}/movements`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setMovType("IN"); setMovQty(""); setMovNotes("");
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  const lowStockCount = Object.values(stock).filter(s => s.isLow).length;
  const tabs = farmId ? farmTabs(farmId) : [];

  return (
    <div className="agro-shell">
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>Inventario</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Inventario</h1>
          {lowStockCount > 0 && (
            <p style={{ fontSize: 12, color: "#fca5a5", display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <AlertTriangle size={12} /> {lowStockCount} item{lowStockCount > 1 ? "s" : ""} con stock bajo
            </p>
          )}
        </div>
        <button className="btn-accent" onClick={() => setModal({ type: "create" })}>
          <Plus size={13} /> Nuevo item
        </button>
      </div>

      <nav className="tab-bar">
        {tabs.map(tab => (
          <Link key={tab.href} href={tab.href} className="tab-item"
            data-active={pathname === tab.href ? "true" : "false"}>
            {tab.label}
          </Link>
        ))}
      </nav>

      {error && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3,4].map(i => <div key={i} className="skel" style={{ height: 52 }} />)}
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <Package size={36} className="empty-icon" />
          <p className="empty-title">Sin items de inventario</p>
          <p className="empty-desc">Registra alimentos, medicamentos, herramientas y más para llevar control de stock.</p>
          <button className="btn-accent" onClick={() => setModal({ type: "create" })}>
            <Plus size={13} /> Nuevo item
          </button>
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", overflow: "hidden" }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 72px 100px 80px 60px", gap: 0, padding: "8px 16px", borderBottom: "1px solid var(--line)", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <span />
            <span>Nombre</span><span>Unidad</span><span>Stock actual</span><span>Mínimo</span><span style={{ textAlign: "right" }}></span>
          </div>
          {items.map(item => {
            const s = stock[item.id];
            const isLow = s?.isLow;
            return (
              <div key={item.id} className="data-row" style={{ display: "grid", gridTemplateColumns: "32px 1fr 72px 100px 80px 60px", alignItems: "center" }}>
                <span style={{ fontSize: 16 }}>{CAT_ICON[item.category] ?? "📋"}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{item.name}</p>
                  <p style={{ fontSize: 11, color: "var(--faint)" }}>{item.category}</p>
                </div>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{item.unit}</span>
                <span>
                  {s != null ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isLow ? "#fca5a5" : "#6ee7b7" }}>
                        {s.currentStock.toFixed(1)}
                      </span>
                      {isLow && <AlertTriangle size={11} color="#fca5a5" />}
                    </span>
                  ) : <span style={{ fontSize: 12, color: "var(--faint)" }}>—</span>}
                </span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {item.minimumStock != null ? item.minimumStock : "—"}
                </span>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => { setMovType("IN"); setMovQty(""); setMovNotes(""); setModal({ type: "movement", item }); }}
                    title="Registrar movimiento"
                    style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}
                  >±</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>
                {modal.type === "create" ? "Nuevo item de inventario" : "Registrar movimiento"}
              </h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}>
                <X size={16} />
              </button>
            </div>

            {formError && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{formError}</div>}

            {modal.type === "create" && (
              <form onSubmit={e => void handleCreate(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><label className="fl">Nombre *</label><input className="fi" value={newName} onChange={e => setNewName(e.target.value)} required autoFocus placeholder="Ej. Concentrado bovino" /></div>
                <div><label className="fl">Categoría *</label><select className="fi" value={newCat} onChange={e => setNewCat(e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
                <div><label className="fl">Unidad *</label><select className="fi" value={newUnit} onChange={e => setNewUnit(e.target.value)}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
                <div><label className="fl">Stock mínimo (alerta)</label><input className="fi" type="number" step="0.1" min="0" value={newMinStock} onChange={e => setNewMinStock(e.target.value)} placeholder="0" /></div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" className="btn-accent" disabled={busy} style={{ flex: 1 }}>{busy ? "Guardando…" : "Crear item"}</button>
                  <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
                </div>
              </form>
            )}

            {modal.type === "movement" && (
              <form onSubmit={e => void handleMovement(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -8 }}>{modal.item.name} ({modal.item.unit})</p>
                <div>
                  <label className="fl">Tipo de movimiento *</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {MOV_TYPES.map(m => {
                      const Icon = m.Icon;
                      return (
                        <button key={m.v} type="button" onClick={() => setMovType(m.v)}
                          style={{
                            flex: 1, padding: "7px 8px", borderRadius: 8, border: "1px solid",
                            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                            background: movType === m.v ? "var(--accent)" : "transparent",
                            color: movType === m.v ? "#fff" : "var(--muted)",
                            borderColor: movType === m.v ? "var(--accent)" : "var(--border)",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                          }}>
                          <Icon size={12} /> {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="fl">{movType === "ADJUSTMENT" ? "Delta (±)" : "Cantidad"} *</label>
                  <input className="fi" type="number" step="0.01" value={movQty} onChange={e => setMovQty(e.target.value)} required autoFocus placeholder={movType === "ADJUSTMENT" ? "Ej. -5 o 10" : "Ej. 50"} />
                </div>
                <div><label className="fl">Notas</label><input className="fi" value={movNotes} onChange={e => setMovNotes(e.target.value)} placeholder="Opcional" /></div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" className="btn-accent" disabled={busy || !movQty} style={{ flex: 1 }}>{busy ? "Guardando…" : "Registrar"}</button>
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
