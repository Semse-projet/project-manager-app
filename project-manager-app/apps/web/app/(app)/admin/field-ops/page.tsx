"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import Link from "next/link";
import {
  Wrench,
  ClipboardList,
  Brain,
  Truck,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  ChevronRight,
  User,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
} from "lucide-react";
import {
  fetchFieldFacts,
  fetchFieldUnits,
  fetchFieldVendors,
  fetchFieldWorklogs
} from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

type UnitStatus = "PENDING" | "IN_PROGRESS" | "COMPLETE" | "ON_HOLD" | "CANCELLED";
type FactVisibility = "TEAM" | "ORG" | "PUBLIC";
type ComplianceStatus = "MISSING" | "PENDING" | "APPROVED" | "EXPIRED";

interface FieldUnit {
  id: string;
  code: string;
  name: string | null;
  address: string | null;
  status: UnitStatus;
  projectId: string;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface WorklogEntry {
  id: string;
  date: string;
  fieldUnitId: string;
  unitCode: string;
  unitName: string | null;
  createdBy: string;
  doneToday: string;
  pendingNext: string;
  blockers: string | null;
  notes: string | null;
}

interface ContextMemoryEntry {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  visibility: FactVisibility;
  createdAt: string;
  createdBy: string;
  worklogId: string | null;
}

interface ComplianceDoc {
  id: string;
  type: string;
  status: ComplianceStatus;
  expiresAt: string | null;
  notes: string | null;
}

interface Vendor {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  compliance: ComplianceDoc[];
}

type RemoteState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

const UNIT_STATUS_META: Record<UnitStatus, { label: string; color: string; bg: string; Icon: typeof CheckCircle2 }> = {
  PENDING: { label: "Pendiente", color: "#6b7280", bg: "#f3f4f6", Icon: Clock },
  IN_PROGRESS: { label: "En progreso", color: "#10b981", bg: "#d1fae5", Icon: CheckCircle2 },
  COMPLETE: { label: "Completada", color: "#0ea5e9", bg: "#dbeafe", Icon: CheckCircle2 },
  ON_HOLD: { label: "En pausa", color: "#f59e0b", bg: "#fef3c7", Icon: AlertCircle },
  CANCELLED: { label: "Cancelada", color: "#ef4444", bg: "#fee2e2", Icon: AlertCircle }
};

const VISIBILITY_COLOR: Record<FactVisibility, string> = {
  TEAM: "#10b981",
  ORG: "#3b82f6",
  PUBLIC: "#8b5cf6"
};

const COMPLIANCE_META: Record<ComplianceStatus, { label: string; color: string; Icon: typeof ShieldCheck }> = {
  APPROVED: { label: "Aprobado", color: "#10b981", Icon: ShieldCheck },
  PENDING: { label: "Pendiente", color: "#f59e0b", Icon: ShieldAlert },
  EXPIRED: { label: "Expirado", color: "#ef4444", Icon: ShieldX },
  MISSING: { label: "Faltante", color: "#6b7280", Icon: ShieldAlert }
};

function confidenceBar(confidence: number) {
  const pct = Math.max(0, Math.min(100, Math.round(confidence * 100)));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 72, height: 6, borderRadius: 20, background: "var(--border)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 20, background: pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>{pct}%</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: "18px 20px", borderRadius: 12, border: "1px dashed var(--border)", color: "var(--muted)", background: "var(--surface)", fontSize: 13 }}>
      {text}
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {[1, 2, 3].map((item) => (
        <div key={item} style={{ height: 72, borderRadius: 12, background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />
      ))}
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div style={{ padding: "18px 20px", borderRadius: 12, border: "1px solid rgba(239,68,68,.18)", color: "#ef4444", background: "rgba(239,68,68,.08)", fontSize: 13 }}>
      {error}
    </div>
  );
}

function UnitsTab({
  state
}: {
  state: RemoteState<FieldUnit[]>;
}) {
  const [filterStatus, setFilterStatus] = useState<UnitStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      state.data.filter((unit) => {
        const matchSearch =
          unit.code.toLowerCase().includes(search.toLowerCase()) ||
          (unit.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (unit.address ?? "").toLowerCase().includes(search.toLowerCase());
        const matchStatus = filterStatus === "ALL" || unit.status === filterStatus;
        return matchSearch && matchStatus;
      }),
    [filterStatus, search, state.data]
  );

  const selected = filtered.find((unit) => unit.id === selectedId) ?? state.data.find((unit) => unit.id === selectedId) ?? null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 18 }}>
      <div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar unidad..."
              style={{ width: "100%", padding: "8px 12px 8px 32px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--ink)", fontSize: 13 }}
            />
          </div>
          {(["ALL", "PENDING", "IN_PROGRESS", "COMPLETE", "ON_HOLD", "CANCELLED"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                cursor: "pointer",
                border: "1px solid var(--border)",
                background: filterStatus === status ? "var(--brand)" : "var(--surface)",
                color: filterStatus === status ? "#fff" : "var(--ink)"
              }}
            >
              {status === "ALL" ? "Todas" : UNIT_STATUS_META[status].label}
            </button>
          ))}
          <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, background: "var(--brand)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13 }}>
            <Plus size={14} /> Nueva unidad
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
          {(["PENDING", "IN_PROGRESS", "COMPLETE", "ON_HOLD"] as UnitStatus[]).map((status) => {
            const meta = UNIT_STATUS_META[status];
            const count = state.data.filter((unit) => unit.status === status).length;
            return (
              <div key={status} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{meta.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: meta.color }}>{count}</div>
              </div>
            );
          })}
        </div>

        {state.loading ? (
          <LoadingState />
        ) : state.error ? (
          <ErrorState error={state.error} />
        ) : filtered.length === 0 ? (
          <EmptyState text="No hay unidades que coincidan con el filtro actual." />
        ) : (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--faint)" }}>
                  {["Código", "Nombre", "Dirección", "Estado", "Proyecto", "Última actividad", ""].map((header) => (
                    <th key={header} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((unit) => {
                  const meta = UNIT_STATUS_META[unit.status];
                  const lastActivity = new Date(unit.updatedAt).toLocaleDateString("es-MX");
                  return (
                    <tr
                      key={unit.id}
                      onClick={() => setSelectedId((current) => (current === unit.id ? null : unit.id))}
                      style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", background: selectedId === unit.id ? "var(--faint)" : "transparent" }}
                    >
                      <td style={{ padding: "12px 14px", fontWeight: 600, fontSize: 13, color: "var(--brand)" }}>{unit.code}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13 }}>{unit.name ?? "—"}</td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted)", maxWidth: 180 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <MapPin size={11} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{unit.address ?? "—"}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: meta.bg, color: meta.color, fontSize: 12, fontWeight: 600 }}>
                          <meta.Icon size={11} /> {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted)" }}>{unit.projectId}</td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted)" }}>{lastActivity}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <ChevronRight size={14} style={{ color: "var(--muted)", transform: selectedId === unit.id ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, alignSelf: "start" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>Unidad</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.code}</div>
              {selected.name ? <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{selected.name}</div> : null}
            </div>
            {(() => {
              const meta = UNIT_STATUS_META[selected.status];
              return (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, background: meta.bg, color: meta.color, fontSize: 12, fontWeight: 600 }}>
                  <meta.Icon size={12} /> {meta.label}
                </span>
              );
            })()}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <MapPin size={14} style={{ color: "var(--muted)", marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Dirección</div>
                <div style={{ fontSize: 13 }}>{selected.address ?? "—"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <User size={14} style={{ color: "var(--muted)", marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Proyecto</div>
                <div style={{ fontSize: 13 }}>{selected.projectId}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Calendar size={14} style={{ color: "var(--muted)", marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Actualizado</div>
                <div style={{ fontSize: 13 }}>{new Date(selected.updatedAt).toLocaleDateString("es-MX")}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorklogsTab({ state }: { state: RemoteState<WorklogEntry[]> }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      state.data.filter((entry) =>
        entry.unitCode.toLowerCase().includes(search.toLowerCase()) ||
        entry.doneToday.toLowerCase().includes(search.toLowerCase()) ||
        entry.createdBy.toLowerCase().includes(search.toLowerCase())
      ),
    [search, state.data]
  );

  if (state.loading) return <LoadingState />;
  if (state.error) return <ErrorState error={state.error} />;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar en registros..."
            style={{ width: "100%", padding: "8px 12px 8px 32px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--ink)", fontSize: 13 }}
          />
        </div>
        <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, background: "var(--brand)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13 }}>
          <Plus size={14} /> Nuevo registro
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState text="No hay worklogs para mostrar." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((entry) => (
            <div key={entry.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>
                    {entry.createdBy.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{entry.createdBy}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{entry.unitCode} · {entry.unitName ?? "Sin nombre"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--muted)", fontSize: 12 }}>
                  <Calendar size={12} />
                  {new Date(entry.date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "var(--faint)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#10b981", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Hoy se hizo</div>
                  <div style={{ fontSize: 13, color: "var(--ink)" }}>{entry.doneToday}</div>
                </div>
                <div style={{ background: "var(--faint)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Próximo paso</div>
                  <div style={{ fontSize: 13, color: "var(--ink)" }}>{entry.pendingNext}</div>
                </div>
              </div>

              {entry.blockers ? (
                <div style={{ marginTop: 10, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>Bloqueadores</div>
                  <div style={{ fontSize: 13, color: "#b91c1c" }}>{entry.blockers}</div>
                </div>
              ) : null}

              {entry.notes ? (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                  {entry.notes}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KnowledgeTab({ state }: { state: RemoteState<ContextMemoryEntry[]> }) {
  const [search, setSearch] = useState("");
  const [filterVis, setFilterVis] = useState<FactVisibility | "ALL">("ALL");

  const filtered = useMemo(
    () =>
      state.data.filter((fact) => {
        const matchSearch =
          fact.subject.toLowerCase().includes(search.toLowerCase()) ||
          fact.predicate.toLowerCase().includes(search.toLowerCase()) ||
          fact.object.toLowerCase().includes(search.toLowerCase());
        const matchVis = filterVis === "ALL" || fact.visibility === filterVis;
        return matchSearch && matchVis;
      }),
    [filterVis, search, state.data]
  );

  if (state.loading) return <LoadingState />;
  if (state.error) return <ErrorState error={state.error} />;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar memoria contextual..."
            style={{ width: "100%", padding: "8px 12px 8px 32px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--ink)", fontSize: 13 }}
          />
        </div>
        {(["ALL", "TEAM", "ORG", "PUBLIC"] as const).map((visibility) => (
          <button
            key={visibility}
            onClick={() => setFilterVis(visibility)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              cursor: "pointer",
              border: "1px solid var(--border)",
              background: filterVis === visibility ? "var(--brand)" : "var(--surface)",
              color: filterVis === visibility ? "#fff" : "var(--ink)"
            }}
          >
            {visibility === "ALL" ? "Todos" : visibility}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        {(["TEAM", "ORG", "PUBLIC"] as FactVisibility[]).map((visibility) => {
          const count = state.data.filter((fact) => fact.visibility === visibility).length;
          return (
            <div key={visibility} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{visibility}</div>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: VISIBILITY_COLOR[visibility] }} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{count}</div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState text="No hay hechos para el filtro actual." />
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--faint)" }}>
                {["Sujeto", "Predicado", "Objeto", "Confianza", "Visibilidad", "Fuente", "Fecha"].map((header) => (
                  <th key={header} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((fact) => (
                <tr key={fact.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "11px 14px", fontWeight: 600, fontSize: 13, color: "var(--brand)" }}>{fact.subject}</td>
                  <td style={{ padding: "11px 14px" }}>
                    <code style={{ fontSize: 12, background: "var(--faint)", padding: "2px 7px", borderRadius: 4, color: "#8b5cf6" }}>{fact.predicate}</code>
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 13, maxWidth: 240 }}>{fact.object}</td>
                  <td style={{ padding: "11px 14px", minWidth: 120 }}>{confidenceBar(fact.confidence)}</td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: VISIBILITY_COLOR[fact.visibility], background: "var(--faint)", padding: "2px 8px", borderRadius: 20 }}>
                      {fact.visibility}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--muted)" }}>
                    {fact.worklogId ? "Worklog" : "Manual"} · {fact.createdBy}
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--muted)" }}>{new Date(fact.createdAt).toLocaleDateString("es-MX")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VendorsTab({ state }: { state: RemoteState<Vendor[]> }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      state.data.filter((vendor) =>
        vendor.name.toLowerCase().includes(search.toLowerCase()) ||
        (vendor.email ?? "").toLowerCase().includes(search.toLowerCase())
      ),
    [search, state.data]
  );

  const selected = filtered.find((vendor) => vendor.id === selectedId) ?? state.data.find((vendor) => vendor.id === selectedId) ?? null;

  function complianceScore(vendor: Vendor) {
    const total = vendor.compliance.length;
    if (total === 0) return { pct: 0, color: "#6b7280" };
    const approved = vendor.compliance.filter((doc) => doc.status === "APPROVED").length;
    const pct = Math.round((approved / total) * 100);
    return { pct, color: pct === 100 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444" };
  }

  if (state.loading) return <LoadingState />;
  if (state.error) return <ErrorState error={state.error} />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 18 }}>
      <div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar proveedor..."
              style={{ width: "100%", padding: "8px 12px 8px 32px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--ink)", fontSize: 13 }}
            />
          </div>
          <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, background: "var(--brand)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13 }}>
            <Plus size={14} /> Nuevo proveedor
          </button>
        </div>

        {filtered.length === 0 ? (
          <EmptyState text="No hay proveedores registrados." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((vendor) => {
              const score = complianceScore(vendor);
              const hasIssues = vendor.compliance.some((doc) => doc.status !== "APPROVED");
              return (
                <div
                  key={vendor.id}
                  onClick={() => setSelectedId((current) => (current === vendor.id ? null : vendor.id))}
                  style={{ background: "var(--surface)", border: `1px solid ${selectedId === vendor.id ? "var(--brand)" : "var(--border)"}`, borderRadius: 12, padding: "16px 20px", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ width: 42, height: 42, borderRadius: 10, background: "var(--faint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Truck size={20} style={{ color: "var(--muted)" }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{vendor.name}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                          {vendor.phone ?? ""}{vendor.phone && vendor.email ? " · " : ""}{vendor.email ?? ""}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {hasIssues ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, background: "#fef2f2", color: "#ef4444", fontSize: 11, fontWeight: 600 }}>
                          <ShieldAlert size={11} /> Revisar
                        </span>
                      ) : null}
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>Cumplimiento</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: score.color }}>{score.pct}%</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                    {vendor.compliance.map((doc) => {
                      const meta = COMPLIANCE_META[doc.status];
                      return (
                        <span key={doc.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, border: "1px solid var(--border)", fontSize: 11, fontWeight: 600, color: meta.color }}>
                          <meta.Icon size={10} /> {doc.type}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, alignSelf: "start" }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{selected.name}</div>
          {selected.email ? <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 2 }}>✉️ {selected.email}</div> : null}
          {selected.phone ? <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 2 }}>📞 {selected.phone}</div> : null}
          {selected.notes ? <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, padding: "8px 12px", background: "var(--faint)", borderRadius: 8 }}>{selected.notes}</div> : null}

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Documentos de cumplimiento</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {selected.compliance.map((doc) => {
                const meta = COMPLIANCE_META[doc.status];
                return (
                  <div key={doc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 12px", background: "var(--faint)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{doc.type}</div>
                      {doc.expiresAt ? <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Vence: {new Date(doc.expiresAt).toLocaleDateString("es-MX")}</div> : null}
                      {doc.notes ? <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{doc.notes}</div> : null}
                    </div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, color: meta.color, background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <meta.Icon size={11} /> {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const TAB_CONFIG = [
  { id: "units", label: "Unidades de Campo", Icon: Wrench },
  { id: "worklogs", label: "Registros Diarios", Icon: ClipboardList },
  { id: "knowledge", label: "Memoria Contextual", Icon: Brain },
  { id: "vendors", label: "Proveedores", Icon: Truck }
] as const;

type TabId = (typeof TAB_CONFIG)[number]["id"];

export default function FieldOpsPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>("units");
  const [unitsState, setUnitsState] = useState<RemoteState<FieldUnit[]>>({ data: [], loading: true, error: null });
  const [worklogsState, setWorklogsState] = useState<RemoteState<WorklogEntry[]>>({ data: [], loading: true, error: null });
  const [factsState, setFactsState] = useState<RemoteState<ContextMemoryEntry[]>>({ data: [], loading: true, error: null });
  const [vendorsState, setVendorsState] = useState<RemoteState<Vendor[]>>({ data: [], loading: true, error: null });

  useEffect(() => {
    void (async () => {
      try {
        const rows = await fetchFieldUnits();
        setUnitsState({
          data: rows.map((row) => {
            const unit = row as Record<string, unknown>;
            return {
              id: String(unit.id),
              code: String(unit.code),
              name: typeof unit.name === "string" ? unit.name : null,
              address: typeof unit.address === "string" ? unit.address : null,
              status: String(unit.status) as UnitStatus,
              projectId: String(unit.projectId),
              metadataJson: (unit.metadataJson as Record<string, unknown> | null | undefined) ?? null,
              createdAt: String(unit.createdAt),
              updatedAt: String(unit.updatedAt)
            };
          }),
          loading: false,
          error: null
        });
      } catch (caught) {
        setUnitsState({ data: [], loading: false, error: caught instanceof Error ? caught.message : "No se pudieron cargar las unidades." });
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await fetchFieldWorklogs();
        setWorklogsState({
          data: rows.map((row) => {
            const entry = row as Record<string, unknown>;
            const fieldUnit = (entry.fieldUnit as Record<string, unknown> | undefined) ?? {};
            return {
              id: String(entry.id),
              date: String(entry.date),
              fieldUnitId: String(entry.fieldUnitId),
              unitCode: typeof fieldUnit.code === "string" ? fieldUnit.code : String(entry.fieldUnitId),
              unitName: typeof fieldUnit.name === "string" ? fieldUnit.name : null,
              createdBy: String(entry.createdBy ?? "Sistema"),
              doneToday: String(entry.doneToday ?? ""),
              pendingNext: String(entry.pendingNext ?? ""),
              blockers: typeof entry.blockers === "string" ? entry.blockers : null,
              notes: typeof entry.notes === "string" ? entry.notes : null
            };
          }),
          loading: false,
          error: null
        });
      } catch (caught) {
        setWorklogsState({ data: [], loading: false, error: caught instanceof Error ? caught.message : "No se pudieron cargar los worklogs." });
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await fetchFieldFacts();
        setFactsState({
          data: rows.map((row) => {
            const fact = row as Record<string, unknown>;
            return {
              id: String(fact.id),
              subject: String(fact.subject),
              predicate: String(fact.predicate),
              object: String(fact.object),
              confidence: typeof fact.confidence === "number" ? fact.confidence : Number(fact.confidence ?? 0),
              visibility: String(fact.visibility) as FactVisibility,
              createdAt: String(fact.createdAt),
              createdBy: String(fact.createdBy ?? "Sistema"),
              worklogId: typeof fact.worklogId === "string" ? fact.worklogId : null
            };
          }),
          loading: false,
          error: null
        });
      } catch (caught) {
        setFactsState({ data: [], loading: false, error: caught instanceof Error ? caught.message : "No se pudieron cargar los facts." });
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await fetchFieldVendors();
        setVendorsState({
          data: rows.map((row) => {
            const vendor = row as Record<string, unknown>;
            const compliance = Array.isArray(vendor.compliance) ? vendor.compliance : [];
            return {
              id: String(vendor.id),
              name: String(vendor.name),
              phone: typeof vendor.phone === "string" ? vendor.phone : null,
              email: typeof vendor.email === "string" ? vendor.email : null,
              notes: typeof vendor.notes === "string" ? vendor.notes : null,
              compliance: compliance.map((doc) => {
                const complianceDoc = doc as Record<string, unknown>;
                return {
                  id: String(complianceDoc.id),
                  type: String(complianceDoc.type),
                  status: String(complianceDoc.status) as ComplianceStatus,
                  expiresAt: typeof complianceDoc.expiresAt === "string" ? complianceDoc.expiresAt : null,
                  notes: typeof complianceDoc.notes === "string" ? complianceDoc.notes : null
                };
              })
            };
          }),
          loading: false,
          error: null
        });
      } catch (caught) {
        setVendorsState({ data: [], loading: false, error: caught instanceof Error ? caught.message : "No se pudieron cargar los proveedores." });
      }
    })();
  }, []);

  const tabCounts: Record<TabId, number> = {
    units: unitsState.data.length,
    worklogs: worklogsState.data.length,
    knowledge: factsState.data.length,
    vendors: vendorsState.data.length
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1300, margin: "0 auto" }}>
      <Link href="/admin/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none", marginBottom: "16px" }}>
        <span style={{ fontSize: "14px" }}>←</span> Dashboard
      </Link>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Wrench size={20} style={{ color: "#10b981" }} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t("page.fieldOps")}</h1>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Unidades, registros de campo, conocimiento y proveedores</div>
            </div>
          </div>
          <NotificationBanner audience="admin" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        {TAB_CONFIG.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "10px 18px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontWeight: activeTab === id ? 700 : 500,
              fontSize: 14,
              color: activeTab === id ? "var(--brand)" : "var(--muted)",
              borderBottom: activeTab === id ? "2px solid var(--brand)" : "2px solid transparent",
              marginBottom: -1
            }}
          >
            <Icon size={15} />
            {label}
            <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: activeTab === id ? "var(--brand)" : "var(--faint)", color: activeTab === id ? "#fff" : "var(--muted)" }}>
              {tabCounts[id]}
            </span>
          </button>
        ))}
      </div>

      {activeTab === "units" ? <UnitsTab state={unitsState} /> : null}
      {activeTab === "worklogs" ? <WorklogsTab state={worklogsState} /> : null}
      {activeTab === "knowledge" ? <KnowledgeTab state={factsState} /> : null}
      {activeTab === "vendors" ? <VendorsTab state={vendorsState} /> : null}
    </div>
  );
}
