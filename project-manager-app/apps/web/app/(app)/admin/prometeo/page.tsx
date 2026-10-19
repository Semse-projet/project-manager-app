"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Database, FileText, Layers, Loader, Plus, Search, Trash2, Upload, Zap } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { useLanguage } from "../../../../lib/language-context";

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
  documentId: string; documentTitle: string; chunkId: string; chunkIndex: number;
  text: string; score: number; semanticScore?: number; feedbackScore?: number; retrievalMode?: string;
};

type RagCitation = {
  type: string; id: string; chunkId?: string;
  label: string; excerpt: string; chunkIndex?: number; score?: number;
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
  const { t } = useLanguage();
  const colors: Record<string, [string, string]> = {
    indexed:    ["var(--ok)", "rgba(16,185,129,.12)"],
    processing: ["var(--warn)", "rgba(245,158,11,.12)"],
    pending:    ["#94a3b8", "rgba(148,163,184,.1)"],
    failed:     ["var(--error)", "rgba(239,68,68,.12)"],
    open:       ["#6366f1", "rgba(99,102,241,.12)"],
    in_progress:["var(--warn)", "rgba(245,158,11,.12)"],
    closed:     ["var(--ok)", "rgba(16,185,129,.12)"],
    available:  ["var(--ok)", "rgba(16,185,129,.12)"],
    in_use:     ["var(--warn)", "rgba(245,158,11,.12)"],
  };
  const [color, bg] = colors[status] ?? ["#94a3b8", "rgba(148,163,184,.1)"];
  return (
    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, color, background: bg }}>
      {Object.hasOwn(colors, status) ? t(`prom.status.${status}`) : status}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PrometeoPage() {
  const { t, language } = useLanguage();
  const displayDate = (value: string) => new Date(value).toLocaleDateString(language === "en" ? "en-US" : "es-MX");
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
    answer: string; citations: RagCitation[]; confidence: number;
    nextBestAction?: string; steps?: string[]; warnings?: string[]; evidenceNeeded?: string[];
    insufficientContext?: boolean; provider: string; fallbackUsed: boolean;
  } | null>(null);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragError, setRagError] = useState<string | null>(null);

  // Feedback state: Map<chunkId, "sending" | "confirm" | "correct" | "flag">
  const [feedbackState, setFeedbackState] = useState<Record<string, string>>({});

  async function handleFeedback(chunkId: string | undefined, type: "confirm" | "correct" | "flag", query?: string) {
    if (!chunkId || feedbackState[chunkId]) return;
    setFeedbackState(prev => ({ ...prev, [chunkId]: "sending" }));
    try {
      const res = await fetch(`/api/semse/prometeo/chunks/${encodeURIComponent(chunkId)}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, query }),
      });
      const json = await res.json() as { data?: { recorded: boolean } };
      setFeedbackState(prev => ({ ...prev, [chunkId]: json.data?.recorded ? type : "error" }));
    } catch {
      setFeedbackState(prev => ({ ...prev, [chunkId]: "error" }));
    }
  }

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
    catch (err) { setLoadError(err instanceof Error ? err.message : t("prom.loadError")); }
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
      setIngestError(err instanceof Error ? err.message : t("prom.fileError"));
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
      await apiPost("/api/semse/prometeo/ingest", { title: ingestTitle, text: ingestText, sourceType: ingestType, trade: ingestTrade, visibility: ingestVisibility });
      setIngestTitle(""); setIngestText("");
      setIngestSuccess(true);
      setTimeout(() => setIngestSuccess(false), 5000);
      // Poll until indexed or 10s
      let attempts = 0;
      const poll = setInterval(() => { attempts++; void loadDocs(); if (attempts >= 5) clearInterval(poll); }, 2000);
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : t("prom.ingestError"));
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
        question: ragQuestion, locale: language,
        trade: filterTrade || "general",
        ...(ragMode === "rag" && filterTrade ? { trade: filterTrade } : {}),
      });
      setRagResult(result);
    } catch (err) {
      setRagError(err instanceof Error ? err.message : t("prom.queryError"));
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

  const TRADES = ["general","electrical","plumbing","drywall","painting","carpentry","hvac","siding","demolition","cleaning","bathroom","kitchen","windows_doors"] as const;

  const TABS = [
    { id: "docs", icon: Database }, { id: "library", icon: Layers }, { id: "query", icon: BookOpen },
    { id: "search", icon: Search }, { id: "assets", icon: Zap }, { id: "workorders", icon: FileText },
  ] as const;

  return (
    <HtmlInCanvasPanel>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 16 }}>

        <AdminPageHeader
          title="Prometeo Engine"
          subtitle={t("prom.subtitle")}
          icon={BookOpen}
          iconColor="#818cf8"
          iconBg="rgba(99,102,241,.15)"
          showBack={false}
          actions={
            <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--muted)" }}>
              <span><strong style={{ color: "var(--ink)" }}>{docs.filter((d) => d.status === "indexed").length}</strong> {t("prom.indexed")}</span>
              <span><strong style={{ color: "var(--ink)" }}>{assets.length}</strong> {t("prom.assets")}</span>
              <span><strong style={{ color: "var(--ink)" }}>{workOrders.length}</strong> {t("prom.ordersShort")}</span>
            </div>
          }
        />

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8 }}>
          {TABS.map(({ id, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ ...btn(tab === id ? "#fff" : "var(--muted)", tab === id ? "#6366f1" : "transparent"), borderRadius: 10, border: tab === id ? "none" : "1px solid var(--border)" }}>
              <Icon size={13} />{t(`prom.tab.${id}`)}
            </button>
          ))}
        </div>

        {/* ── INGESTAR / BASE RAG ── */}
        {tab === "docs" && (
          <div style={{ display: "grid", gap: 14 }}>
            {/* Ingest form */}
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>{t("prom.ingestDoc")}</div>
              {/* Mode toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {(["text", "file"] as const).map((m) => (
                  <button key={m} onClick={() => setIngestMode(m)}
                    style={{ ...btn(ingestMode === m ? "#fff" : "var(--muted)", ingestMode === m ? "#6366f1" : "transparent"), border: ingestMode === m ? "none" : "1px solid var(--border)", fontSize: 11 }}>
                    {m === "text" ? <><Plus size={12} />{t("prom.freeText")}</> : <><Upload size={12} />{t("prom.file")}</>}
                  </button>
                ))}
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <input value={ingestTitle} onChange={(e) => setIngestTitle(e.target.value)}
                  placeholder={t("prom.docTitle")} style={input} />
                {/* Trade + Type + Visibility */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <select value={ingestTrade} onChange={(e) => setIngestTrade(e.target.value)} style={{ ...input, cursor: "pointer" }}>
                    {TRADES.map((trade) => <option key={trade} value={trade}>{t(`prom.trade.${trade}`)}</option>)}
                  </select>
                  <select value={ingestType} onChange={(e) => setIngestType(e.target.value)} style={{ ...input, cursor: "pointer" }}>
                    <option value="text">{t("prom.freeText")}</option>
                    <option value="manual">{t("prom.docType.manual")}</option>
                    <option value="book">{t("prom.docType.book")}</option>
                    <option value="contract">{t("prom.docType.contract")}</option>
                    <option value="scope">{t("prom.docType.scope")}</option>
                    <option value="report">{t("prom.docType.report")}</option>
                    <option value="course">{t("prom.docType.course")}</option>
                    <option value="checklist">{t("prom.docType.checklist")}</option>
                    <option value="evidence">{t("prom.docType.evidence")}</option>
                  </select>
                  <select value={ingestVisibility} onChange={(e) => setIngestVisibility(e.target.value)} style={{ ...input, cursor: "pointer" }}>
                    <option value="public_training">{t("prom.visibility.public_training")}</option>
                    <option value="tenant_private">{t("prom.visibility.tenant_private")}</option>
                    <option value="project_private">{t("prom.visibility.project_private")}</option>
                  </select>
                </div>

                {ingestMode === "text" ? (
                  <>
                    <textarea value={ingestText} onChange={(e) => setIngestText(e.target.value)}
                      placeholder={t("prom.pasteContent")} rows={6}
                      style={{ ...input, resize: "vertical", fontFamily: "inherit" }} />
                    <button onClick={() => void handleIngest()} disabled={ingesting || !ingestTitle.trim() || !ingestText.trim()}
                      style={{ ...btn(), opacity: ingesting ? 0.6 : 1, width: "fit-content" }}>
                      {ingesting ? <><Loader size={13} />{t("prom.processing")}</> : <><Plus size={13} />{t("prom.ingestText")}</>}
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
                        <Upload size={13} />{ingestFile ? ingestFile.name : t("prom.selectFile")}
                      </button>
                      {ingestFile && <span style={{ fontSize: 11, color: "var(--muted)" }}>{(ingestFile.size / 1024).toFixed(0)} KB</span>}
                    </div>
                    <button onClick={() => void handleIngestFile()} disabled={ingesting || !ingestTitle.trim() || !ingestFile}
                      style={{ ...btn(), opacity: ingesting ? 0.6 : 1, width: "fit-content" }}>
                      {ingesting ? <><Loader size={13} />{t("prom.processingFile")}</> : <><Upload size={13} />{t("prom.ingestFile")}</>}
                    </button>
                  </>
                )}
                {ingestSuccess && <span style={{ fontSize: 12, color: "#86efac" }}>✅ {t("prom.docSent")}</span>}
                {ingestError && <span style={{ fontSize: 12, color: "#fca5a5" }}>❌ {ingestError}</span>}
              </div>
            </div>

            {/* Docs list */}
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{t("prom.indexedDocs")}</div>
                <button onClick={() => void loadDocs()} style={{ ...btn("var(--muted)", "transparent"), border: "1px solid var(--border)", fontSize: 11 }}>
                  {t("prom.refresh")}
                </button>
              </div>
              {loadError && <div style={{ fontSize: 12, color: "#fca5a5", marginBottom: 10 }}>⚠ {loadError}</div>}
              {loading ? <div style={{ color: "var(--muted)", fontSize: 13 }}>{t("prom.loading")}</div> : docs.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 13 }}>{t("prom.noDocs")}</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {docs.map((d) => (
                    <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                          {d.sourceType} · {d.chunkCount} {t("prom.chunks")} · {displayDate(d.createdAt)}
                        </div>
                        {d.errorMsg && <div style={{ fontSize: 11, color: "var(--error)", marginTop: 2 }}>{d.errorMsg}</div>}
                      </div>
                      <StatusBadge status={d.status} />
                      <button onClick={() => { if (window.confirm(`${t("prom.deleteConfirmPrefix")} "${d.title}" ${t("prom.deleteConfirmSuffix")}`)) void handleDeleteDoc(d.id); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)", padding: 4 }}>
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
                <div style={{ fontWeight: 800, fontSize: 14 }}>{t("prom.library")}</div>
                <button onClick={() => void loadTradeLibrary()} style={{ marginLeft: "auto", ...btn("var(--muted)", "transparent"), border: "1px solid var(--border)", fontSize: 11 }}>{t("prom.refresh")}</button>
              </div>
              {tradeLibrary.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 13 }}>{t("prom.loadingLibrary")}</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                  {tradeLibrary.map((entry) => (
                    <div key={entry.trade} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)", display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>{TRADES.includes(entry.trade as typeof TRADES[number]) ? t(`prom.trade.${entry.trade}`) : entry.label}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{entry.indexedCount}/{entry.documentsCount} {t("prom.indexedDocsLabel")} · {entry.chunksCount} {t("prom.chunks")}</div>
                      {entry.types.length > 0 && <div style={{ fontSize: 10, color: "var(--muted)" }}>{entry.types.join(", ")}</div>}
                      {entry.indexedCount > 0 && (
                        <button
                          onClick={() => { setFilterTrade(entry.trade); setTab("query"); }}
                          style={{ ...btn("#818cf8", "rgba(99,102,241,.08)"), fontSize: 10, padding: "5px 8px", marginTop: 4 }}>
                          <BookOpen size={10} />{t("prom.query")}
                        </button>
                      )}
                      {entry.indexedCount === 0 && (
                        <button onClick={() => { setIngestTrade(entry.trade); setTab("docs"); }}
                          style={{ ...btn("var(--muted)", "transparent"), fontSize: 10, padding: "5px 8px", border: "1px solid var(--border)" }}>
                          <Plus size={10} />{t("prom.ingestFirst")}
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
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>{t("prom.askAI")}</div>
              {/* Mode toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {(["rag","guide"] as const).map((m) => (
                  <button key={m} onClick={() => setRagMode(m)}
                    style={{ ...btn(ragMode === m ? "#fff" : "var(--muted)", ragMode === m ? "#6366f1" : "transparent"), border: ragMode === m ? "none" : "1px solid var(--border)", fontSize: 11 }}>
                    {t(`prom.mode.${m}`)}
                  </button>
                ))}
                <select value={filterTrade} onChange={(e) => setFilterTrade(e.target.value)}
                  style={{ ...input, width: "auto", fontSize: 11, padding: "5px 8px", cursor: "pointer" }}>
                  <option value="">{t("prom.allTrades")}</option>
                  {TRADES.map((trade) => <option key={trade} value={trade}>{t(`prom.trade.${trade}`)}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                {ragMode === "guide"
                  ? `${t("prom.guidePrefix")} ${(TRADES.find((trade) => trade === filterTrade) ? t(`prom.trade.${filterTrade}`) : t("prom.yourTrade"))} ${t("prom.guideSuffix")}`
                  : t("prom.ragExplanation")}
                {docs.filter((d) => d.status === "indexed").length === 0 && <span style={{ color: "#fbbf24" }}> — {t("prom.indexFirst")}</span>}
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <input
                  value={ragQuestion}
                  onChange={(e) => setRagQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleRagQuery()}
                  placeholder={ragMode === "guide" ? t("prom.guidePlaceholder") : t("prom.askPlaceholder")}
                  style={{ ...input, flex: 1 }}
                />
                <button
                  onClick={() => void handleRagQuery()}
                  disabled={ragLoading || !ragQuestion.trim()}
                  style={{ ...btn(), opacity: ragLoading ? 0.6 : 1, whiteSpace: "nowrap" }}
                >
                  {ragLoading ? <><Loader size={13} />{t("prom.querying")}</> : <><BookOpen size={13} />{t("prom.ask")}</>}
                </button>
              </div>

              {ragError && <div style={{ fontSize: 12, color: "#fca5a5", marginBottom: 10 }}>⚠ {ragError}</div>}

              {ragResult && (
                <div style={{ display: "grid", gap: 12 }}>
                  {/* Answer */}
                  <div style={{ padding: "14px 16px", borderRadius: 12, background: ragResult.insufficientContext ? "rgba(251,191,36,.06)" : "rgba(99,102,241,.06)", border: `1px solid ${ragResult.insufficientContext ? "rgba(251,191,36,.3)" : "rgba(99,102,241,.3)"}` }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: ragResult.insufficientContext ? "#fbbf24" : "#818cf8", marginBottom: 8, textTransform: "uppercase" }}>
                      {t(ragResult.insufficientContext ? "prom.insufficientContext" : "prom.prometeoAnswer")}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{ragResult.answer}</div>
                    {ragResult.nextBestAction && (
                      <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(99,102,241,.08)", fontSize: 12, color: "#a5b4fc" }}>
                        <strong>{t("prom.nextAction")}</strong> {ragResult.nextBestAction}
                      </div>
                    )}
                    {/* Trade Guide extras */}
                    {ragResult.steps && ragResult.steps.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#86efac", marginBottom: 4 }}>{t("prom.steps")}</div>
                        {ragResult.steps.map((s, i) => <div key={i} style={{ fontSize: 12, color: "var(--muted)", paddingLeft: 8 }}>{i + 1}. {s}</div>)}
                      </div>
                    )}
                    {ragResult.warnings && ragResult.warnings.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#fbbf24", marginBottom: 4 }}>⚠ {t("prom.warnings")}</div>
                        {ragResult.warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: "#fbbf24", paddingLeft: 8 }}>• {w}</div>)}
                      </div>
                    )}
                    {ragResult.evidenceNeeded && ragResult.evidenceNeeded.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#818cf8", marginBottom: 4 }}>{t("prom.evidenceRequired")}</div>
                        {ragResult.evidenceNeeded.map((e, i) => <div key={i} style={{ fontSize: 12, color: "var(--muted)", paddingLeft: 8 }}>📷 {e}</div>)}
                      </div>
                    )}
                  </div>

                  {/* Citations */}
                  {ragResult.citations.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase" }}>
                        {t("prom.sources")} ({ragResult.citations.length})
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {ragResult.citations.map((c, i) => {
                          const fb = c.chunkId ? feedbackState[c.chunkId] : undefined;
                          return (
                          <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <strong style={{ fontSize: 12, color: "#818cf8" }}>{c.label}</strong>
                              {c.score != null && <span style={{ fontSize: 10, color: "var(--muted)" }}>{t("prom.score")} {c.score.toFixed(3)}</span>}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, marginBottom: 8 }}>{c.excerpt}</div>
                            {c.chunkId && (
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                {fb === "sending" && <span style={{ fontSize: 10, color: "var(--muted)" }}>{t("prom.feedback.sending")}</span>}
                                {fb === "confirm" && <span style={{ fontSize: 10, color: "#86efac" }}>{t("prom.feedback.confirm")}</span>}
                                {fb === "correct" && <span style={{ fontSize: 10, color: "#fbbf24" }}>{t("prom.feedback.correct")}</span>}
                                {fb === "flag"    && <span style={{ fontSize: 10, color: "#f87171" }}>{t("prom.feedback.flag")}</span>}
                                {fb === "error"   && <span style={{ fontSize: 10, color: "#f87171" }}>{t("prom.feedback.error")}</span>}
                                {!fb && (<>
                                  <button onClick={() => void handleFeedback(c.chunkId, "confirm", ragQuestion)}
                                    style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, border: "1px solid #86efac44", background: "rgba(134,239,172,.08)", color: "#86efac", cursor: "pointer" }}>
                                    {t("prom.feedback.useful")}
                                  </button>
                                  <button onClick={() => void handleFeedback(c.chunkId, "correct", ragQuestion)}
                                    style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, border: "1px solid #fbbf2444", background: "rgba(251,191,36,.08)", color: "#fbbf24", cursor: "pointer" }}>
                                    {t("prom.feedback.incorrect")}
                                  </button>
                                  <button onClick={() => void handleFeedback(c.chunkId, "flag", ragQuestion)}
                                    style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, border: "1px solid #f8717144", background: "rgba(248,113,113,.08)", color: "#f87171", cursor: "pointer" }}>
                                    {t("prom.feedback.irrelevant")}
                                  </button>
                                </>)}
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div style={{ fontSize: 10, color: "var(--muted)", display: "flex", gap: 16 }}>
                    <span>{t("prom.provider")} <strong style={{ color: "var(--ink)" }}>{ragResult.provider}</strong></span>
                    <span>{t("prom.confidence")} <strong style={{ color: "var(--ink)" }}>{Math.round(ragResult.confidence * 100)}%</strong></span>
                    {ragResult.fallbackUsed && <span style={{ color: "#fbbf24" }}>{t("prom.fallback")}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SEARCH ── */}
        {tab === "search" && (
          <div style={card}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>{t("prom.semanticSearch")}</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
                placeholder={t("prom.searchPlaceholder")} style={{ ...input, flex: 1 }} />
              <button onClick={() => void handleSearch()} disabled={searching || !searchQuery.trim()}
                style={{ ...btn(), opacity: searching ? 0.6 : 1, whiteSpace: "nowrap" }}>
                {searching ? t("prom.searching") : <><Search size={13} />{t("prom.search")}</>}
              </button>
            </div>
            {searchResults.length === 0 && !searching && (
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                {docs.filter((d) => d.status === "indexed").length === 0
                  ? t("prom.searchNeedsDocs")
                  : t("prom.searchHint")}
              </div>
            )}
            <div style={{ display: "grid", gap: 10 }}>
              {searchResults.map((r, i) => {
                const fb = r.chunkId ? feedbackState[r.chunkId] : undefined;
                return (
                <div key={i} style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(99,102,241,.05)", border: "1px solid rgba(99,102,241,.15)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <strong style={{ fontSize: 12, color: "#818cf8" }}>{r.documentTitle}</strong>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      {t("prom.chunks")} {r.chunkIndex} · {t("prom.score")} {r.score.toFixed(3)}
                      {r.retrievalMode === "hybrid" && <span style={{ color: "#818cf8", marginLeft: 6 }}>hybrid</span>}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink)", marginBottom: 8 }}>{r.text.slice(0, 400)}{r.text.length > 400 ? "…" : ""}</div>
                  {r.chunkId && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {fb === "sending" && <span style={{ fontSize: 10, color: "var(--muted)" }}>{t("prom.feedback.sending")}</span>}
                      {fb === "confirm" && <span style={{ fontSize: 10, color: "#86efac" }}>{t("prom.feedback.confirm")}</span>}
                      {fb === "correct" && <span style={{ fontSize: 10, color: "#fbbf24" }}>{t("prom.feedback.correct")}</span>}
                      {fb === "flag"    && <span style={{ fontSize: 10, color: "#f87171" }}>{t("prom.feedback.flag")}</span>}
                      {fb === "error"   && <span style={{ fontSize: 10, color: "#f87171" }}>{t("prom.feedback.error")}</span>}
                      {!fb && (<>
                        <button onClick={() => void handleFeedback(r.chunkId, "confirm", searchQuery)}
                          style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, border: "1px solid #86efac44", background: "rgba(134,239,172,.08)", color: "#86efac", cursor: "pointer" }}>
                          {t("prom.feedback.useful")}
                        </button>
                        <button onClick={() => void handleFeedback(r.chunkId, "correct", searchQuery)}
                          style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, border: "1px solid #fbbf2444", background: "rgba(251,191,36,.08)", color: "#fbbf24", cursor: "pointer" }}>
                          {t("prom.feedback.incorrect")}
                        </button>
                        <button onClick={() => void handleFeedback(r.chunkId, "flag", searchQuery)}
                          style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, border: "1px solid #f8717144", background: "rgba(248,113,113,.08)", color: "#f87171", cursor: "pointer" }}>
                          {t("prom.feedback.irrelevant")}
                        </button>
                      </>)}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ASSETS ── */}
        {tab === "assets" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>{t("prom.registerAsset")}</div>
              <div style={{ display: "flex", gap: 10 }}>
                <input value={assetName} onChange={(e) => setAssetName(e.target.value)}
                  placeholder={t("prom.assetName")} style={{ ...input, flex: 1 }} />
                <select value={assetCat} onChange={(e) => setAssetCat(e.target.value)}
                  style={{ ...input, width: "auto", cursor: "pointer" }}>
                  <option value="equipment">{t("prom.assetCategory.equipment")}</option>
                  <option value="material">{t("prom.assetCategory.material")}</option>
                  <option value="vehicle">{t("prom.assetCategory.vehicle")}</option>
                  <option value="tool">{t("prom.assetCategory.tool")}</option>
                  <option value="space">{t("prom.assetCategory.space")}</option>
                </select>
                <button onClick={() => void handleCreateAsset()} disabled={assetSubmitting || !assetName.trim()}
                  style={{ ...btn(), opacity: assetSubmitting ? 0.6 : 1 }}>
                  <Plus size={13} />{t("prom.add")}
                </button>
              </div>
            </div>
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>{t("prom.assetInventory")}</div>
              {assets.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 13 }}>{t("prom.noAssets")}</div> : (
                <div style={{ display: "grid", gap: 8 }}>
                  {assets.map((a) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)" }}>
                      <Zap size={14} color="#818cf8" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{(["equipment", "material", "vehicle", "tool", "space"].includes(a.category) ? t(`prom.assetCategory.${a.category}`) : a.category)}{a.location ? ` · ${a.location}` : ""}</div>
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
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>{t("prom.newOrder")}</div>
              <div style={{ display: "grid", gap: 10 }}>
                <input value={woTitle} onChange={(e) => setWoTitle(e.target.value)}
                  placeholder={t("prom.orderTitle")} style={input} />
                <div style={{ display: "flex", gap: 10 }}>
                  <select value={woPriority} onChange={(e) => setWoPriority(e.target.value)}
                    style={{ ...input, cursor: "pointer" }}>
                    <option value="low">{t("prom.priority.low")}</option>
                    <option value="medium">{t("prom.priority.medium")}</option>
                    <option value="high">{t("prom.priority.high")}</option>
                    <option value="urgent">{t("prom.priority.urgent")}</option>
                  </select>
                </div>
                <textarea value={woDesc} onChange={(e) => setWoDesc(e.target.value)}
                  placeholder={t("prom.orderDescription")} rows={3}
                  style={{ ...input, resize: "vertical", fontFamily: "inherit" }} />
                <button onClick={() => void handleCreateWO()} disabled={woSubmitting || !woTitle.trim()}
                  style={{ ...btn(), opacity: woSubmitting ? 0.6 : 1, width: "fit-content" }}>
                  <Plus size={13} />{t("prom.createOrder")}
                </button>
              </div>
            </div>
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>{t("prom.activeOrders")}</div>
              {workOrders.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 13 }}>{t("prom.noOrders")}</div> : (
                <div style={{ display: "grid", gap: 8 }}>
                  {workOrders.map((wo) => (
                    <div key={wo.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{wo.title}</div>
                        {wo.description && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{wo.description.slice(0, 80)}</div>}
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                          {t("prom.priority")} {t(`prom.priority.${wo.priority}`)} · {displayDate(wo.createdAt)}
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
