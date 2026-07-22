"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, RefreshCw, MapPin, Building2, Utensils, Wallet, CheckCircle2, AlertTriangle, Clock3,
} from "lucide-react";
import { HtmlInCanvasPanel, StatCard, StatusBadge } from "@semse/ui";
import {
  closeTravelSettlement,
  fetchTravelAdvances,
  fetchTravelAssignment,
  fetchTravelExpenses,
  fetchTravelLodging,
  fetchTravelSettlement,
  updateTravelAssignmentStatus,
} from "../../../../semse-api";
import { NotificationBanner } from "../../../../components/notifications/NotificationBanner";

type Tab = "resumen" | "hospedaje" | "gastos" | "anticipos" | "liquidacion";
type TravelStatus = "DRAFT" | "PLANNED" | "ACTIVE" | "PENDING_SETTLEMENT" | "CLOSED" | "CANCELLED";

const STATUS_VARIANT: Record<TravelStatus, "success" | "warning" | "info" | "neutral" | "error"> = {
  DRAFT: "neutral",
  PLANNED: "info",
  ACTIVE: "success",
  PENDING_SETTLEMENT: "warning",
  CLOSED: "neutral",
  CANCELLED: "error",
};

const STATUS_LABEL: Record<TravelStatus, string> = {
  DRAFT: "Borrador",
  PLANNED: "Planificado",
  ACTIVE: "Activo",
  PENDING_SETTLEMENT: "Por liquidar",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
};

const CATEGORY_LABEL: Record<string, string> = {
  meal: "Alimentos",
  transport: "Transporte",
  other: "Otro",
};

function fmt(v: unknown): string {
  if (v == null || String(v).trim() === "") return "—";
  return String(v);
}

function fmtMoney(v: unknown): string {
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function fmtDate(v: unknown): string {
  if (!v) return "—";
  try {
    return new Date(String(v)).toLocaleDateString("es-MX");
  } catch {
    return String(v);
  }
}

export default function AdminTravelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const travelId = String(params?.travelId ?? "");

  const [activeTab, setActiveTab] = useState<Tab>(
    (searchParams?.get("tab") as Tab) ?? "resumen"
  );
  const [travel, setTravel] = useState<Record<string, unknown> | null>(null);
  const [expenses, setExpenses] = useState<Record<string, unknown>[]>([]);
  const [lodging, setLodging] = useState<Record<string, unknown>[]>([]);
  const [advances, setAdvances] = useState<Record<string, unknown>[]>([]);
  const [settlement, setSettlement] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [travelRecord, expenseRows, lodgingRows, advanceRows, settlementRow] = await Promise.all([
        fetchTravelAssignment(travelId),
        fetchTravelExpenses(travelId).catch(() => []),
        fetchTravelLodging(travelId).catch(() => []),
        fetchTravelAdvances(travelId).catch(() => []),
        fetchTravelSettlement(travelId).catch(() => null),
      ]);
      setTravel(travelRecord);
      setExpenses(expenseRows);
      setLodging(lodgingRows);
      setAdvances(advanceRows);
      setSettlement(settlementRow);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar viaje");
    } finally {
      setLoading(false);
    }
  }, [travelId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab === "resumen" || tab === "hospedaje" || tab === "gastos" || tab === "anticipos" || tab === "liquidacion") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const setTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", tab);
    router.replace(`${pathname ?? `/admin/travel/${travelId}`}?${params.toString()}`);
  }, [pathname, router, searchParams, travelId]);

  const handleActivate = async () => {
    setBusy(true);
    try {
      await updateTravelAssignmentStatus(travelId, "ACTIVE");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo activar el viaje.");
    } finally {
      setBusy(false);
    }
  };

  const handlePending = async () => {
    setBusy(true);
    try {
      await updateTravelAssignmentStatus(travelId, "PENDING_SETTLEMENT");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo mover el viaje a liquidación.");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    if (missingReceipts > 0) {
      setError("No se puede cerrar la liquidación mientras falten comprobantes.");
      return;
    }
    setBusy(true);
    try {
      await closeTravelSettlement(travelId, "Cierre administrativo");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cerrar la liquidación.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>Cargando viaje...</div>;
  }

  if (!travel) {
    return <div style={{ padding: "32px", textAlign: "center", color: "#ef4444" }}>{error ?? "Viaje no encontrado"}</div>;
  }

  const status = String(travel.status ?? "DRAFT").toUpperCase() as TravelStatus;
  const totalExpenses = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalLodging = lodging.reduce((sum, item) => sum + (Number(item.estimatedTotal) || Number(item.actualTotal) || Number(item.costPerNight) || 0), 0);
  const totalAdvances = advances.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalSpent = totalExpenses + totalLodging;
  const balance = totalAdvances - totalSpent;
  const approvedBudget = Number(travel.approvedBudget);
  const hasBudget = Number.isFinite(approvedBudget) && approvedBudget > 0;
  const budgetRemaining = hasBudget ? approvedBudget - totalSpent : null;
  const spentPct = hasBudget ? Math.min(100, Math.max(0, (totalSpent / approvedBudget) * 100)) : null;
  const advancePct = hasBudget ? Math.min(100, Math.max(0, (totalAdvances / approvedBudget) * 100)) : null;
  const missingExpenseReceipts = expenses.filter((item) => !String(item.receiptUrl ?? "").trim()).length;
  const missingLodgingReceipts = lodging.filter((item) => !String(item.receiptUrl ?? "").trim()).length;
  const missingReceipts = missingExpenseReceipts + missingLodgingReceipts;
  const expenseCount = expenses.length;
  const lodgingCount = lodging.length;
  const advanceCount = advances.length;
  const blockedPendingReason =
    expenseCount === 0 && lodgingCount === 0 && advanceCount === 0
      ? "sin base operativa"
      : Boolean(travel.requiresLodging) && lodgingCount === 0
        ? "sin hospedaje requerido"
        : null;
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "resumen", label: "Resumen" },
    { id: "hospedaje", label: "Hospedaje" },
    { id: "gastos", label: "Gastos" },
    { id: "anticipos", label: "Anticipos" },
    { id: "liquidacion", label: "Liquidación" },
  ];
  const statusChipBase: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: "999px",
    border: "none",
    cursor: "pointer",
  };
  const targetTab =
    searchParams?.get("tab") === "resumen" ||
    searchParams?.get("tab") === "hospedaje" ||
    searchParams?.get("tab") === "gastos" ||
    searchParams?.get("tab") === "anticipos" ||
    searchParams?.get("tab") === "liquidacion"
      ? (searchParams.get("tab") as Tab)
      : null;
  const lastActionLabel =
    status === "CLOSED"
      ? "Liquidación cerrada"
      : status === "PENDING_SETTLEMENT"
        ? "Movido a liquidación"
        : status === "ACTIVE"
          ? "Viaje activado"
          : status === "PLANNED"
            ? "Viaje planificado"
            : "Viaje en borrador";
  const lastActionAt =
    status === "CLOSED"
      ? settlement?.closedAt ?? travel.updatedAt ?? travel.createdAt
      : travel.updatedAt ?? travel.createdAt;

  return (
    <div style={{ maxWidth: "1040px", margin: "0 auto", display: "grid", gap: "18px" }}>
      <HtmlInCanvasPanel as="section" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }} canvasClassName="rounded-2xl" minHeight={90}>
        <div>
          <Link href="/admin/travel" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none", marginBottom: "8px" }}>
            <ArrowLeft size={14} /> Travel Ops
          </Link>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>{fmt(travel.destinationCity)}</h1>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>
            {fmt(travel.jobTitle ?? travel.jobId)} · worker {fmt(travel.assignedTo)}
          </p>
          {String(travel.jobId ?? "").trim() && (
            <Link href={`/jobs/${String(travel.jobId)}`} style={{ display: "inline-flex", marginTop: "6px", fontSize: "12px", fontWeight: 600, color: "var(--brand)", textDecoration: "none" }}>
              Abrir job
            </Link>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <NotificationBanner audience="admin" />
          <StatusBadge variant={STATUS_VARIANT[status] ?? "neutral"} text={STATUS_LABEL[status] ?? status} size="sm" />
          <button onClick={() => void load()} disabled={busy} style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex" }}>
            <RefreshCw size={15} style={{ animation: busy ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </HtmlInCanvasPanel>

      {error && (
        <div style={{ padding: "12px 14px", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: "12px", fontSize: "13px" }}>
          {error}
        </div>
      )}

      <div style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: "12px", padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>Última acción operativa</p>
          <p style={{ fontSize: "12px", color: "var(--muted)" }}>{lastActionLabel}</p>
        </div>
        <p style={{ fontSize: "12px", color: "var(--faint)" }}>{fmtDate(lastActionAt)}</p>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button onClick={() => setTab("liquidacion")} style={{ ...statusChipBase, background: status === "PENDING_SETTLEMENT" ? "rgba(59,130,246,.12)" : "rgba(148,163,184,.16)", color: status === "PENDING_SETTLEMENT" ? "#1d4ed8" : "#475569" }}>
          {status === "PENDING_SETTLEMENT" ? "pendiente de liquidación" : STATUS_LABEL[status] ?? status.toLowerCase()}
        </button>
        {missingExpenseReceipts > 0 && (
          <button onClick={() => setTab("gastos")} style={{ ...statusChipBase, background: "rgba(245,158,11,.12)", color: "#b45309" }}>
            {missingExpenseReceipts} gasto{missingExpenseReceipts > 1 ? "s" : ""} sin soporte
          </button>
        )}
        {missingLodgingReceipts > 0 && (
          <button onClick={() => setTab("hospedaje")} style={{ ...statusChipBase, background: "rgba(139,92,246,.12)", color: "#7c3aed" }}>
            {missingLodgingReceipts} hospedaje{missingLodgingReceipts > 1 ? "s" : ""} sin soporte
          </button>
        )}
        {hasBudget && Number(budgetRemaining) < 0 && (
          <button onClick={() => setTab("liquidacion")} style={{ ...statusChipBase, background: "rgba(239,68,68,.12)", color: "#b91c1c" }}>
            sobre presupuesto
          </button>
        )}
        {(!missingReceipts && (!hasBudget || Number(budgetRemaining) >= 0) && status !== "PENDING_SETTLEMENT") && (
          <button onClick={() => setTab("resumen")} style={{ ...statusChipBase, background: "rgba(16,185,129,.12)", color: "#047857" }}>
            ok operativo
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
        <StatCard label="Gasto total" value={fmtMoney(totalSpent)} icon={Utensils} color="blue" />
        <StatCard label="Hospedaje" value={fmtMoney(totalLodging)} icon={Building2} color="violet" />
        <StatCard label="Anticipos" value={fmtMoney(totalAdvances)} icon={Wallet} color="green" />
        <StatCard label="Balance" value={fmtMoney(balance)} icon={CheckCircle2} color={balance >= 0 ? "green" : "red"} />
      </div>

      {hasBudget && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 16px", display: "grid", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 800, color: "var(--ink)" }}>Presupuesto vs gasto</p>
              <p style={{ fontSize: "12px", color: "var(--muted)" }}>
                Presupuesto {fmtMoney(approvedBudget)} · gasto {fmtMoney(totalSpent)} · anticipos {fmtMoney(totalAdvances)}
              </p>
            </div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: Number(budgetRemaining) < 0 ? "#b91c1c" : "#166534" }}>
              {Number(budgetRemaining) < 0 ? `Excedido ${fmtMoney(Math.abs(Number(budgetRemaining)))}` : `Disponible ${fmtMoney(budgetRemaining)}`}
            </div>
          </div>
          <div style={{ display: "grid", gap: "8px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>
                <span>Gasto ejecutado</span>
                <span>{spentPct?.toFixed(0)}%</span>
              </div>
              <div style={{ width: "100%", height: "10px", borderRadius: "999px", background: "rgba(148,163,184,.16)", overflow: "hidden" }}>
                <div style={{ width: `${spentPct ?? 0}%`, height: "100%", background: Number(budgetRemaining) < 0 ? "#ef4444" : "#3b82f6" }} />
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>
                <span>Anticipos entregados</span>
                <span>{advancePct?.toFixed(0)}%</span>
              </div>
              <div style={{ width: "100%", height: "10px", borderRadius: "999px", background: "rgba(148,163,184,.16)", overflow: "hidden" }}>
                <div style={{ width: `${advancePct ?? 0}%`, height: "100%", background: "#10b981" }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {(hasBudget || missingReceipts > 0) && (
        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {hasBudget && (
            <div style={{ border: `1px solid ${Number(budgetRemaining) < 0 ? "#fecaca" : "#bbf7d0"}`, background: Number(budgetRemaining) < 0 ? "#fef2f2" : "#f0fdf4", color: Number(budgetRemaining) < 0 ? "#b91c1c" : "#166534", borderRadius: "12px", padding: "14px" }}>
              <p style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>Presupuesto</p>
              <p style={{ fontSize: "12px" }}>
                {Number(budgetRemaining) < 0
                  ? `Viaje excedido por ${fmtMoney(Math.abs(Number(budgetRemaining))) }.`
                  : `Disponible ${fmtMoney(budgetRemaining)} del presupuesto aprobado.`}
              </p>
            </div>
          )}
          {missingReceipts > 0 && (
            <div style={{ border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", borderRadius: "12px", padding: "14px" }}>
              <p style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>Comprobantes faltantes</p>
              <p style={{ fontSize: "12px" }}>{missingReceipts} registro{missingReceipts > 1 ? "s" : ""} sin comprobante.</p>
            </div>
          )}
        </div>
      )}

      {status === "ACTIVE" && blockedPendingReason && (
        <div style={{ border: "1px solid #fcd34d", background: "#fffbeb", color: "#92400e", borderRadius: "12px", padding: "14px" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>Bloqueo para mover a liquidación</p>
          <p style={{ fontSize: "12px" }}>
            Motivo: {blockedPendingReason}. Estado actual: gastos {expenseCount}, hospedaje {lodgingCount}, anticipos {advanceCount}.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {(status === "DRAFT" || status === "PLANNED") && (
          <button onClick={() => void handleActivate()} disabled={busy} style={{ padding: "9px 14px", borderRadius: "10px", border: "none", background: "#16a34a", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>
            Activar viaje
          </button>
        )}
        {status === "ACTIVE" && (
          <button onClick={() => void handlePending()} disabled={busy || Boolean(blockedPendingReason)} style={{ padding: "9px 14px", borderRadius: "10px", border: "none", background: blockedPendingReason ? "#94a3b8" : "#d97706", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: busy || blockedPendingReason ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }}>
            Mover a liquidación
          </button>
        )}
        {status === "ACTIVE" && blockedPendingReason && (
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#b45309", alignSelf: "center" }}>
            bloqueado por {blockedPendingReason}
          </span>
        )}
        {status === "PENDING_SETTLEMENT" && (
          <>
            <button onClick={() => { if (window.confirm("¿Cerrar la liquidación de este viaje? Esto finaliza el saldo de reembolso de gastos del profesional de forma permanente.")) void handleClose(); }} disabled={busy || missingReceipts > 0} style={{ padding: "9px 14px", borderRadius: "10px", border: "none", background: missingReceipts > 0 ? "#94a3b8" : "#2563eb", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: busy || missingReceipts > 0 ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }}>
              Cerrar liquidación
            </button>
            {missingReceipts > 0 && (
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#b45309", alignSelf: "center" }}>
                bloqueado por soportes faltantes
              </span>
            )}
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: "4px", background: "var(--surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)", width: "fit-content", overflowX: "auto" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            style={{
              padding: "6px 14px",
              borderRadius: "7px",
              border: activeTab === tab.id && targetTab === tab.id ? "1px solid rgba(37,99,235,.45)" : "none",
              boxShadow: activeTab === tab.id && targetTab === tab.id ? "0 0 0 2px rgba(37,99,235,.14)" : "none",
              background: activeTab === tab.id ? "var(--brand)" : "transparent",
              color: activeTab === tab.id ? "#fff" : "var(--muted)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={320}>
        {activeTab === "resumen" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", marginBottom: "12px" }}>Datos del viaje</h3>
              <div style={{ display: "grid", gap: "8px", fontSize: "13px", color: "var(--muted)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span>Destino</span><strong style={{ color: "var(--ink)" }}>{fmt(travel.destinationCity)}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span>Salida</span><strong style={{ color: "var(--ink)" }}>{fmtDate(travel.departureDate)}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span>Regreso</span><strong style={{ color: "var(--ink)" }}>{fmtDate(travel.returnDate)}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span>Transporte</span><strong style={{ color: "var(--ink)" }}>{fmt(travel.mainTransportMode)}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span>Hospedaje</span><strong style={{ color: "var(--ink)" }}>{Boolean(travel.requiresLodging) ? "Sí" : "No"}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span>Personas</span><strong style={{ color: "var(--ink)" }}>{fmt(travel.headcount)}</strong></div>
              </div>
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", marginBottom: "12px" }}>Control financiero</h3>
              <div style={{ display: "grid", gap: "8px", fontSize: "13px", color: "var(--muted)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span>Presupuesto</span><strong style={{ color: "var(--ink)" }}>{fmtMoney(travel.approvedBudget)}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span>Gasto total</span><strong style={{ color: "var(--ink)" }}>{fmtMoney(totalSpent)}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span>Anticipos</span><strong style={{ color: "var(--ink)" }}>{fmtMoney(totalAdvances)}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span>Disponible</span><strong style={{ color: "var(--ink)" }}>{hasBudget ? fmtMoney(budgetRemaining) : "—"}</strong></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "hospedaje" && (
          lodging.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>Sin registros de hospedaje</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {lodging.map((item) => (
                <div key={String(item.id)} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{fmt(item.name)}</p>
                      <p style={{ fontSize: "12px", color: "var(--muted)" }}>{fmt(item.type)} · {fmt(item.address)}</p>
                    </div>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{fmtMoney(item.estimatedTotal ?? item.actualTotal ?? item.costPerNight)}</p>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--faint)", marginTop: "6px" }}>
                    {fmtDate(item.checkIn)} → {fmtDate(item.checkOut)} · Pagado por {fmt(item.paidBy)}
                    {item.receiptUrl ? ` · comprobante cargado` : " · sin comprobante"}
                  </p>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "8px" }}>
                    {Boolean(item.googleMapsUri) && (
                      <a
                        href={String(item.googleMapsUri)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "inline-flex", fontSize: "12px", fontWeight: 600, color: "#2563eb", textDecoration: "none" }}
                      >
                        Abrir en Maps
                      </a>
                    )}
                    {Boolean(item.receiptUrl) && (
                      <a
                        href={String(item.receiptUrl)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "inline-flex", fontSize: "12px", fontWeight: 600, color: "#2563eb", textDecoration: "none" }}
                      >
                        Ver comprobante
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === "gastos" && (
          expenses.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>Sin gastos registrados</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {expenses.map((item) => (
                <div key={String(item.id)} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 16px", display: "flex", justifyContent: "space-between", gap: "14px" }}>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{CATEGORY_LABEL[String(item.category)] ?? fmt(item.category)}</p>
                    <p style={{ fontSize: "12px", color: "var(--muted)" }}>{fmtDate(item.expenseDate)} · {fmt(item.vendor)} · {fmt(item.description)}</p>
                    {(Boolean(item.origin) || Boolean(item.destination)) && <p style={{ fontSize: "12px", color: "var(--faint)" }}>{fmt(item.origin)} → {fmt(item.destination)}</p>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{fmtMoney(item.amount)}</p>
                    <p style={{ fontSize: "12px", color: item.receiptUrl ? "#2563eb" : "var(--faint)" }}>{item.receiptUrl ? "con comprobante" : "sin comprobante"}</p>
                    {Boolean(item.receiptUrl) && (
                      <a
                        href={String(item.receiptUrl)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "inline-flex", marginTop: "6px", fontSize: "12px", fontWeight: 600, color: "#2563eb", textDecoration: "none" }}
                      >
                        Abrir comprobante
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === "anticipos" && (
          advances.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>Sin anticipos registrados</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {advances.map((item) => (
                <div key={String(item.id)} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 16px", display: "flex", justifyContent: "space-between", gap: "14px" }}>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{fmt(item.method)} · {fmt(item.purpose)}</p>
                    <p style={{ fontSize: "12px", color: "var(--muted)" }}>{fmtDate(item.issuedAt ?? item.createdAt)} · aprobado por {fmt(item.approvedBy)}</p>
                  </div>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{fmtMoney(item.amount)}</p>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === "liquidacion" && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", display: "grid", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>Liquidación</h3>
              {settlement && (
                <StatusBadge
                  text={String(settlement.status ?? "DRAFT")}
                  variant={String(settlement.status ?? "").toUpperCase() === "CLOSED" ? "success" : "warning"}
                  size="sm"
                />
              )}
            </div>
            {missingReceipts > 0 && (
              <div style={{ border: "1px solid #fcd34d", background: "#fffbeb", color: "#92400e", borderRadius: "12px", padding: "12px 14px", display: "grid", gap: "4px" }}>
                <p style={{ fontSize: "13px", fontWeight: 700 }}>Liquidación con soportes faltantes</p>
                <p style={{ fontSize: "12px" }}>
                  Faltan {missingReceipts} comprobante{missingReceipts > 1 ? "s" : ""}. Revisa
                  {missingExpenseReceipts > 0 ? ` gastos (${missingExpenseReceipts})` : ""}
                  {missingExpenseReceipts > 0 && missingLodgingReceipts > 0 ? " y" : ""}
                  {missingLodgingReceipts > 0 ? ` hospedaje (${missingLodgingReceipts})` : ""} antes de cerrar.
                </p>
              </div>
            )}
            <div style={{ display: "grid", gap: "8px", fontSize: "13px", color: "var(--muted)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span>Alimentos</span><strong style={{ color: "var(--ink)" }}>{fmtMoney(settlement?.totalMeals ?? expenses.filter((item) => String(item.category) === "meal").reduce((sum, item) => sum + (Number(item.amount) || 0), 0))}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span>Transporte</span><strong style={{ color: "var(--ink)" }}>{fmtMoney(settlement?.totalTransport ?? expenses.filter((item) => String(item.category) === "transport").reduce((sum, item) => sum + (Number(item.amount) || 0), 0))}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span>Hospedaje</span><strong style={{ color: "var(--ink)" }}>{fmtMoney(settlement?.totalLodging ?? totalLodging)}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span>Total gastado</span><strong style={{ color: "var(--ink)" }}>{fmtMoney(settlement?.totalSpent ?? totalSpent)}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span>Anticipos</span><strong style={{ color: "var(--ink)" }}>{fmtMoney(settlement?.totalAdvances ?? totalAdvances)}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span>{Number(settlement?.balanceDue ?? balance) >= 0 ? "Saldo a devolver" : "Saldo a pagar"}</span><strong style={{ color: Number(settlement?.balanceDue ?? balance) >= 0 ? "#166534" : "#b91c1c" }}>{fmtMoney(Math.abs(Number(settlement?.balanceDue ?? balance)))}</strong></div>
              {Boolean(settlement?.closedAt) && <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span>Cerrada</span><strong style={{ color: "var(--ink)" }}>{fmtDate(settlement?.closedAt)}</strong></div>}
            </div>
          </div>
        )}
      </HtmlInCanvasPanel>
    </div>
  );
}
