"use client";

import { useEffect, useState } from "react";
import { Wrench, Search, ChevronDown, ChevronUp, Code2, Package } from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { Card } from "@/components/ui";

type CatalogEntry = {
  id: string;
  name: string;
  category: string;
  description: string;
};

type ToolSchema = {
  trade: string;
  requiredFields: string[];
  optionalFields: string[];
  notes: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  mechanical:  "#06b6d4",
  finish:      "#8b5cf6",
  remodel:     "#f59e0b",
  exterior:    "#10b981",
  specialty:   "#ec4899",
  structural:  "#ef4444",
  services:    "#64748b",
};

export default function AdminToolsPage() {
  const [catalog, setCatalog]       = useState<CatalogEntry[]>([]);
  const [search, setSearch]         = useState("");
  const [category, setCategory]     = useState<string | null>(null);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [schemas, setSchemas]       = useState<Record<string, ToolSchema>>({});
  const [loadingSchema, setLoadingSchema] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/semse/tools/catalog")
      .then((r) => r.json())
      .then((j) => setCatalog(j?.data ?? []));
  }, []);

  async function loadSchema(tradeId: string) {
    if (schemas[tradeId]) {
      setExpanded(expanded === tradeId ? null : tradeId);
      return;
    }
    if (expanded === tradeId) { setExpanded(null); return; }
    setLoadingSchema(tradeId);
    try {
      const res  = await fetch(`/api/semse/tools/schema/${tradeId}`);
      const json = await res.json();
      if (json?.data) setSchemas((p) => ({ ...p, [tradeId]: json.data as ToolSchema }));
      setExpanded(tradeId);
    } finally { setLoadingSchema(null); }
  }

  const categories = [...new Set(catalog.map((e) => e.category))].sort();

  const filtered = catalog.filter((e) => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.description.toLowerCase().includes(search.toLowerCase());
    const matchCat    = !category || e.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AdminPageHeader
        title="ProTools Catalog"
        subtitle={`All ${catalog.length} estimation tools available in the SEMSE Algorithm Engine`}
        icon={Wrench}
        iconColor="#22d3ee"
        iconBg="rgba(34,211,238,.12)"
        showBack={false}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools…"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-9 pr-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCategory(null)}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              !category ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-white/[0.04] text-muted hover:text-ink border border-white/[0.06]"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(category === cat ? null : cat)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition capitalize border ${
                category === cat
                  ? "text-ink border-white/20"
                  : "text-muted hover:text-ink border-white/[0.06]"
              }`}
              style={category === cat ? { background: `${CATEGORY_COLORS[cat]}22`, borderColor: `${CATEGORY_COLORS[cat]}44`, color: CATEGORY_COLORS[cat] } : {}}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tool grid */}
      {!catalog.length ? (
        <div className="text-sm text-muted text-center py-12">Loading tools…</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tool) => {
            const color   = CATEGORY_COLORS[tool.category] ?? "#64748b";
            const schema  = schemas[tool.id];
            const isOpen  = expanded === tool.id;
            const loading = loadingSchema === tool.id;

            return (
              <div
                key={tool.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
              >
                <button
                  onClick={() => loadSchema(tool.id)}
                  className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-white/[0.03] transition"
                >
                  <div
                    className="w-2 h-8 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{tool.name}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium capitalize"
                        style={{ background: `${color}22`, color }}
                      >
                        {tool.category}
                      </span>
                    </div>
                    <div className="text-xs text-muted mt-0.5 truncate">{tool.description}</div>
                  </div>
                  <div className="flex items-center gap-2 text-muted text-xs flex-shrink-0">
                    <Code2 size={12} />
                    <span className="font-mono text-[10px]">{tool.id}</span>
                    {loading
                      ? <span className="text-cyan-400 animate-spin text-xs">⟳</span>
                      : isOpen
                        ? <ChevronUp size={14} />
                        : <ChevronDown size={14} />
                    }
                  </div>
                </button>

                {isOpen && schema && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/[0.04]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="text-muted uppercase tracking-wide font-semibold mb-2 flex items-center gap-1">
                          <Package size={10} /> Required fields
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {schema.requiredFields.map((f) => (
                            <span key={f} className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-mono">{f}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted uppercase tracking-wide font-semibold mb-2 flex items-center gap-1">
                          <Package size={10} /> Optional fields
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {schema.optionalFields.map((f) => (
                            <span key={f} className="px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20 font-mono">{f}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {schema.notes && (
                      <div className="mt-3 text-xs text-muted italic">{schema.notes}</div>
                    )}
                    <div className="mt-3 pt-2 border-t border-white/[0.04] text-xs text-slate-500">
                      Calculate via: <code className="text-slate-400">POST /api/semse/tools/calculate</code>
                      {" "}with <code className="text-slate-400">{`{ "tool": "${tool.id}", "input": { ... } }`}</code>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!filtered.length && (
            <div className="text-sm text-muted text-center py-8">No tools match your filter</div>
          )}
        </div>
      )}
    </div>
  );
}
