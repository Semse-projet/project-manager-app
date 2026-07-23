"use client";

import { useEffect, useState } from "react";
import { BarChart2, TrendingUp, AlertTriangle, CheckCircle, Activity, RefreshCw, RotateCw, X } from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { Badge, Card } from "@/components/ui";

type TradeStats = {
  trade:              string;
  _count:             { id: number };
  _avg:               { riskScore: number | null; confidenceScore: number | null };
};

type AlgorithmRunStats = {
  total:   number;
  byTrade: TradeStats[];
};

type RecentRun = {
  id:                string;
  trade:             string;
  toolName:          string;
  algorithmVersion:  string;
  riskScore:         number | null;
  confidenceScore:   number | null;
  priceBandMid:      string | null;
  canPublish:        boolean;
  createdAt:         string;
};

type ReplayResult = {
  original: {
    id: string;
    toolName: string;
    algorithmVersion: string;
    riskScore: number | null;
    confidenceScore: number | null;
    priceBandMid: string | null;
    createdAt: string;
  };
  replayed: {
    trade: string;
    risk: { score: number; level: string };
    costs?: { low: number; mid: number; high: number };
    isValid: boolean;
  };
};

const TRADE_COLORS: Record<string, string> = {
  painting:   "#06b6d4",
  siding:     "#8b5cf6",
  bathroom:   "#f59e0b",
  kitchen:    "#10b981",
  cleaning:   "#ec4899",
  drywall:    "#64748b",
  roofing:    "#ef4444",
  concrete:   "#6366f1",
  demolition: "#f97316",
};

function MetricCard({ label, value, sub, color = "text-cyan-400" }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}

function ReplayPanel({ result, onClose }: { result: ReplayResult; onClose: () => void }) {
  const riskDelta   = (result.replayed.risk.score ?? 0) - (result.original.riskScore ?? 0);
  const origPriceMid = result.original.priceBandMid ? Number(result.original.priceBandMid) : null;
  const newPriceMid  = result.replayed.costs?.mid ?? null;
  const priceDelta   = origPriceMid != null && newPriceMid != null ? newPriceMid - origPriceMid : null;

  return (
    <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
          <RotateCw size={14} /> Replay comparison — {result.original.toolName}
        </span>
        <button onClick={onClose} className="text-muted hover:text-ink transition">
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="text-muted uppercase tracking-wide mb-2 font-semibold">Original</div>
          <div className="space-y-1">
            <div className="flex justify-between"><span className="text-muted">Risk score</span><span className="text-ink font-bold">{result.original.riskScore ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted">Price mid</span><span className="text-ink">{origPriceMid != null ? `$${origPriceMid.toLocaleString()}` : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted">Version</span><span className="text-slate-400 font-mono text-[10px]">{result.original.algorithmVersion}</span></div>
          </div>
        </div>
        <div>
          <div className="text-muted uppercase tracking-wide mb-2 font-semibold">Replayed</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">Risk score</span>
              <span className={`font-bold ${riskDelta > 5 ? "text-red-400" : riskDelta < -5 ? "text-green-400" : "text-ink"}`}>
                {result.replayed.risk.score}
                {riskDelta !== 0 && <span className="ml-1 text-[10px] opacity-70">{riskDelta > 0 ? "+" : ""}{riskDelta}</span>}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Price mid</span>
              <span className={priceDelta != null && Math.abs(priceDelta) > 100 ? "text-yellow-400" : "text-ink"}>
                {newPriceMid != null ? `$${newPriceMid.toLocaleString()}` : "—"}
                {priceDelta != null && <span className="ml-1 text-[10px] opacity-70">{priceDelta > 0 ? "+" : ""}{priceDelta > 0 ? "" : ""}{Math.abs(priceDelta) > 0 ? `${priceDelta > 0 ? "+" : ""}$${Math.abs(Math.round(priceDelta)).toLocaleString()}` : ""}</span>}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Valid</span>
              <span>{result.replayed.isValid ? <CheckCircle size={12} className="text-green-400" /> : <AlertTriangle size={12} className="text-red-400" />}</span>
            </div>
          </div>
        </div>
      </div>
      {Math.abs(riskDelta) > 10 && (
        <div className="mt-3 text-xs text-yellow-400 flex items-center gap-1">
          <AlertTriangle size={11} />
          Risk score changed by {Math.abs(riskDelta)} points — consider reviewing algorithm inputs
        </div>
      )}
    </div>
  );
}

export default function AlgorithmEngineDashboard() {
  const [stats, setStats]               = useState<AlgorithmRunStats | null>(null);
  const [selectedTrade, setSelected]    = useState<string | null>(null);
  const [recentRuns, setRecentRuns]     = useState<RecentRun[]>([]);
  const [loading, setLoading]           = useState(true);
  const [replayingId, setReplayingId]   = useState<string | null>(null);
  const [replayResults, setReplayResults] = useState<Record<string, ReplayResult>>({});

  async function loadStats() {
    setLoading(true);
    try {
      const res  = await fetch("/api/semse/admin/algorithm-runs");
      const json = await res.json();
      setStats(json?.data ?? null);
    } finally { setLoading(false); }
  }

  async function loadTradeRuns(trade: string) {
    setSelected(trade);
    setReplayResults({});
    const res  = await fetch(`/api/semse/admin/algorithm-runs?trade=${encodeURIComponent(trade)}`);
    const json = await res.json();
    setRecentRuns(json?.data ?? []);
  }

  async function replayRun(id: string) {
    setReplayingId(id);
    try {
      const res  = await fetch(`/api/semse/ops/algorithm-engine/replay/${id}`, { method: "POST" });
      const json = await res.json();
      if (json?.data) {
        setReplayResults(prev => ({ ...prev, [id]: json.data as ReplayResult }));
      }
    } catch { /* swallow */ }
    finally { setReplayingId(null); }
  }

  useEffect(() => { void loadStats(); }, []);

  const avgRisk       = stats?.byTrade.length
    ? Math.round((stats.byTrade.reduce((s, t) => s + (t._avg.riskScore ?? 0), 0)) / stats.byTrade.length)
    : 0;
  const avgConfidence = stats?.byTrade.length
    ? Math.round((stats.byTrade.reduce((s, t) => s + (t._avg.confidenceScore ?? 0), 0)) / stats.byTrade.length)
    : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminPageHeader
        title="Algorithm Engine Dashboard"
        subtitle="Every ProTools calculation is recorded here for auditing and learning."
        icon={Activity}
        iconColor="#22d3ee"
        iconBg="rgba(34,211,238,0.12)"
        showBack={false}
        actions={
          <button
            onClick={loadStats}
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-sm text-muted hover:text-ink transition"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      {/* Summary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total runs" value={stats?.total ?? "—"} sub="all time" color="text-cyan-400" />
        <MetricCard label="Trades tracked" value={stats?.byTrade.length ?? "—"} sub="unique trade types" color="text-purple-400" />
        <MetricCard label="Avg risk score" value={avgRisk || "—"} sub="/100" color={avgRisk > 60 ? "text-red-400" : "text-green-400"} />
        <MetricCard label="Avg confidence" value={avgConfidence || "—"} sub="/100" color={avgConfidence > 60 ? "text-green-400" : "text-yellow-400"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Trade list */}
        <Card className="self-start">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">By trade</div>
          {!stats?.byTrade.length && (
            <div className="text-sm text-muted py-4 text-center">No runs recorded yet</div>
          )}
          <div className="space-y-1">
            {(stats?.byTrade ?? []).sort((a, b) => b._count.id - a._count.id).map(t => {
              const color = TRADE_COLORS[t.trade] ?? "#64748b";
              const isSelected = selectedTrade === t.trade;
              return (
                <button
                  key={t.trade}
                  onClick={() => loadTradeRuns(t.trade)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    isSelected ? "bg-white/[0.07] border border-white/[0.12]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink">{t.trade}</div>
                    <div className="text-xs text-muted">
                      avg risk: {Math.round(t._avg.riskScore ?? 0)} · conf: {Math.round(t._avg.confidenceScore ?? 0)}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-ink">{t._count.id}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Recent runs for selected trade */}
        <div>
          {!selectedTrade ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-muted text-sm">
              Select a trade to see recent runs
            </div>
          ) : (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={16} className="text-cyan-400" />
                <span className="text-sm font-semibold text-ink">Recent runs — {selectedTrade}</span>
                <span className="ml-auto text-xs text-muted flex items-center gap-1">
                  <RotateCw size={11} /> Click Replay to re-run with current algorithm
                </span>
              </div>
              {!recentRuns.length ? (
                <div className="text-sm text-muted py-4 text-center">No runs for this trade</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        {["Version", "Risk", "Confidence", "Price mid", "Can publish", "Time", ""].map((h, i) => (
                          <th key={i} className="text-left py-2 px-2 text-muted font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recentRuns.map(r => (
                        <>
                          <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                            <td className="py-2 px-2 text-slate-400 font-mono">{r.algorithmVersion.split("-v")[1] ?? r.algorithmVersion}</td>
                            <td className="py-2 px-2">
                              <span className={`font-bold ${(r.riskScore ?? 0) > 60 ? "text-red-400" : (r.riskScore ?? 0) > 30 ? "text-yellow-400" : "text-green-400"}`}>
                                {r.riskScore ?? "—"}
                              </span>
                            </td>
                            <td className="py-2 px-2">
                              <span className={`font-bold ${(r.confidenceScore ?? 0) > 60 ? "text-green-400" : "text-yellow-400"}`}>
                                {r.confidenceScore ?? "—"}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-slate-300">
                              {r.priceBandMid ? `$${Math.round(Number(r.priceBandMid)).toLocaleString()}` : "—"}
                            </td>
                            <td className="py-2 px-2">
                              {r.canPublish
                                ? <CheckCircle size={12} className="text-green-400" />
                                : <AlertTriangle size={12} className="text-yellow-400" />}
                            </td>
                            <td className="py-2 px-2 text-slate-500">
                              {new Date(r.createdAt).toLocaleTimeString()}
                            </td>
                            <td className="py-2 px-2">
                              {replayResults[r.id] ? (
                                <button
                                  onClick={() => setReplayResults(prev => { const n = { ...prev }; delete n[r.id]; return n; })}
                                  className="text-cyan-400 hover:text-cyan-300 transition text-[10px] font-medium"
                                >
                                  Hide
                                </button>
                              ) : (
                                <button
                                  onClick={() => replayRun(r.id)}
                                  disabled={replayingId === r.id}
                                  className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 transition disabled:opacity-50"
                                >
                                  <RotateCw size={11} className={replayingId === r.id ? "animate-spin" : ""} />
                                  <span className="text-[10px]">{replayingId === r.id ? "…" : "Replay"}</span>
                                </button>
                              )}
                            </td>
                          </tr>
                          {replayResults[r.id] && (
                            <tr key={`${r.id}-replay`}>
                              <td colSpan={7} className="px-2 pb-3">
                                <ReplayPanel
                                  result={replayResults[r.id]}
                                  onClose={() => setReplayResults(prev => { const n = { ...prev }; delete n[r.id]; return n; })}
                                />
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
