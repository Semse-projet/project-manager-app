"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Database, FileText, Layers, Loader, Plus, Search, Trash2, Upload, Zap } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";

// ── Types ──────────────────────────────────────────────────────────────────────

type PrometeoDoc = {
  id: string; title: string; sourceType: string; status: string;
  chunkCount: number; createdAt: string; errorMsg?: string | null;
  projectId?: string | null;
};

type PrometeoDocMeta = {
  trade?: string; visibility?: string; originalFileName?: string;
  mimeType?: string; pageCount?: number; parser?: string; parseWarnings?: string[];
};

type SearchResult = {
  documentId: string; documentTitle: string; chunkIndex: number;
  text: string; score: number;
};

type TradeLibEntry = {
  trade: string; label: string; documentsCount: number;
  indexedCount: number; chunksCount: number; lastIndexedAt: string | null; types: string[];
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
  const d = await res.json() as { data?: T; error?: { message?: string } };
  if (!res.ok) throw new Error(d?.error?.message ?? `Error ${res.status}`);
  return d.data as T;
}
async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json() as { data?: T; error?: { message?: string } };
  if (!res.ok) throw new Error(d?.error?.message ?? `Error ${res.status}`);
  return d.data as T;
}
async function apiDelete(path: string) {
  const res = await fetch(path, { method: "DELETE" });
  if (!res.ok) { const d = await res.json() as { error?: { message?: string } }; throw new Error(d?.error?.message ?? `Error ${res.status}`); }
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
  const [tab, setTab] = useState<"docs" | "query" | "search" | "library" | "assets" | "workorders">("docs");
  const [docs, setDocs] = useState<PrometeoDoc[]>([]);
  const [tradeLibrary, setTradeLibrary] = useState<TradeLibEntry[]>([]);
  const [filterTrade, setFilterTrade] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [ingestFile, setIngestFile] = useState<File | null>(null);
  const [ingestTrade, setIngestTrade] = useState("general");
  const [ingestVisibility, setIngestVisibility] = useState("public_training");
  const [ingestMode, setIngestMode] = useState<"text" | "file">("text");
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
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestSuccess, setIngestSuccess] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // RAG query
  const [ragQuestion, setRagQuestion] = useState("");
  const [ragMode, setRagMode] = useState<"rag" | "guide">("rag");
  const [ragResult, setRagResult] = useState<{
    answer: string; citations: Array<{ label: string; excerpt: string; score?: number; documentTitle?: string }>; confidence: number;
    nextBestAction?: string; steps?: string[]; warnings?: string[]; evidenceNeeded?: string[];
    insufficientContext?: boolean; provider: string; fallbackUsed: boolean;
  } | null>(null);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragError, setRagError] = useState<string | null>(null);

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
    setLoadError(null);
    try { setDocs(await apiGet<PrometeoDoc[]>("/api/semse/prometeo/documents")); }
    catch (err) { setLoadError(err instanceof Error ? err.message : "Error al cargar documentos"); }
    finally { setLoading(false); }
  }

  async function loadTradeLibrary() {
    try { setTradeLibrary(await apiGet<TradeLibEntry[]>("/api/semse/prometeo/trade-library")); } catch { /**/ }
  }

  async function handleIngestFile() {
    if (!ingestFile || !ingestTitle.trim()) return;
    setIngesting(true);
    setIngestError(null);
    setIngestSuccess(false);
    try {
      // Convert file to base64
      const ab = await ingestFile.arrayBuffer();
      const fileBase64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
      await apiPost("/api/semse/prometeo/ingest-file", {
        fileBase64, mimeType: ingestFile.type, fileName: ingestFile.name,
        title: ingestTitle, trade: ingestTrade, visibility: ingestVisibility,
        sourceType: ingestFile.type.includes("pdf") ? "pdf" : ingestFile.type.includes("word") ? "docx" : "text",
      });
      setIngestTitle(""); setIngestFile(null);
      setIngestSuccess(true);
      setTimeout(() => setIngestSuccess(false), 5000);
      let attempts = 0;
      const poll = setInterval(() => { attempts++; void loadDocs(); void loadTradeLibrary(); if (attempts >= 5) clearInterval(poll); }, 2000);
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : "Error al ingestar archivo");
    } finally { setIngesting(false); }
  }

  async function loadAssets() {
    try { setAssets(await apiGet<Asset[]>("/api/semse/prometeo/assets")); } catch { /**/ }
  }

  async function loadWorkOrders() {
    try { setWorkOrders(await apiGet<WorkOrder[]>("/api/semse/prometeo/work-orders")); } catch { /**/ }
  }

  useEffect(() => { void loadDocs(); void loadAssets(); void loadWorkOrders(); void loadTradeLibrary(); }, []);

  async function handleIngest() {
    if (!ingestTitle.trim() || !ingestText.trim()) return;
    setIngesting(true);
    setIngestError(null);
    setIngestSuccess(false);
    try {
      await apiPost("/api/semse/prometeo/ingest", { title: ingestTitle, text: ingestText, sourceType: ingestType });
      setIngestTitle(""); setIngestText("");
      setIngestSuccess(true);
      setTimeout(() => setIngestSuccess(false), 5000);
      // Poll until indexed or 10s
      let attempts = 0;
      const poll = setInterval(() => { attempts++; void loadDocs(); if (attempts >= 5) clearInterval(poll); }, 2000);
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : "Error al ingestar");
    } finally { setIngesting(false); }
  }

  async function handleRagQuery() {
    if (!ragQuestion.trim()) return;
    setRagLoading(true);
    setRagError(null);
    setRagResult(null);
    try {
      const endpoint = ragMode === "guide" ? "/api/semse/prometeo/trade-guide" : "/api/semse/prometeo/rag-query";
      const result = await apiPost<typeof ragResult>(endpoint, {
        question: ragQuestion, locale: "es",
        trade: filterTrade || "general",
        ...(ragMode === "rag" && filterTrade ? { trade: filterTrade } : {}),
      });
      setRagResult(result);
    } catch (err) {
      setRagError(err instanceof Error ? err.message : "Error en consulta");
    } finally { setRagLoading(false); }
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

  const TRADES = [
    { value: "general", label: "General" }, { value: "electrical", label: "Electricidad" },
    { value: "plumbing", label: "Plomería" }, { value: "drywall", label: "Drywall" },
    { value: "painting", label: "Pintura" }, { value: "carpentry", label: "Carpintería" },
    { value: "hvac", label: "HVAC" }, { value: "siding", label: "Siding" },
    { value: "demolition", label: "Demolición" }, { value: "cleaning", label: "Limpieza" },
    { value: "bathroom", label: "Baños" }, { value: "kitchen", label: "Cocinas" },
    { value: "windows_doors", label: "Ventanas/Puertas" },
  ] as const;

  const TABS = [
    { id: "docs",       label: "Ingestar",           icon: Database },
    { id: "library",    label: "Biblioteca",         icon: Layers },
    { id: "query",      label: "Consultar IA",       icon: BookOpen },
    { id: "search",     label: "Búsqueda",           icon: Search },
    { id: "assets",     label: "Activos",            icon: Zap },
    { id: "workorders", label: "OTs",                icon: FileText },
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

        {/* ── INGESTAR / BASE RAG ── */}
        {tab === "docs" && (
          <div style={{ display: "grid", gap: 14 }}>
            {/* Ingest form */}
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Ingestar documento</div>
              {/* Mode toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {(["text", "file"] as const).map((m) => (
                  <button key={m} onClick={() => setIngestMode(m)}
                    style={{ ...btn(ingestMode === m ? "#fff" : "var(--muted)", ingestMode === m ? "#6366f1" : "transparent"), border: ingestMode === m ? "none" : "1px solid var(--border)", fontSize: 11 }}>
                    {m === "text" ? <><Plus size={12} />Texto libre</> : <><Upload size={12} />Archivo (PDF/DOCX/TXT)</>}
                  </button>
                ))}
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <input value={ingestTitle} onChange={(e) => setIngestTitle(e.target.value)}
                  placeholder="Título del documento" style={input} />
                {/* Trade + Type + Visibility */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <select value={ingestTrade} onChange={(e) => setIngestTrade(e.target.value)} style={{ ...input, cursor: "pointer" }}>
                    {TRADES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <select value={ingestType} onChange={(e) => setIngestType(e.target.value)} style={{ ...input, cursor: "pointer" }}>
                    <option value="text">Texto libre</option>
                    <option value="manual">Manual técnico</option>
                    <option value="book">Libro</option>
                    <option value="contract">Contrato</option>
                    <option value="scope">Alcance de trabajo</option>
                    <option value="report">Reporte</option>
                    <option value="course">Curso</option>
                    <option value="checklist">Checklist</option>
                    <option value="evidence">Evidencia transcrita</option>
                  </select>
                  <select value={ingestVisibility} onChange={(e) => setIngestVisibility(e.target.value)} style={{ ...input, cursor: "pointer" }}>
                    <option value="public_training">Público/Entrenamiento</option>
                    <option value="tenant_private">Privado organización</option>
                    <option value="project_private">Privado proyecto</option>
                  </select>
                </div>

                {ingestMode === "text" ? (
                  <>
                    <textarea value={ingestText} onChange={(e) => setIngestText(e.target.value)}
                      placeholder="Pega el contenido del documento aquí..." rows={6}
                      style={{ ...input, resize: "vertical", fontFamily: "inherit" }} />
                    <button onClick={() => void handleIngest()} disabled={ingesting || !ingestTitle.trim() || !ingestText.trim()}
                      style={{ ...btn(), opacity: ingesting ? 0.6 : 1, width: "fit-content" }}>
                      {ingesting ? <><Loader size={13} />Procesando…</> : <><Plus size={13} />Ingestar texto</>}
                    </button>
                  </>
                ) : (
                  <>
                    <input type="file" ref={fileInputRef} accept=".pdf,.docx,.doc,.txt,.md,.markdown"
                      style={{ display: "none" }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) setIngestFile(f); }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        style={{ ...btn("var(--muted)", "rgba(255,255,255,.04)"), border: "1px solid var(--border)" }}>
                        <Upload size={13} />{ingestFile ? ingestFile.name : "Seleccionar archivo"}
                      </button>
                      {ingestFile && <span style={{ fontSize: 11, color: "var(--muted)" }}>{(ingestFile.size / 1024).toFixed(0)} KB</span>}
                    </div>
                    <button onClick={() => void handleIngestFile()} disabled={ingesting || !ingestTitle.trim() || !ingestFile}
                      style={{ ...btn(), opacity: ingesting ? 0.6 : 1, width: "fit-content" }}>
                      {ingesting ? <><Loader size={13} />Procesando archivo…</> : <><Upload size={13} />Ingestar archivo</>}
                    </button>
                  </>
                )}
                {ingestSuccess && <span style={{ fontSize: 12, color: "#86efac" }}>✅ Documento enviado — indexando en segundo plano</span>}
                {ingestError && <span style={{ fontSize: 12, color: "#fca5a5" }}>❌ {ingestError}</span>}
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
              {loadError && <div style={{ fontSize: 12, color: "#fca5a5", marginBottom: 10 }}>⚠ {loadError}</div>}
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

        {/* ── BIBLIOTECA POR TRADE ── */}
        {tab === "library" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <Layers size={16} color="#818cf8" />
                <div style={{ fontWeight: 800, fontSize: 14 }}>Biblioteca por Oficio</div>
                <button onClick={() => void loadTradeLibrary()} style={{ marginLeft: "auto", ...btn("var(--muted)", "transparent"), border: "1px solid var(--border)", fontSize: 11 }}>Actualizar</button>
              </div>
              {tradeLibrary.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 13 }}>Cargando biblioteca…</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                  {tradeLibrary.map((t) => (
                    <div key={t.trade} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)", display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.indexedCount}/{t.documentsCount} docs indexados · {t.chunksCount} chunks</div>
                      {t.types.length > 0 && <div style={{ fontSize: 10, color: "var(--muted)" }}>{t.types.join(", ")}</div>}
                      {t.indexedCount > 0 && (
                        <button
                          onClick={() => { setFilterTrade(t.trade); setTab("query"); }}
                          style={{ ...btn("#818cf8", "rgba(99,102,241,.08)"), fontSize: 10, padding: "5px 8px", marginTop: 4 }}>
                          <BookOpen size={10} />Consultar
                        </button>
                      )}
                      {t.indexedCount === 0 && (
                        <button onClick={() => { setIngestTrade(t.trade); setTab("docs"); }}
                          style={{ ...btn("var(--muted)", "transparent"), fontSize: 10, padding: "5px 8px", border: "1px solid var(--border)" }}>
                          <Plus size={10} />Ingestar primero
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CONSULTAR CON IA (RAG Query + Trade Guide) ── */}
        {tab === "query" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Consultar con IA</div>
              {/* Mode toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {([["rag","📚 Base documental"],["guide","🔧 Guía por oficio"]] as const).map(([m,label]) => (
                  <button key={m} onClick={() => setRagMode(m)}
                    style={{ ...btn(ragMode === m ? "#fff" : "var(--muted)", ragMode === m ? "#6366f1" : "transparent"), border: ragMode === m ? "none" : "1px solid var(--border)", fontSize: 11 }}>
                    {label}
                  </button>
                ))}
                <select value={filterTrade} onChange={(e) => setFilterTrade(e.target.value)}
                  style={{ ...input, width: "auto", fontSize: 11, padding: "5px 8px", cursor: "pointer" }}>
                  <option value="">Todos los oficios</option>
                  {TRADES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                {ragMode === "guide"
                  ? `Training Agent: responde usando manuales de ${TRADES.find((t) => t.value === filterTrade)?.label ?? "tu oficio"} indexados en Prometeo.`
                  : "Prometeo responde usando todos los documentos indexados con fuentes citadas."}
                {docs.filter((d) => d.status === "indexed").length === 0 && <span style={{ color: "#fbbf24" }}> — Primero indexa documentos.</span>}
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <input
                  value={ragQuestion}
                  onChange={(e) => setRagQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleRagQuery()}
                  placeholder={ragMode === "guide" ? "¿Qué debo revisar antes de comenzar? ¿Qué herramientas necesito?" : "¿Qué quieres saber?"}
                  style={{ ...input, flex: 1 }}
                />
                <button
                  onClick={() => void handleRagQuery()}
                  disabled={ragLoading || !ragQuestion.trim()}
                  style={{ ...btn(), opacity: ragLoading ? 0.6 : 1, whiteSpace: "nowrap" }}
                >
                  {ragLoading ? <><Loader size={13} />Consultando…</> : <><BookOpen size={13} />Preguntar</>}
                </button>
              </div>

              {ragError && <div style={{ fontSize: 12, color: "#fca5a5", marginBottom: 10 }}>⚠ {ragError}</div>}

              {ragResult && (
                <div style={{ display: "grid", gap: 12 }}>
                  {/* Answer */}
                  <div style={{ padding: "14px 16px", borderRadius: 12, background: ragResult.insufficientContext ? "rgba(251,191,36,.06)" : "rgba(99,102,241,.06)", border: `1px solid ${ragResult.insufficientContext ? "rgba(251,191,36,.3)" : "rgba(99,102,241,.3)"}` }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: ragResult.insufficientContext ? "#fbbf24" : "#818cf8", marginBottom: 8, textTransform: "uppercase" }}>
                      {ragResult.insufficientContext ? "Contexto insuficiente" : "Respuesta de Prometeo"}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{ragResult.answer}</div>
                    {ragResult.nextBestAction && (
                      <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(99,102,241,.08)", fontSize: 12, color: "#a5b4fc" }}>
                        <strong>Siguiente acción:</strong> {ragResult.nextBestAction}
                      </div>
                    )}
                    {/* Trade Guide extras */}
                    {ragResult.steps && ragResult.steps.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#86efac", marginBottom: 4 }}>PASOS</div>
                        {ragResult.steps.map((s, i) => <div key={i} style={{ fontSize: 12, color: "var(--muted)", paddingLeft: 8 }}>{i + 1}. {s}</div>)}
                      </div>
                    )}
                    {ragResult.warnings && ragResult.warnings.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#fbbf24", marginBottom: 4 }}>⚠ ADVERTENCIAS</div>
                        {ragResult.warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: "#fbbf24", paddingLeft: 8 }}>• {w}</div>)}
                      </div>
                    )}
                    {ragResult.evidenceNeeded && ragResult.evidenceNeeded.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#818cf8", marginBottom: 4 }}>EVIDENCIA SEMSE REQUERIDA</div>
                        {ragResult.evidenceNeeded.map((e, i) => <div key={i} style={{ fontSize: 12, color: "var(--muted)", paddingLeft: 8 }}>📷 {e}</div>)}
                      </div>
                    )}
                  </div>

                  {/* Citations */}
                  {ragResult.citations.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase" }}>
                        Fuentes ({ragResult.citations.length})
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {ragResult.citations.map((c, i) => (
                          <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <strong style={{ fontSize: 12, color: "#818cf8" }}>{c.label}</strong>
                              {c.score != null && <span style={{ fontSize: 10, color: "var(--muted)" }}>score {c.score.toFixed(3)}</span>}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{c.excerpt}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div style={{ fontSize: 10, color: "var(--muted)", display: "flex", gap: 16 }}>
                    <span>Provider: <strong style={{ color: "var(--ink)" }}>{ragResult.provider}</strong></span>
                    <span>Confianza: <strong style={{ color: "var(--ink)" }}>{Math.round(ragResult.confidence * 100)}%</strong></span>
                    {ragResult.fallbackUsed && <span style={{ color: "#fbbf24" }}>fallback usado</span>}
                    <span style={{ color: "#86efac" }}>🔒 privacyCritical — procesado localmente</span>
                  </div>
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
