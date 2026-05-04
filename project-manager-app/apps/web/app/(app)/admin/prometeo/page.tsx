"use client";

import { useEffect, useState } from "react";
import { BookOpen, Database, FileText, Loader, Plus, Search, Trash2, Zap } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";

// ── Types ──────────────────────────────────────────────────────────────────────

type PrometeoDoc = {
  id: string; title: string; sourceType: string; status: string;
  chunkCount: number; createdAt: string; errorMsg?: string | null;
  projectId?: string | null;
};

type SearchResult = {
  documentId: string; documentTitle: string; chunkIndex: number;
  text: string; score: number;
};

type WorkOrder = {
  id: string; title: string; priority: string; status: string;
  description?: string | null; assignedToId?: string | null;
  projectId?: string | null; dueAt?: string | null; createdAt: string;
};

type Asset = {
  id: string; name: string; category: string; status: string;
  serialNumber?: string | null; location?: string | null; createdAt: string;
};

// ── API helpers ────────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  const d = await res.json() as { data: T };
  return d.data;
}
async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json() as { data: T };
  return d.data;
}
async function apiDelete(path: string) {
  await fetch(path, { method: "DELETE" });
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, [string, string]> = {
    indexed:    ["#10b981", "rgba(16,185,129,.12)"],
    processing: ["#f59e0b", "rgba(245,158,11,.12)"],
    pending:    ["#94a3b8", "rgba(148,163,184,.1)"],
    failed:     ["#ef4444", "rgba(239,68,68,.12)"],
    open:       ["#6366f1", "rgba(99,102,241,.12)"],
    in_progress:["#f59e0b", "rgba(245,158,11,.12)"],
    closed:     ["#10b981", "rgba(16,185,129,.12)"],
    available:  ["#10b981", "rgba(16,185,129,.12)"],
    in_use:     ["#f59e0b", "rgba(245,158,11,.12)"],
  };
  const [color, bg] = colors[status] ?? ["#94a3b8", "rgba(148,163,184,.1)"];
  return (
    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, color, background: bg }}>
      {status}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PrometeoPage() {
  const [tab, setTab] = useState<"docs" | "search" | "assets" | "workorders">("docs");
  const [docs, setDocs] = useState<PrometeoDoc[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Ingest form
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestText, setIngestText] = useState("");
  const [ingestType, setIngestType] = useState("text");
  const [ingesting, setIngesting] = useState(false);

  // WO form
  const [woTitle, setWoTitle] = useState("");
  const [woPriority, setWoPriority] = useState("medium");
  const [woDesc, setWoDesc] = useState("");
  const [woSubmitting, setWoSubmitting] = useState(false);

  // Asset form
  const [assetName, setAssetName] = useState("");
  const [assetCat, setAssetCat] = useState("equipment");
  const [assetSubmitting, setAssetSubmitting] = useState(false);

  async function loadDocs() {
    setLoading(true);
    try { setDocs(await apiGet<PrometeoDoc[]>("/api/semse/prometeo/documents")); } catch { /**/ }
    setLoading(false);
  }

  async function loadAssets() {
    try { setAssets(await apiGet<Asset[]>("/api/semse/prometeo/assets")); } catch { /**/ }
  }

  async function loadWorkOrders() {
    try { setWorkOrders(await apiGet<WorkOrder[]>("/api/semse/prometeo/work-orders")); } catch { /**/ }
  }

  useEffect(() => { void loadDocs(); void loadAssets(); void loadWorkOrders(); }, []);

  async function handleIngest() {
    if (!ingestTitle.trim() || !ingestText.trim()) return;
    setIngesting(true);
    try {
      await apiPost("/api/semse/prometeo/ingest", { title: ingestTitle, text: ingestText, sourceType: ingestType });
      setIngestTitle(""); setIngestText("");
      setTimeout(() => { void loadDocs(); }, 2000);
    } catch { /**/ } finally { setIngesting(false); }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try { setSearchResults(await apiPost<SearchResult[]>("/api/semse/prometeo/search", { query: searchQuery, topK: 8 })); }
    catch { /**/ } finally { setSearching(false); }
  }

  async function handleDeleteDoc(id: string) {
    await apiDelete(`/api/semse/prometeo/documents/${id}`);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleCreateWO() {
    if (!woTitle.trim()) return;
    setWoSubmitting(true);
    try {
      const wo = await apiPost<WorkOrder>("/api/semse/prometeo/work-orders", { title: woTitle, priority: woPriority, description: woDesc });
      setWorkOrders((prev) => [wo, ...prev]);
      setWoTitle(""); setWoDesc("");
    } catch { /**/ } finally { setWoSubmitting(false); }
  }

  async function handleCreateAsset() {
    if (!assetName.trim()) return;
    setAssetSubmitting(true);
    try {
      const a = await apiPost<Asset>("/api/semse/prometeo/assets", { name: assetName, category: assetCat });
      setAssets((prev) => [a, ...prev]);
      setAssetName("");
    } catch { /**/ } finally { setAssetSubmitting(false); }
  }

  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" };
  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--ink)", fontSize: 13, outline: "none", boxSizing: "border-box" };
  const btn = (color = "#6366f1", bg = "rgba(99,102,241,.15)"): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "none", background: bg, color, fontSize: 12, fontWeight: 700, cursor: "pointer" });

  const TABS = [
    { id: "docs",       label: "Base RAG",      icon: Database },
    { id: "search",     label: "Búsqueda",      icon: Search },
    { id: "assets",     label: "Activos",        icon: Zap },
    { id: "workorders", label: "Órdenes de Trabajo", icon: FileText },
  ] as const;

  return (
    <HtmlInCanvasPanel>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 16 }}>

        {/* Header */}
        <div style={{ ...card, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center" }}>
            <BookOpen size={22} color="#818cf8" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Prometeo Engine</h1>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
              RAG · Base documental · Activos · Órdenes de trabajo
            </p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: 12, color: "var(--muted)" }}>
            <span><strong style={{ color: "var(--ink)" }}>{docs.filter((d) => d.status === "indexed").length}</strong> indexados</span>
            <span><strong style={{ color: "var(--ink)" }}>{assets.length}</strong> activos</span>
            <span><strong style={{ color: "var(--ink)" }}>{workOrders.length}</strong> OTs</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8 }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ ...btn(tab === id ? "#fff" : "var(--muted)", tab === id ? "#6366f1" : "transparent"), borderRadius: 10, border: tab === id ? "none" : "1px solid var(--border)" }}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        {/* ── BASE RAG ── */}
        {tab === "docs" && (
          <div style={{ display: "grid", gap: 14 }}>
            {/* Ingest form */}
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Ingestar documento</div>
              <div style={{ display: "grid", gap: 10 }}>
                <input value={ingestTitle} onChange={(e) => setIngestTitle(e.target.value)}
                  placeholder="Título del documento" style={input} />
                <select value={ingestType} onChange={(e) => setIngestType(e.target.value)}
                  style={{ ...input, cursor: "pointer" }}>
                  <option value="text">Texto libre</option>
                  <option value="contract">Contrato</option>
                  <option value="scope">Alcance de trabajo</option>
                  <option value="manual">Manual técnico</option>
                  <option value="report">Reporte</option>
                  <option value="evidence">Evidencia transcrita</option>
                </select>
                <textarea value={ingestText} onChange={(e) => setIngestText(e.target.value)}
                  placeholder="Pega el contenido del documento aquí..." rows={6}
                  style={{ ...input, resize: "vertical", fontFamily: "inherit" }} />
                <button onClick={() => void handleIngest()} disabled={ingesting || !ingestTitle.trim() || !ingestText.trim()}
                  style={{ ...btn(), opacity: ingesting ? 0.6 : 1, width: "fit-content" }}>
                  {ingesting ? <><Loader size={13} />Procesando…</> : <><Plus size={13} />Ingestar</>}
                </button>
              </div>
            </div>

            {/* Docs list */}
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>Documentos indexados</div>
                <button onClick={() => void loadDocs()} style={{ ...btn("var(--muted)", "transparent"), border: "1px solid var(--border)", fontSize: 11 }}>
                  Actualizar
                </button>
              </div>
              {loading ? <div style={{ color: "var(--muted)", fontSize: 13 }}>Cargando…</div> : docs.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 13 }}>Sin documentos. Ingesta el primero arriba.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {docs.map((d) => (
                    <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                          {d.sourceType} · {d.chunkCount} chunks · {new Date(d.createdAt).toLocaleDateString("es-MX")}
                        </div>
                        {d.errorMsg && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 2 }}>{d.errorMsg}</div>}
                      </div>
                      <StatusBadge status={d.status} />
                      <button onClick={() => void handleDeleteDoc(d.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SEARCH ── */}
        {tab === "search" && (
          <div style={card}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Búsqueda semántica RAG</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
                placeholder="¿Qué información buscas?" style={{ ...input, flex: 1 }} />
              <button onClick={() => void handleSearch()} disabled={searching || !searchQuery.trim()}
                style={{ ...btn(), opacity: searching ? 0.6 : 1, whiteSpace: "nowrap" }}>
                {searching ? "Buscando…" : <><Search size={13} />Buscar</>}
              </button>
            </div>
            {searchResults.length === 0 && !searching && (
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                {docs.filter((d) => d.status === "indexed").length === 0
                  ? "Primero ingesta documentos en la pestaña Base RAG."
                  : "Escribe una consulta y presiona Enter."}
              </div>
            )}
            <div style={{ display: "grid", gap: 10 }}>
              {searchResults.map((r, i) => (
                <div key={i} style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(99,102,241,.05)", border: "1px solid rgba(99,102,241,.15)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <strong style={{ fontSize: 12, color: "#818cf8" }}>{r.documentTitle}</strong>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>chunk {r.chunkIndex} · score {r.score.toFixed(3)}</span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink)" }}>{r.text.slice(0, 400)}{r.text.length > 400 ? "…" : ""}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ASSETS ── */}
        {tab === "assets" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Registrar activo</div>
              <div style={{ display: "flex", gap: 10 }}>
                <input value={assetName} onChange={(e) => setAssetName(e.target.value)}
                  placeholder="Nombre del activo" style={{ ...input, flex: 1 }} />
                <select value={assetCat} onChange={(e) => setAssetCat(e.target.value)}
                  style={{ ...input, width: "auto", cursor: "pointer" }}>
                  <option value="equipment">Equipo</option>
                  <option value="material">Material</option>
                  <option value="vehicle">Vehículo</option>
                  <option value="tool">Herramienta</option>
                  <option value="space">Espacio</option>
                </select>
                <button onClick={() => void handleCreateAsset()} disabled={assetSubmitting || !assetName.trim()}
                  style={{ ...btn(), opacity: assetSubmitting ? 0.6 : 1 }}>
                  <Plus size={13} />Agregar
                </button>
              </div>
            </div>
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Inventario de activos</div>
              {assets.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 13 }}>Sin activos registrados.</div> : (
                <div style={{ display: "grid", gap: 8 }}>
                  {assets.map((a) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)" }}>
                      <Zap size={14} color="#818cf8" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{a.category}{a.location ? ` · ${a.location}` : ""}</div>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── WORK ORDERS ── */}
        {tab === "workorders" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Nueva Orden de Trabajo</div>
              <div style={{ display: "grid", gap: 10 }}>
                <input value={woTitle} onChange={(e) => setWoTitle(e.target.value)}
                  placeholder="Título de la orden" style={input} />
                <div style={{ display: "flex", gap: 10 }}>
                  <select value={woPriority} onChange={(e) => setWoPriority(e.target.value)}
                    style={{ ...input, cursor: "pointer" }}>
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
                <textarea value={woDesc} onChange={(e) => setWoDesc(e.target.value)}
                  placeholder="Descripción (opcional)" rows={3}
                  style={{ ...input, resize: "vertical", fontFamily: "inherit" }} />
                <button onClick={() => void handleCreateWO()} disabled={woSubmitting || !woTitle.trim()}
                  style={{ ...btn(), opacity: woSubmitting ? 0.6 : 1, width: "fit-content" }}>
                  <Plus size={13} />Crear OT
                </button>
              </div>
            </div>
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Órdenes activas</div>
              {workOrders.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 13 }}>Sin órdenes de trabajo.</div> : (
                <div style={{ display: "grid", gap: 8 }}>
                  {workOrders.map((wo) => (
                    <div key={wo.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{wo.title}</div>
                        {wo.description && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{wo.description.slice(0, 80)}</div>}
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                          prioridad: {wo.priority} · {new Date(wo.createdAt).toLocaleDateString("es-MX")}
                        </div>
                      </div>
                      <StatusBadge status={wo.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </HtmlInCanvasPanel>
  );
}
