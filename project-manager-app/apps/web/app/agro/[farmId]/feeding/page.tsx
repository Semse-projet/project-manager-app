"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  ChevronRight, Plus, X, Wheat, Droplets, Zap, Leaf,
  AlertTriangle, Package, Clock, Check, RefreshCw,
  ChevronLeft, FlaskConical,
} from "lucide-react";

/* ─── Feed type catalog ──────────────────────────────────────────── */
interface FeedType {
  id: string; label: string; unit: string;
  color: string; bg: string; Icon: typeof Wheat;
  defaultQtyPerAnimal: number; // kg per animal per day
  description: string;
}
const FEED_CATALOG: FeedType[] = [
  { id: "PASTO",        label: "Pasto / Forraje",     unit: "KG",    color: "#6ee7b7", bg: "rgba(16,185,129,.14)",  Icon: Leaf,        defaultQtyPerAnimal: 15,   description: "Forraje verde fresco" },
  { id: "CONCENTRADO",  label: "Concentrado",          unit: "KG",    color: "#fcd34d", bg: "rgba(245,158,11,.14)", Icon: Wheat,       defaultQtyPerAnimal: 2,    description: "Alimento balanceado" },
  { id: "MELASA",       label: "Melasa",               unit: "KG",    color: "#c4b5fd", bg: "rgba(139,92,246,.14)", Icon: Droplets,    defaultQtyPerAnimal: 0.5,  description: "Subproducto de caña" },
  { id: "SAL",          label: "Sal mineralizada",     unit: "KG",    color: "#67e8f9", bg: "rgba(6,182,212,.14)",  Icon: FlaskConical,defaultQtyPerAnimal: 0.05, description: "Sal y minerales" },
  { id: "HARINA_MAIZ",  label: "Harina de maíz",      unit: "KG",    color: "#fca5a5", bg: "rgba(239,68,68,.14)",  Icon: Wheat,       defaultQtyPerAnimal: 1.5,  description: "Energía concentrada" },
  { id: "SILO",         label: "Silo / Ensilaje",      unit: "KG",    color: "#93c5fd", bg: "rgba(59,130,246,.14)", Icon: Package,     defaultQtyPerAnimal: 8,    description: "Forraje conservado" },
  { id: "HENO",         label: "Heno / Forraje seco",  unit: "KG",    color: "#fcd34d", bg: "rgba(245,158,11,.10)", Icon: Wheat,       defaultQtyPerAnimal: 4,    description: "Pasto deshidratado" },
  { id: "VITAMINAS",    label: "Vitaminas / Minerales",unit: "GRAM",  color: "#6ee7b7", bg: "rgba(16,185,129,.10)", Icon: Zap,         defaultQtyPerAnimal: 20,   description: "Suplemento vitamínico" },
];

/* ─── Ration planner (localStorage) ─────────────────────────────── */
interface RationItem { feedId: string; qty: number; times: string[]; active: boolean; }
const DEFAULT_TIMES  = ["06:00", "12:00", "18:00"];
const RATION_KEY     = (farmId: string) => `semse_ration_${farmId}`;

function loadRation(farmId: string): RationItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(RATION_KEY(farmId)) ?? "[]"); }
  catch { return []; }
}
function saveRation(farmId: string, items: RationItem[]) {
  localStorage.setItem(RATION_KEY(farmId), JSON.stringify(items));
}

/* ─── Inventory interfaces ───────────────────────────────────────── */
interface InvItem  { id: string; name: string; category: string; unit: string; minimumStock?: number; }
interface StockInfo { currentStock: number; isLow: boolean; }

/* ─── Week calendar ──────────────────────────────────────────────── */
const DOW_ES  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const HOURS   = ["06:00","12:00","18:00"];

function farmTabs(farmId: string) {
  return [
    { href: `/agro/${farmId}`,               label: "Dashboard"       },
    { href: `/agro/${farmId}/animals`,        label: "Animales"        },
    { href: `/agro/${farmId}/tasks`,          label: "Tareas"          },
    { href: `/agro/${farmId}/calendar`,       label: "Calendario"      },
    { href: `/agro/${farmId}/feeding`,        label: "Alimentación"    },
    { href: `/agro/${farmId}/inventory`,      label: "Inventario"      },
    { href: `/agro/${farmId}/costs`,          label: "Costos"          },
    { href: `/agro/${farmId}/reproduction`,   label: "Reproducción"    },
    { href: `/agro/${farmId}/infrastructure`, label: "Infraestructura" },
    { href: `/agro/${farmId}/evidence`,       label: "Evidencia"       },
    { href: `/agro/${farmId}/audit`,          label: "Auditoría"       },
  ];
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function FeedingPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const pathname   = usePathname();

  /* Sub-tab */
  const [tab, setTab] = useState<"stock" | "raciones" | "horario">("stock");

  /* Inventory state */
  const [items, setItems]     = useState<InvItem[]>([]);
  const [stock, setStock]     = useState<Record<string, StockInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  /* Ration state */
  const [ration, setRation]       = useState<RationItem[]>([]);
  const [animalCount, setAnimalCount] = useState(0);
  const [rationDirty, setRationDirty] = useState(false);

  /* Modal: register movement */
  const [movModal, setMovModal] = useState<{ item: InvItem; type: "IN" | "OUT" } | null>(null);
  const [movQty, setMovQty]     = useState("");
  const [movNotes, setMovNotes] = useState("");
  const [movBusy, setMovBusy]   = useState(false);
  const [movError, setMovError] = useState<string | null>(null);

  /* Modal: quick-add feed item */
  const [addModal, setAddModal] = useState<FeedType | null>(null);
  const [addBusy, setAddBusy]   = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  /* Week calendar offset */
  const [weekOffset, setWeekOffset] = useState(0);

  const tabs = farmId ? farmTabs(farmId) : [];

  /* ── Load ── */
  useEffect(() => {
    if (!farmId) return;
    void loadInventory();
    const r = loadRation(farmId);
    if (r.length === 0) {
      // seed defaults
      const defaults: RationItem[] = FEED_CATALOG.filter(f => ["PASTO","CONCENTRADO","SAL"].includes(f.id))
        .map(f => ({ feedId: f.id, qty: f.defaultQtyPerAnimal, times: ["06:00","18:00"], active: true }));
      setRation(defaults);
    } else {
      setRation(r);
    }
  }, [farmId]);

  async function loadInventory() {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/semse/agro/farms/${farmId}/inventory`);
      const json = await res.json();
      const list: InvItem[] = (json.data as any)?.items ?? [];
      const feedItems = list.filter(i => ["FEED","MINERAL","SUPPLEMENT","OTHER"].includes(i.category) ||
        FEED_CATALOG.some(f => i.name.toLowerCase().includes(f.label.split("/")[0].toLowerCase())));
      setItems(feedItems.length > 0 ? feedItems : list.filter(i => i.category === "FEED"));

      // fetch stock in parallel
      const map: Record<string, StockInfo> = {};
      await Promise.allSettled(list.map(async it => {
        try {
          const sr = await fetch(`/api/semse/agro/inventory/${it.id}/stock`);
          if (sr.ok) {
            const sj = await sr.json();
            const s  = (sj.data as any);
            map[it.id] = { currentStock: s?.currentStock ?? 0, isLow: it.minimumStock != null && (s?.currentStock ?? 0) < it.minimumStock };
          }
        } catch { /* best-effort */ }
      }));
      setStock(map);

      // also grab animal count for ration estimate
      try {
        const ar  = await fetch(`/api/semse/agro/farms/${farmId}/dashboard`);
        const aj  = await ar.json();
        setAnimalCount((aj.data as any)?.counts?.totalAnimals ?? 0);
      } catch { /* best-effort */ }
    } catch (err: any) { setError(err?.message ?? "Error"); }
    finally { setLoading(false); }
  }

  /* ── Movement ── */
  async function handleMovement(e: React.FormEvent) {
    e.preventDefault(); if (!movModal || !movQty) return;
    setMovBusy(true); setMovError(null);
    try {
      const body: Record<string, unknown> = {
        itemId: movModal.item.id,
        movementType: movModal.type,
        notes: movNotes || undefined,
      };
      if (movModal.type === "OUT") body.quantity = parseFloat(movQty);
      else body.quantity = parseFloat(movQty);
      const res  = await fetch(`/api/semse/agro/farms/${farmId}/movements`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setMovQty(""); setMovNotes(""); setMovModal(null); void loadInventory();
    } catch (err: any) { setMovError(err?.message); } finally { setMovBusy(false); }
  }

  /* ── Quick-add feed to inventory ── */
  async function handleAddFeed(e: React.FormEvent, feed: FeedType) {
    e.preventDefault();
    setAddBusy(true); setAddError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/inventory`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: feed.label, category: "FEED", unit: feed.unit }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setAddModal(null); void loadInventory();
    } catch (err: any) { setAddError(err?.message); } finally { setAddBusy(false); }
  }

  /* ── Ration helpers ── */
  function updateRationQty(feedId: string, qty: number) {
    setRation(prev => prev.map(r => r.feedId === feedId ? { ...r, qty } : r));
    setRationDirty(true);
  }
  function toggleRationItem(feedId: string) {
    setRation(prev => prev.map(r => r.feedId === feedId ? { ...r, active: !r.active } : r));
    setRationDirty(true);
  }
  function addRationFeed(feed: FeedType) {
    if (ration.some(r => r.feedId === feed.id)) return;
    setRation(prev => [...prev, { feedId: feed.id, qty: feed.defaultQtyPerAnimal, times: ["06:00","18:00"], active: true }]);
    setRationDirty(true);
  }
  function removeRationFeed(feedId: string) {
    setRation(prev => prev.filter(r => r.feedId !== feedId));
    setRationDirty(true);
  }
  function toggleTime(feedId: string, time: string) {
    setRation(prev => prev.map(r => {
      if (r.feedId !== feedId) return r;
      const times = r.times.includes(time) ? r.times.filter(t => t !== time) : [...r.times, time].sort();
      return { ...r, times };
    }));
    setRationDirty(true);
  }
  function saveRationClick() {
    if (!farmId) return;
    saveRation(farmId, ration);
    setRationDirty(false);
  }

  /* ── Week calendar helpers ── */
  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + weekOffset * 7);
    d.setHours(0,0,0,0);
    return d;
  })();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const today = new Date(); today.setHours(0,0,0,0);
  const activeRation = ration.filter(r => r.active);

  /* ─────────────────────────────────────────────────────────── */
  return (
    <div className="agro-shell" style={{ maxWidth: 1080 }}>
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>Alimentación</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Alimentación & Nutrición</h1>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>Pasto, melasa, sal, harina de maíz, concentrado y más</p>
        </div>
      </div>

      <nav className="tab-bar">
        {tabs.map(t => (
          <Link key={t.href} href={t.href} className="tab-item"
            data-active={pathname === t.href ? "true" : "false"}>{t.label}</Link>
        ))}
      </nav>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {([["stock","Stock de alimentos"],["raciones","Plan de raciones"],["horario","Calendario"]] as [typeof tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{
              padding: "6px 16px", borderRadius: 999, border: "1px solid",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: tab === k ? "var(--brand)" : "transparent",
              color: tab === k ? "#fff" : "var(--muted)",
              borderColor: tab === k ? "var(--brand)" : "var(--border)",
              transition: "all 120ms",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ══ STOCK DE ALIMENTOS ══════════════════════════════════════ */}
      {tab === "stock" && (
        <div>
          {/* Quick-add strip */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, fontWeight: 600 }}>
              ALIMENTOS COMUNES — haz clic para agregar al inventario
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {FEED_CATALOG.map(feed => {
                const exists = items.some(i => i.name.toLowerCase().includes(feed.label.split("/")[0].trim().toLowerCase()));
                return (
                  <button key={feed.id}
                    onClick={() => !exists && setAddModal(feed)}
                    disabled={exists}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "6px 14px", borderRadius: 999,
                      border: `1px solid ${exists ? "var(--border)" : feed.color}`,
                      background: exists ? "var(--base)" : feed.bg,
                      color: exists ? "var(--faint)" : feed.color,
                      fontSize: 12, fontWeight: 600, cursor: exists ? "default" : "pointer",
                      fontFamily: "inherit", opacity: exists ? 0.6 : 1,
                    }}
                  >
                    <feed.Icon size={12} />
                    {feed.label}
                    {exists && <Check size={11} />}
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1,2,3,4].map(i => <div key={i} className="skel" style={{ height: 64 }} />)}
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <Wheat size={36} className="empty-icon" />
              <p className="empty-title">Sin alimentos registrados</p>
              <p className="empty-desc">Usa los botones arriba para agregar pasto, sal, melasa, harina y más a tu inventario.</p>
            </div>
          ) : (
            <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 90px 130px", gap: 0, padding: "8px 16px", borderBottom: "1px solid var(--line)", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <span>Alimento</span><span>Stock</span><span>Unidad</span><span style={{ textAlign: "right" }}>Acciones</span>
              </div>
              {items.map(item => {
                const s     = stock[item.id];
                const feed  = FEED_CATALOG.find(f => item.name.toLowerCase().includes(f.label.split("/")[0].trim().toLowerCase()));
                const color = feed?.color ?? "#94a3b8";
                const bg    = feed?.bg    ?? "rgba(148,163,184,.1)";
                const Icon  = feed?.Icon  ?? Wheat;
                const isLow = s?.isLow;
                const daysLeft = s && animalCount > 0 && feed
                  ? Math.floor(s.currentStock / (feed.defaultQtyPerAnimal * animalCount))
                  : null;
                return (
                  <div key={item.id} className="data-row" style={{ display: "grid", gridTemplateColumns: "1fr 110px 90px 130px", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 7, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={14} color={color} />
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{item.name}</p>
                        {daysLeft != null && daysLeft >= 0 && (
                          <p style={{ fontSize: 11, color: daysLeft < 5 ? "#fca5a5" : "var(--faint)" }}>
                            ~{daysLeft} día{daysLeft !== 1 ? "s" : ""} restante{daysLeft !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                    <span>
                      {s != null ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: isLow ? "#fca5a5" : "#6ee7b7" }}>
                            {s.currentStock % 1 === 0 ? s.currentStock : s.currentStock.toFixed(1)}
                          </span>
                          {isLow && <AlertTriangle size={11} color="#fca5a5" />}
                        </span>
                      ) : <span style={{ fontSize: 12, color: "var(--faint)" }}>—</span>}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{item.unit}</span>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button onClick={() => { setMovQty(""); setMovNotes(""); setMovModal({ item, type: "IN" }); }}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(16,185,129,.25)", background: "rgba(16,185,129,.08)", color: "#6ee7b7", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        + Entrada
                      </button>
                      <button onClick={() => { setMovQty(""); setMovNotes(""); setMovModal({ item, type: "OUT" }); }}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,.25)", background: "rgba(239,68,68,.08)", color: "#fca5a5", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        − Uso
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ PLAN DE RACIONES ════════════════════════════════════════ */}
      {tab === "raciones" && (
        <div>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 13, color: "var(--muted)" }}>
                Animales en finca: <strong style={{ color: "var(--ink)" }}>{animalCount}</strong>
                {animalCount > 0 && <span style={{ fontSize: 12, marginLeft: 8, color: "var(--faint)" }}>— estimaciones por día</span>}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {rationDirty && (
                <button className="btn-accent" onClick={saveRationClick}>
                  <Check size={13} /> Guardar plan
                </button>
              )}
            </div>
          </div>

          {/* Quick-add buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {FEED_CATALOG.filter(f => !ration.some(r => r.feedId === f.id)).map(feed => (
              <button key={feed.id} onClick={() => addRationFeed(feed)}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 999,
                  border: `1px solid var(--border)`, background: "transparent", color: "var(--muted)",
                  fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                }}>
                <Plus size={10} /> {feed.label}
              </button>
            ))}
          </div>

          {/* Ration cards */}
          {ration.length === 0 ? (
            <div className="empty-state">
              <Wheat size={36} className="empty-icon" />
              <p className="empty-title">Sin plan de raciones</p>
              <p className="empty-desc">Agrega alimentos arriba para configurar las raciones diarias.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {ration.map(r => {
                const feed     = FEED_CATALOG.find(f => f.id === r.feedId);
                if (!feed) return null;
                const Icon     = feed.Icon;
                const total    = animalCount > 0 ? r.qty * animalCount : 0;
                const invItem  = items.find(i => i.name.toLowerCase().includes(feed.label.split("/")[0].trim().toLowerCase()));
                const s        = invItem ? stock[invItem.id] : null;
                const daysLeft = s && total > 0 ? Math.floor(s.currentStock / total) : null;
                return (
                  <div key={r.feedId} style={{
                    borderRadius: 14, border: `1px solid ${r.active ? feed.color.replace(")", ",.35)").replace("rgb","rgba") : "var(--border)"}`,
                    background: r.active ? feed.bg : "var(--base)", padding: "16px 18px", opacity: r.active ? 1 : 0.55,
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: feed.bg, border: `1px solid ${feed.color}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={16} color={feed.color} />
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>{feed.label}</p>
                          <p style={{ fontSize: 11, color: "var(--faint)" }}>{feed.description}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => toggleRationItem(r.feedId)}
                          style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                          {r.active ? "Pausar" : "Activar"}
                        </button>
                        <button onClick={() => removeRationFeed(r.feedId)}
                          style={{ padding: "3px 6px", borderRadius: 6, border: "none", background: "transparent", color: "var(--faint)", cursor: "pointer", display: "flex" }}>
                          <X size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Qty per animal */}
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 5 }}>
                        {feed.unit === "GRAM" ? "Gramos" : "Kg"} / animal / día
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button onClick={() => updateRationQty(r.feedId, Math.max(0, r.qty - (feed.unit === "GRAM" ? 5 : 0.1)))}
                          style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "var(--base)", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                          −
                        </button>
                        <input
                          type="number" step={feed.unit === "GRAM" ? 5 : 0.1} min="0"
                          value={r.qty}
                          onChange={e => updateRationQty(r.feedId, parseFloat(e.target.value) || 0)}
                          style={{ width: 70, textAlign: "center", background: "var(--base)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", fontSize: 14, fontWeight: 700, color: "var(--ink)", fontFamily: "inherit" }}
                        />
                        <button onClick={() => updateRationQty(r.feedId, r.qty + (feed.unit === "GRAM" ? 5 : 0.1))}
                          style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "var(--base)", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                          +
                        </button>
                      </div>
                    </div>

                    {/* Total + stock estimate */}
                    {animalCount > 0 && (
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                        Total diario: <strong style={{ color: feed.color }}>{feed.unit === "GRAM" ? `${(r.qty * animalCount / 1000).toFixed(2)} kg` : `${(r.qty * animalCount).toFixed(1)} kg`}</strong>
                        {daysLeft != null && (
                          <span style={{ marginLeft: 8, color: daysLeft < 5 ? "#fca5a5" : "var(--faint)" }}>
                            · ~{daysLeft} días stock
                          </span>
                        )}
                      </div>
                    )}

                    {/* Feeding times */}
                    <div>
                      <p style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                        <Clock size={10} /> Horarios
                      </p>
                      <div style={{ display: "flex", gap: 5 }}>
                        {DEFAULT_TIMES.map(t => (
                          <button key={t} onClick={() => toggleTime(r.feedId, t)}
                            style={{
                              padding: "3px 10px", borderRadius: 999, border: "1px solid",
                              fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                              background: r.times.includes(t) ? feed.color : "transparent",
                              color: r.times.includes(t) ? "#0a0a14" : "var(--muted)",
                              borderColor: r.times.includes(t) ? feed.color : "var(--border)",
                            }}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {rationDirty && (
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button className="btn-accent" onClick={saveRationClick}>
                <Check size={14} /> Guardar plan de raciones
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ CALENDARIO DE ALIMENTACIÓN ══════════════════════════════ */}
      {tab === "horario" && (
        <div>
          {/* Week nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <button onClick={() => setWeekOffset(o => o - 1)}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit", fontSize: 13 }}>
              <ChevronLeft size={14} /> Anterior
            </button>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
              {weekDays[0].toLocaleDateString("es-CO", { day: "numeric", month: "short" })} — {weekDays[6].toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <button onClick={() => setWeekOffset(o => o + 1)}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit", fontSize: 13 }}>
              Esta semana <ChevronRight size={14} />
            </button>
          </div>

          {activeRation.length === 0 ? (
            <div className="empty-state">
              <Clock size={36} className="empty-icon" />
              <p className="empty-title">Sin plan de raciones activo</p>
              <p className="empty-desc">Ve a "Plan de raciones" y configura los alimentos para ver el calendario.</p>
              <button className="btn-ghost" onClick={() => setTab("raciones")}>
                Ir al plan de raciones
              </button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              {/* Grid: rows=hours, cols=days */}
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 4, minWidth: 640 }}>
                <thead>
                  <tr>
                    <th style={{ width: 70, fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "left", padding: "6px 8px" }}>Hora</th>
                    {weekDays.map((d, i) => {
                      const isToday = d.getTime() === today.getTime();
                      return (
                        <th key={i} style={{ fontSize: 12, fontWeight: 700, color: isToday ? "var(--brand)" : "var(--ink)", textAlign: "center", padding: "6px 4px" }}>
                          <div>{DOW_ES[d.getDay()]}</div>
                          <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 400, color: isToday ? "var(--brand)" : "var(--muted)" }}>
                            {d.getDate()}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map(hour => {
                    const feedsAtHour = activeRation.filter(r => r.times.includes(hour));
                    if (feedsAtHour.length === 0) return null;
                    return (
                      <tr key={hour}>
                        <td style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, padding: "4px 8px", verticalAlign: "top", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <Clock size={11} />
                            {hour}
                          </div>
                        </td>
                        {weekDays.map((d, di) => {
                          const isToday  = d.getTime() === today.getTime();
                          const isPast   = d < today;
                          return (
                            <td key={di} style={{ verticalAlign: "top", padding: "2px" }}>
                              <div style={{
                                borderRadius: 8,
                                background: isToday ? "rgba(59,130,246,.06)" : isPast ? "var(--base)" : "var(--surface)",
                                border: `1px solid ${isToday ? "rgba(59,130,246,.2)" : "var(--border)"}`,
                                padding: "6px 8px",
                                minHeight: 52,
                              }}>
                                {feedsAtHour.map(r => {
                                  const feed = FEED_CATALOG.find(f => f.id === r.feedId);
                                  if (!feed) return null;
                                  const Icon = feed.Icon;
                                  return (
                                    <div key={r.feedId} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                                      <Icon size={10} color={feed.color} />
                                      <span style={{ fontSize: 11, color: isPast ? "var(--faint)" : "var(--muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
                                        {feed.label.split("/")[0].trim()}
                                        {animalCount > 0 && (
                                          <span style={{ color: "var(--faint)", fontWeight: 400, marginLeft: 3 }}>
                                            {feed.unit === "GRAM"
                                              ? `${(r.qty * animalCount / 1000).toFixed(1)}kg`
                                              : `${(r.qty * animalCount).toFixed(0)}kg`}
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Daily summary */}
              <div style={{ marginTop: 20, borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "18px 20px" }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>Resumen diario</h3>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                  {activeRation.map(r => {
                    const feed  = FEED_CATALOG.find(f => f.id === r.feedId);
                    if (!feed) return null;
                    const Icon  = feed.Icon;
                    const total = r.qty * Math.max(animalCount, 1);
                    return (
                      <div key={r.feedId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: feed.bg, border: `1px solid ${feed.color}22` }}>
                        <Icon size={16} color={feed.color} />
                        <div>
                          <p style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>{feed.label.split("/")[0].trim()}</p>
                          <p style={{ fontSize: 14, fontWeight: 800, color: feed.color, lineHeight: 1 }}>
                            {feed.unit === "GRAM" ? `${(total / 1000).toFixed(2)} kg` : `${total.toFixed(1)} kg`}
                          </p>
                          <p style={{ fontSize: 10, color: "var(--faint)" }}>{r.times.length}× al día</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Movement modal ── */}
      {movModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setMovModal(null)}>
          <div className="modal-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
                {movModal.type === "IN" ? "Registrar entrada" : "Registrar consumo"} — {movModal.item.name}
              </h2>
              <button onClick={() => setMovModal(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex" }}><X size={16} /></button>
            </div>
            {movError && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{movError}</div>}
            <form onSubmit={e => void handleMovement(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="fl">Cantidad ({movModal.item.unit}) *</label>
                <input className="fi" type="number" step="0.1" min="0" value={movQty} onChange={e => setMovQty(e.target.value)} required autoFocus placeholder="Ej. 50" />
              </div>
              <div>
                <label className="fl">Notas</label>
                <input className="fi" value={movNotes} onChange={e => setMovNotes(e.target.value)} placeholder="Opcional" />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" disabled={movBusy || !movQty}
                  className={movModal.type === "IN" ? "btn-accent" : "btn-danger"}
                  style={{ flex: 1 }}>
                  {movBusy ? "Guardando…" : movModal.type === "IN" ? "Registrar entrada" : "Registrar consumo"}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setMovModal(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Quick-add feed modal ── */}
      {addModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAddModal(null)}>
          <div className="modal-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Agregar al inventario</h2>
              <button onClick={() => setAddModal(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex" }}><X size={16} /></button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 10, background: addModal.bg, marginBottom: 18 }}>
              <addModal.Icon size={22} color={addModal.color} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{addModal.label}</p>
                <p style={{ fontSize: 12, color: "var(--muted)" }}>{addModal.description} · Unidad: {addModal.unit}</p>
              </div>
            </div>
            {addError && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{addError}</div>}
            <form onSubmit={e => void handleAddFeed(e, addModal)} style={{ display: "flex", gap: 10 }}>
              <button type="submit" className="btn-accent" disabled={addBusy} style={{ flex: 1 }}>
                {addBusy ? "Agregando…" : "Agregar al inventario"}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setAddModal(null)}>Cancelar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
