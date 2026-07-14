"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle, Building2, CheckCircle2, Phone, Plus, RefreshCw,
  Search, Star, TrendingUp, Users, XCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type LeadStatus = "new" | "contacted" | "estimate_sent" | "won" | "lost" | "archived";

type Lead = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  trade?: string;
  source?: string;
  status: LeadStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type LeadStats = {
  new: number; contacted: number; estimate_sent: number;
  won: number; lost: number; total: number; conversionRate: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<LeadStatus, string> = {
  new:           "Nuevo",
  contacted:     "Contactado",
  estimate_sent: "Estimado enviado",
  won:           "Ganado",
  lost:          "Perdido",
  archived:      "Archivado",
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  new:           "#818cf8",
  contacted:     "#67e8f9",
  estimate_sent: "#fcd34d",
  won:           "#86efac",
  lost:          "#fca5a5",
  archived:      "#475569",
};

const TRADE_LABELS: Record<string, string> = {
  electrical: "Electricidad", plumbing: "Plomería", drywall: "Drywall",
  painting: "Pintura", hvac: "HVAC", roofing: "Techos", general: "General",
};

function StatusBadge({ status }: { status: LeadStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <span style={{ fontSize: 10, fontWeight: 800, color, background: `${color}20`, padding: "2px 8px", borderRadius: 99 }}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: typeof Users; color: string }) {
  return (
    <div style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContractorsPage() {
  const [leads,    setLeads]    = useState<Lead[]>([]);
  const [stats,    setStats]    = useState<LeadStats | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<LeadStatus | "">("");
  const [showForm, setShowForm] = useState(false);
  const [newLead,  setNewLead]  = useState({ name: "", phone: "", email: "", trade: "general", source: "direct" });

  // Deep-link target (e.g. from Communications: /admin/contractors?leadId=…)
  const [focusLeadId, setFocusLeadId] = useState<string | null>(null);
  const focusRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setFocusLeadId(new URLSearchParams(window.location.search).get("leadId"));
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams();
      if (filter) qs.set("status", filter);
      if (search) qs.set("search", search);

      const [leadsRes, statsRes] = await Promise.all([
        fetch(`/api/semse/contractor/leads?${qs}`).then((r) => r.json()) as Promise<{ data: Lead[] }>,
        fetch("/api/semse/contractor/stats").then((r) => r.json()) as Promise<{ data: LeadStats }>,
      ]);

      setLeads(leadsRes.data ?? []);
      setStats(statsRes.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar leads");
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => { void loadLeads(); }, [loadLeads]);

  // Scroll the deep-linked lead into view once it renders.
  useEffect(() => {
    if (focusLeadId && focusRowRef.current) {
      focusRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusLeadId, leads]);

  const handleCreate = async () => {
    if (!newLead.name.trim()) return;
    try {
      await fetch("/api/semse/contractor/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(newLead),
      });
      setNewLead({ name: "", phone: "", email: "", trade: "general", source: "direct" });
      setShowForm(false);
      void loadLeads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear lead");
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center" }}>
          <Building2 size={20} color="#818cf8" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Contractors / CRM</h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>Gestión de leads y contratistas</p>
        </div>
        <button onClick={() => setShowForm((p) => !p)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: "rgba(99,102,241,.15)", border: "none", cursor: "pointer", fontSize: 12, color: "#818cf8", fontWeight: 700 }}>
          <Plus size={13} /> Nuevo lead
        </button>
        <button onClick={loadLeads} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 12, color: "var(--muted)" }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
          <StatCard label="Total"         value={String(stats.total)}          icon={Users}      color="#818cf8" />
          <StatCard label="Nuevos"         value={String(stats.new)}            icon={AlertCircle} color="#67e8f9" />
          <StatCard label="En proceso"     value={String(stats.contacted + stats.estimate_sent)} icon={TrendingUp} color="#fcd34d" />
          <StatCard label="Ganados"        value={String(stats.won)}            icon={CheckCircle2} color="#86efac" />
          <StatCard label="Conversión"     value={`${stats.conversionRate}%`}  sub={`${stats.lost} perdidos`} icon={Star} color="#fb923c" />
        </div>
      )}

      {/* New lead form */}
      {showForm && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800 }}>Nuevo Lead</h3>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            {[
              { label: "Nombre*", key: "name",   placeholder: "Juan Pérez" },
              { label: "Teléfono", key: "phone", placeholder: "+1 555 000" },
              { label: "Email",    key: "email", placeholder: "juan@email.com" },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>{label}</label>
                <input
                  value={(newLead as Record<string, string>)[key]}
                  onChange={(e) => setNewLead((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12, boxSizing: "border-box" }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 12, alignItems: "end" }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>Trade</label>
              <select value={newLead.trade} onChange={(e) => setNewLead((p) => ({ ...p, trade: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 12 }}>
                {Object.entries(TRADE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>Fuente</label>
              <select value={newLead.source} onChange={(e) => setNewLead((p) => ({ ...p, source: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 12 }}>
                {["direct", "referral", "web", "social", "other"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={handleCreate}
              style={{ padding: "8px 16px", borderRadius: 8, background: "#818cf8", border: "none", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              Crear
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,.05)", border: "1px solid var(--border)", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>
              <XCircle size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar leads…"
            style={{ width: "100%", padding: "8px 10px 8px 30px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12, boxSizing: "border-box" }} />
        </div>
        {(["", "new", "contacted", "estimate_sent", "won", "lost"] as Array<LeadStatus | "">).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: "7px 12px", borderRadius: 99, border: `1px solid ${filter === s ? "#818cf8" : "var(--border)"}`, background: filter === s ? "rgba(99,102,241,.15)" : "rgba(255,255,255,.03)", color: filter === s ? "#818cf8" : "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            {s === "" ? "Todos" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.1)", borderRadius: 10, fontSize: 12, color: "#fca5a5", marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Leads table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 800, color: "var(--muted)" }}>
          <span>NOMBRE</span><span>TRADE</span><span>CONTACTO</span><span>STATUS</span><span>CREADO</span>
        </div>

        {leads.length === 0 && !loading && (
          <div style={{ padding: "32px", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
            {search || filter ? "Sin leads que coincidan" : "No hay leads registrados todavía"}
          </div>
        )}

        {leads.map((lead) => {
          const isFocused = lead.id === focusLeadId;
          return (
          <div key={lead.id}
            ref={isFocused ? focusRowRef : undefined}
            style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border)", alignItems: "center", background: isFocused ? "rgba(99,102,241,.12)" : undefined, boxShadow: isFocused ? "inset 3px 0 0 #818cf8" : undefined }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{lead.name}</div>
              {lead.email && <div style={{ fontSize: 10, color: "var(--muted)" }}>{lead.email}</div>}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              {TRADE_LABELS[lead.trade ?? "general"] ?? lead.trade ?? "—"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
              {lead.phone && <><Phone size={10} /> {lead.phone}</>}
            </div>
            <div><StatusBadge status={lead.status} /></div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              {new Date(lead.createdAt).toLocaleDateString("es-MX")}
            </div>
          </div>
          );
        })}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
