"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, Plus, Search, ShieldAlert } from "lucide-react";
import { AgroFarmNav } from "../AgroFarmNav";
import {
  agroFetch, fmtDateTime, INCIDENT_TYPE_LABEL, INCIDENT_TYPES, isForbidden, SEVERITIES, SEVERITY_BADGE,
  SEVERITY_LABEL, shortId, STATUS_BADGE, STATUS_LABEL,
} from "../agro-ops";

type Incident = {
  id: string; title: string; type: string; severity: string; severityConfirmed: boolean; status: string;
  detectedAt: string; assignedToId: string | null; reportedById: string; source: string;
  farmUnit: { name: string } | null; animal: { tagCode: string | null; species: string } | null;
  animalGroup: { name: string } | null; cropCycle: { cropName: string } | null; inventoryItem: { name: string } | null;
};

const STATUS_FILTERS: Array<{ key: string; label: string; statuses?: string }> = [
  { key: "active", label: "Activas", statuses: "OPEN,TRIAGED,IN_PROGRESS" },
  { key: "OPEN", label: "Abiertas", statuses: "OPEN" },
  { key: "IN_PROGRESS", label: "En curso", statuses: "IN_PROGRESS" },
  { key: "RESOLVED", label: "Resueltas", statuses: "RESOLVED" },
  { key: "CLOSED", label: "Cerradas", statuses: "CLOSED,CANCELLED,DUPLICATE" },
  { key: "all", label: "Todas" },
];

function relationLabel(i: Incident): string {
  return [
    i.animal ? `Animal ${i.animal.tagCode ?? ""}`.trim() : null,
    i.animalGroup?.name, i.farmUnit?.name, i.cropCycle?.cropName, i.inventoryItem?.name,
  ].filter(Boolean).join(" · ");
}

export default function IncidentCenterPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [statusKey, setStatusKey] = useState("active");
  const [severity, setSeverity] = useState("");
  const [type, setType] = useState("");
  const [mine, setMine] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    const statuses = STATUS_FILTERS.find((f) => f.key === statusKey)?.statuses;
    if (statuses) p.set("status", statuses);
    if (severity) p.set("severity", severity);
    if (type) p.set("type", type);
    if (mine) p.set("assignedToId", "me");
    if (debouncedQ) p.set("q", debouncedQ);
    return p.toString();
  }, [statusKey, severity, type, mine, debouncedQ]);

  useEffect(() => {
    if (!farmId) return;
    let cancelled = false;
    setLoading(true); setError(null);
    agroFetch<{ incidents: Incident[] }>(`/farms/${encodeURIComponent(farmId)}/incidents?${query}`)
      .then((d) => { if (!cancelled) { setIncidents(d.incidents); setForbidden(false); } })
      .catch((e) => { if (!cancelled) { if (isForbidden(e)) setForbidden(true); else setError(e.message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [farmId, query]);

  const filtersActive = Boolean(severity || type || mine || debouncedQ) || statusKey !== "active";

  return (
    <div className="agro-shell">
      <AgroFarmNav farmId={farmId} crumbs={[{ label: "Incidencias" }]} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Centro de incidencias</h1>
        <Link href={`/agro/${farmId}/incidents/report`} className="btn-accent">
          <Plus size={13} aria-hidden /> Reportar problema
        </Link>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }} role="group" aria-label="Filtrar por estado">
        {STATUS_FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setStatusKey(f.key)} aria-pressed={statusKey === f.key}
            style={{
              padding: "4px 12px", borderRadius: 999, border: "1px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: statusKey === f.key ? "var(--brand)" : "transparent",
              color: statusKey === f.key ? "#fff" : "var(--muted)",
              borderColor: statusKey === f.key ? "var(--brand)" : "var(--border)",
            }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 16 }}>
        <label style={{ position: "relative" }}>
          <span className="sr-only">Buscar</span>
          <Search size={13} aria-hidden style={{ position: "absolute", left: 10, top: 11, color: "var(--faint)" }} />
          <input className="fi" style={{ paddingLeft: 28 }} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label><span className="sr-only">Severidad</span>
          <select className="fi" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">Toda severidad</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
          </select>
        </label>
        <label><span className="sr-only">Tipo</span>
          <select className="fi" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Todo tipo</option>
            {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{INCIDENT_TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)" }}>
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Asignadas a mí
        </label>
      </div>

      {forbidden ? (
        <div className="empty-state">
          <ShieldAlert size={36} className="empty-icon" aria-hidden />
          <p className="empty-title">Sin acceso a esta finca</p>
          <p className="empty-desc">Pide al propietario o administrador que te agregue como miembro.</p>
        </div>
      ) : error ? (
        <div className="alert-banner alert-critical" role="alert">No se pudieron cargar las incidencias: {error}</div>
      ) : loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }} aria-busy="true">
          {[1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 76 }} />)}
        </div>
      ) : incidents.length === 0 ? (
        <div className="empty-state">
          <AlertTriangle size={36} className="empty-icon" aria-hidden />
          <p className="empty-title">{filtersActive ? "Ninguna incidencia coincide con los filtros" : "Sin incidencias activas"}</p>
          <p className="empty-desc">Reporta heridas, falta de agua o alimento, daños o riesgos desde el campo.</p>
          <Link href={`/agro/${farmId}/incidents/report`} className="btn-accent"><Plus size={13} aria-hidden /> Reportar problema</Link>
        </div>
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
          {incidents.map((i) => (
            <li key={i.id}>
              <Link href={`/agro/${farmId}/incidents/${i.id}`} style={{
                display: "block", borderRadius: 12, padding: "12px 14px", textDecoration: "none",
                border: `1px solid ${i.severity === "CRITICAL" ? "rgba(239,68,68,.35)" : "var(--border)"}`, background: "var(--surface)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 4, overflowWrap: "anywhere" }}>{i.title}</p>
                    <p style={{ fontSize: 11, color: "var(--muted)" }}>
                      {INCIDENT_TYPE_LABEL[i.type] ?? i.type}
                      {relationLabel(i) && ` · ${relationLabel(i)}`}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>
                      {fmtDateTime(i.detectedAt)} · Responsable: {i.assignedToId ? shortId(i.assignedToId) : "sin asignar"}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <span className={STATUS_BADGE[i.status] ?? "badge badge-slate"}>{STATUS_LABEL[i.status] ?? i.status}</span>
                    <span className={SEVERITY_BADGE[i.severity] ?? "badge badge-slate"} title={i.severityConfirmed ? "Severidad confirmada" : "Severidad sugerida, pendiente de revisión"}>
                      {SEVERITY_LABEL[i.severity] ?? i.severity}{i.severityConfirmed ? "" : " ?"}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
