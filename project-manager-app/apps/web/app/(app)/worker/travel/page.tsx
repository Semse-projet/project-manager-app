"use client";

import Link from "next/link";
import { useLanguage } from "../../../../lib/language-context";
import { useCallback, useEffect, useState } from "react";
import { MapPin, Calendar, DollarSign, Plus, RefreshCw, Inbox, PlaneTakeoff, ChevronRight } from "lucide-react";
import { HtmlInCanvasPanel, StatCard, StatusBadge } from "@semse/ui";
import { fetchTravelAssignments, createTravelAssignment, fetchJobs, fetchTravelExpenses, fetchTravelLodging, fetchTravelSettlement } from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

type TravelStatus = "DRAFT" | "PLANNED" | "ACTIVE" | "PENDING_SETTLEMENT" | "CLOSED" | "CANCELLED";

interface TravelRow {
  id: string;
  jobId: string;
  jobTitle: string;
  destinationCity: string;
  departureDate: string;
  returnDate: string | null;
  estimatedDays: number | null;
  approvedBudget: number | null;
  totalSpent: number | null;
  missingReceipts: number;
  missingExpenseReceipts: number;
  missingLodgingReceipts: number;
  receiptCount: number;
  expenseCount: number;
  lodgingCount: number;
  advanceCount: number;
  expectedBalance: number | null;
  readyToClose: boolean;
  blockedReason: string | null;
  status: TravelStatus;
  requiresLodging: boolean;
}

const STATUS_VARIANT: Record<TravelStatus, "success" | "warning" | "info" | "neutral" | "error"> = {
  DRAFT:               "neutral",
  PLANNED:             "info",
  ACTIVE:              "success",
  PENDING_SETTLEMENT:  "warning",
  CLOSED:              "neutral",
  CANCELLED:           "error",
};
const STATUS_LABEL: Record<TravelStatus, string> = {
  DRAFT:               "Borrador",
  PLANNED:             "Planificado",
  ACTIVE:              "Activo",
  PENDING_SETTLEMENT:  "Por liquidar",
  CLOSED:              "Cerrado",
  CANCELLED:           "Cancelado",
};
const TRANSPORT_LABEL: Record<string, string> = {
  flight: "Vuelo", bus: "Bus", car: "Auto", rental: "Renta", other: "Otro",
};

function rawToRow(
  r: Record<string, unknown>,
  jobTitleMap: Record<string, string>,
  extras?: {
    totalSpent?: number | null;
    missingReceipts?: number;
    missingExpenseReceipts?: number;
    missingLodgingReceipts?: number;
    receiptCount?: number;
    expenseCount?: number;
    lodgingCount?: number;
    advanceCount?: number;
    expectedBalance?: number | null;
  }
): TravelRow {
  const jobId = String(r.jobId ?? "");
  const status = String(r.status ?? "DRAFT") as TravelStatus;
  return {
    id:             String(r.id ?? ""),
    jobId,
    jobTitle:       jobTitleMap[jobId] ?? jobId,
    destinationCity: String(r.destinationCity ?? ""),
    departureDate:  typeof r.departureDate === "string" ? r.departureDate.slice(0, 10) : "",
    returnDate:     typeof r.returnDate === "string" ? r.returnDate.slice(0, 10) : null,
    estimatedDays:  typeof r.estimatedDays === "number" ? r.estimatedDays : null,
    approvedBudget: typeof r.approvedBudget === "number" ? r.approvedBudget : null,
    totalSpent: extras?.totalSpent ?? null,
    missingReceipts: extras?.missingReceipts ?? 0,
    missingExpenseReceipts: extras?.missingExpenseReceipts ?? 0,
    missingLodgingReceipts: extras?.missingLodgingReceipts ?? 0,
    receiptCount: extras?.receiptCount ?? 0,
    expenseCount: extras?.expenseCount ?? 0,
    lodgingCount: extras?.lodgingCount ?? 0,
    advanceCount: extras?.advanceCount ?? 0,
    expectedBalance: extras?.expectedBalance ?? null,
    readyToClose: (extras?.missingReceipts ?? 0) === 0 && status === "PENDING_SETTLEMENT",
    blockedReason:
      status === "ACTIVE" && (extras?.expenseCount ?? 0) === 0 && (extras?.lodgingCount ?? 0) === 0 && (extras?.advanceCount ?? 0) === 0
        ? "sin base operativa"
        : Boolean(r.requiresLodging) && status === "ACTIVE" && (extras?.lodgingCount ?? 0) === 0
          ? "sin hospedaje requerido"
          : null,
    status:         (["DRAFT","PLANNED","ACTIVE","PENDING_SETTLEMENT","CLOSED","CANCELLED"].includes(status) ? status : "DRAFT") as TravelStatus,
    requiresLodging: Boolean(r.requiresLodging),
  };
}

export default function WorkerTravelPage() {
  const { t } = useLanguage();
  const [travels, setTravels]     = useState<TravelRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<"all" | "active" | "pending" | "closed">("all");
  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
  const [formJobId, setFormJobId]       = useState("");
  const [formCity, setFormCity]         = useState("");
  const [formDepart, setFormDepart]     = useState("");
  const [formReturn, setFormReturn]     = useState("");
  const [formDays, setFormDays]         = useState("");
  const [formBudget, setFormBudget]     = useState("");
  const [formTransport, setFormTransport] = useState("flight");
  const [formRequiresLodging, setFormRequiresLodging] = useState(true);
  const [formHeadcount, setFormHeadcount] = useState("1");
  const [formNotes, setFormNotes]       = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rawTravels, rawJobs] = await Promise.all([
        fetchTravelAssignments().catch(() => [] as Record<string, unknown>[]),
        fetchJobs().catch(() => []),
      ]);
      const jobTitleMap: Record<string, string> = {};
      for (const j of rawJobs) jobTitleMap[j.id] = j.title;
      const extras = await Promise.all(
        rawTravels.map(async (travel) => {
          const travelId = String(travel.id ?? "");
          const [settlement, expenses, lodging] = await Promise.all([
            fetchTravelSettlement(travelId).catch(() => null),
            fetchTravelExpenses(travelId).catch(() => [] as Record<string, unknown>[]),
            fetchTravelLodging(travelId).catch(() => [] as Record<string, unknown>[]),
          ]);
          const totalSpent = settlement ? Number((settlement as Record<string, unknown>).totalSpent ?? 0) : null;
          const expectedBalance = settlement ? Number((settlement as Record<string, unknown>).balanceDue ?? 0) : null;
          const missingExpenseReceipts = expenses.filter((expense) => !String(expense.receiptUrl ?? "").trim()).length;
          const missingLodgingReceipts = lodging.filter((record) => !String(record.receiptUrl ?? "").trim()).length;
          const receiptCount =
            expenses.filter((expense) => String(expense.receiptUrl ?? "").trim()).length +
            lodging.filter((record) => String(record.receiptUrl ?? "").trim()).length;
          const missingReceipts = missingExpenseReceipts + missingLodgingReceipts;
          return {
            totalSpent,
            expectedBalance,
            missingReceipts,
            missingExpenseReceipts,
            missingLodgingReceipts,
            receiptCount,
            expenseCount: expenses.length,
            lodgingCount: lodging.length,
            advanceCount: settlement ? Number((settlement as Record<string, unknown>).totalAdvances ?? 0) > 0 ? 1 : 0 : 0,
          };
        })
      );
      setJobs(rawJobs.map(j => ({ id: j.id, title: j.title })));
      if (!formJobId && rawJobs.length > 0) setFormJobId(rawJobs[0].id);
      setTravels(rawTravels.map((r, index) => rawToRow(r as Record<string, unknown>, jobTitleMap, extras[index])));
    } catch { /* keep */ }
    setLoading(false);
  }, [formJobId]);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate() {
    if (!formJobId || !formCity.trim() || !formDepart || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createTravelAssignment({
        jobId: formJobId,
        destinationCity: formCity.trim(),
        departureDate: formDepart,
        returnDate: formReturn || undefined,
        estimatedDays: formDays ? Number(formDays) : undefined,
        requiresLodging: formRequiresLodging,
        headcount: formHeadcount ? Number(formHeadcount) : undefined,
        approvedBudget: formBudget ? Number(formBudget) : undefined,
        mainTransportMode: formTransport,
        notes: formNotes.trim() || undefined,
      });
      setShowForm(false);
      setFormCity(""); setFormDepart(""); setFormReturn("");
      setFormDays(""); setFormBudget(""); setFormNotes("");
      setFormRequiresLodging(true); setFormHeadcount("1");
      await load();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error al crear el viaje.");
    }
    setSubmitting(false);
  }

  const active   = travels.filter(t => t.status === "ACTIVE").length;
  const pending  = travels.filter(t => t.status === "PENDING_SETTLEMENT").length;
  const total    = travels.length;

  const filtered = travels.filter(t => {
    if (filter === "active")  return t.status === "ACTIVE";
    if (filter === "pending") return t.status === "PENDING_SETTLEMENT";
    if (filter === "closed")  return ["CLOSED","CANCELLED"].includes(t.status);
    return true;
  });
  const sortedFiltered = [...filtered].sort((a, b) => {
    const aReady = a.readyToClose ? 1 : 0;
    const bReady = b.readyToClose ? 1 : 0;
    if (bReady !== aReady) return bReady - aReady;
    const aOverBudget = a.approvedBudget != null && a.totalSpent != null && a.totalSpent > a.approvedBudget ? 1 : 0;
    const bOverBudget = b.approvedBudget != null && b.totalSpent != null && b.totalSpent > b.approvedBudget ? 1 : 0;
    if (bOverBudget !== aOverBudget) return bOverBudget - aOverBudget;
    if (b.missingReceipts !== a.missingReceipts) return b.missingReceipts - a.missingReceipts;
    const aBalance = Math.abs(a.expectedBalance ?? 0);
    const bBalance = Math.abs(b.expectedBalance ?? 0);
    if (bBalance !== aBalance) return bBalance - aBalance;
    return String(b.departureDate).localeCompare(String(a.departureDate));
  });

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
  };
  const readyToCloseCount = travels.filter(t => t.readyToClose).length;

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      {/* Header */}
      <HtmlInCanvasPanel as="section" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: "24px", flexWrap: "wrap" }} canvasClassName="rounded-2xl" minHeight={82}>
        <div>
          <Link href="/worker/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px" }}>←</span> Dashboard
          </Link>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>Movilidad y Estancia</h1>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>Gestión de viajes, viáticos y liquidaciones para trabajos fuera de ciudad</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <NotificationBanner audience="worker" />
          <button onClick={() => void load()} disabled={loading} style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex" }} title="Recargar">
            <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
          <button onClick={() => setShowForm(v => !v)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "10px", border: "none", background: "var(--brand)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            <Plus size={15} /> Nuevo viaje
          </button>
        </div>
      </HtmlInCanvasPanel>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <StatCard label="Total viajes"  value={total}   icon={PlaneTakeoff} color="violet" loading={loading} />
        <StatCard label="Activos"        value={active}  icon={MapPin}       color="green"  loading={loading} />
        <StatCard label="Por liquidar"  value={pending} icon={DollarSign}   color="amber"  loading={loading} />
        <StatCard label="Listos para cerrar" value={readyToCloseCount} icon={DollarSign} color="green" loading={loading} />
        <StatCard label="Con presupuesto" value={travels.filter(t => t.approvedBudget != null).length} icon={Calendar} color="blue" loading={loading} />
      </div>

      {/* New travel form */}
      {showForm && (
        <HtmlInCanvasPanel as="section" style={{ ...card, padding: "20px", marginBottom: "20px" }} canvasClassName="rounded-2xl" minHeight={380}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", marginBottom: "16px" }}>Registrar viaje de trabajo</h2>
          <div style={{ display: "grid", gap: "12px" }}>
            {jobs.length > 0 && (
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>TRABAJO</label>
                <select value={formJobId} onChange={e => setFormJobId(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none" }}>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>CIUDAD DESTINO</label>
                <input value={formCity} onChange={e => setFormCity(e.target.value)} placeholder="Ej: Monterrey, NL" style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>TRANSPORTE PRINCIPAL</label>
                <select value={formTransport} onChange={e => setFormTransport(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none" }}>
                  {Object.entries(TRANSPORT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>SALIDA</label>
                <input type="date" value={formDepart} onChange={e => setFormDepart(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>REGRESO</label>
                <input type="date" value={formReturn} onChange={e => setFormReturn(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>DÍAS EST.</label>
                <input type="number" value={formDays} onChange={e => setFormDays(e.target.value)} placeholder="0" style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>PRESUPUESTO (USD)</label>
                <input type="number" value={formBudget} onChange={e => setFormBudget(e.target.value)} placeholder="0" style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", alignItems: "end" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--ink)", fontWeight: 600 }}>
                <input type="checkbox" checked={formRequiresLodging} onChange={e => setFormRequiresLodging(e.target.checked)} />
                Requiere hospedaje
              </label>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>PERSONAS</label>
                <input type="number" min="1" value={formHeadcount} onChange={e => setFormHeadcount(e.target.value)} placeholder="1" style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>NOTAS</label>
              <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            </div>
            {submitError && <p style={{ fontSize: "12px", color: "#ef4444" }}>{submitError}</p>}
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={() => void handleCreate()} disabled={submitting || !formCity.trim() || !formDepart} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: "var(--brand)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Guardando…" : "Crear viaje"}
              </button>
            </div>
          </div>
        </HtmlInCanvasPanel>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "4px", background: "var(--surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)", marginBottom: "16px", width: "fit-content" }}>
        {(["all","active","pending","closed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: "7px", border: "none",
            background: filter === f ? "var(--brand)" : "transparent",
            color: filter === f ? "#fff" : "var(--muted)",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
          }}>
            {f === "all" ? "Todos" : f === "active" ? "Activos" : f === "pending" ? "Por liquidar" : "Cerrados"}
          </button>
        ))}
      </div>

      {/* List */}
      <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={300}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1,2,3].map(i => <div key={i} style={{ height: "76px", borderRadius: "10px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <Inbox size={32} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted)" }}>
              {travels.length === 0 ? "Sin viajes registrados" : "Sin viajes en este filtro"}
            </p>
            <p style={{ fontSize: "12px", color: "var(--faint)", marginTop: "4px" }}>
              Crea un viaje con el botón de arriba cuando tengas un trabajo fuera de ciudad.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {sortedFiltered.map(t => {
              const sv = STATUS_VARIANT[t.status] ?? "neutral";
              const sl = STATUS_LABEL[t.status] ?? t.status;
              const isPendingSettlement = t.status === "PENDING_SETTLEMENT";
              const isOverBudget = t.approvedBudget != null && t.totalSpent != null && t.totalSpent > t.approvedBudget;
              const severity = isOverBudget ? "red" : t.missingReceipts > 0 ? "amber" : t.readyToClose ? "blue" : "green";
              const severityColor = severity === "red" ? "#dc2626" : severity === "amber" ? "#d97706" : severity === "blue" ? "#2563eb" : "#059669";
              const severityBg = severity === "red" ? "rgba(220,38,38,.12)" : severity === "amber" ? "rgba(217,119,6,.12)" : severity === "blue" ? "rgba(37,99,235,.12)" : "rgba(5,150,105,.12)";
              const severityLabel = severity === "red" ? "crítico" : severity === "amber" ? "faltan soportes" : severity === "blue" ? "listo para cerrar" : "estable";
              const balanceColor = t.expectedBalance == null ? "var(--faint)" : t.expectedBalance >= 0 ? "#166534" : "#b91c1c";
              return (
                <Link key={t.id} href={`/worker/travel/${t.id}`} style={{ textDecoration: "none" }}>
                  <div style={{ ...card, display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", borderColor: isPendingSettlement ? "rgba(251,191,36,.35)" : "var(--border)", background: isPendingSettlement ? "rgba(251,191,36,.03)" : "var(--surface)" }}>
                    <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: severityBg, display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <PlaneTakeoff size={18} color={severityColor} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{t.destinationCity}</span>
                        <StatusBadge variant={sv} text={sl} size="sm" />
                        <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 6px", borderRadius: "999px", background: severityBg, color: severityColor }}>
                          {severityLabel}
                        </span>
                      </div>
                      <p style={{ fontSize: "11px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.jobTitle} · {t.departureDate}{t.returnDate ? ` → ${t.returnDate}` : ""}
                        {t.estimatedDays ? ` · ${t.estimatedDays} días` : ""}
                        {t.requiresLodging ? " · con hospedaje" : " · sin hospedaje"}
                      </p>
                      <p style={{ fontSize: "11px", color: "var(--faint)", marginTop: "4px" }}>
                        gastos {t.expenseCount} · hospedaje {t.lodgingCount} · anticipos {t.advanceCount}
                      </p>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", color: "var(--faint)" }}>comprobantes {t.receiptCount}</span>
                        {t.expectedBalance != null && (
                          <span style={{ fontSize: "11px", fontWeight: 700, color: balanceColor }}>
                            saldo esp. {t.expectedBalance >= 0 ? "+" : "-"}{Math.abs(t.expectedBalance).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                        {t.receiptCount === 0 && (
                          <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 6px", borderRadius: "999px", background: "rgba(15,23,42,.08)", color: "#334155" }}>
                            0 comprobantes
                          </span>
                        )}
                        {t.readyToClose && (
                          <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 6px", borderRadius: "999px", background: "rgba(37,99,235,.12)", color: "#1d4ed8" }}>
                            listo para cerrar
                          </span>
                        )}
                        {t.blockedReason && (
                          <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 6px", borderRadius: "999px", background: "rgba(15,23,42,.08)", color: "#334155" }}>
                            {t.blockedReason}
                          </span>
                        )}
                        {t.missingExpenseReceipts > 0 && (
                          <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 6px", borderRadius: "999px", background: "rgba(245,158,11,.12)", color: "#b45309" }}>
                            {t.missingExpenseReceipts} gasto{t.missingExpenseReceipts > 1 ? "s" : ""} sin soporte
                          </span>
                        )}
                        {t.missingLodgingReceipts > 0 && (
                          <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 6px", borderRadius: "999px", background: "rgba(139,92,246,.12)", color: "#7c3aed" }}>
                            {t.missingLodgingReceipts} hospedaje{t.missingLodgingReceipts > 1 ? "s" : ""} sin soporte
                          </span>
                        )}
                        {isOverBudget && (
                          <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 6px", borderRadius: "999px", background: "rgba(239,68,68,.12)", color: "#b91c1c" }}>
                            sobre presupuesto
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, display: "flex", alignItems: "center", gap: "10px" }}>
                      {t.approvedBudget != null && (
                        <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink)" }}>${t.approvedBudget.toLocaleString()}</span>
                      )}
                      <ChevronRight size={14} style={{ color: "var(--muted)" }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </HtmlInCanvasPanel>
    </div>
  );
}
