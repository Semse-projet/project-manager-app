"use client";

import Link from "next/link";
import { useLanguage } from "../../../../lib/language-context";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PlaneTakeoff, RefreshCw, Inbox, Wallet, AlertTriangle, Clock3, ChevronRight, ChevronDown } from "lucide-react";
import { HtmlInCanvasPanel, StatCard, StatusBadge } from "@semse/ui";
import { fetchJobs, fetchTravelAdvances, fetchTravelAssignments, fetchTravelExpenses, fetchTravelLodging, fetchTravelSettlement } from "../../../semse-api";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

type TravelStatus = "DRAFT" | "PLANNED" | "ACTIVE" | "PENDING_SETTLEMENT" | "CLOSED" | "CANCELLED";

type TravelRow = {
  id: string;
  jobId: string;
  jobTitle: string;
  assignedTo: string;
  destinationCity: string;
  departureDate: string;
  returnDate: string | null;
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
};

const STATUS_MAP: Record<TravelStatus, { variant: "success" | "warning" | "info" | "neutral" | "error"; label: string }> = {
  DRAFT: { variant: "neutral", label: "Borrador" },
  PLANNED: { variant: "info", label: "Planificado" },
  ACTIVE: { variant: "success", label: "Activo" },
  PENDING_SETTLEMENT: { variant: "warning", label: "Por liquidar" },
  CLOSED: { variant: "neutral", label: "Cerrado" },
  CANCELLED: { variant: "error", label: "Cancelado" },
};

function rawToRow(
  row: Record<string, unknown>,
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
  const jobId = String(row.jobId ?? "");
  const status = String(row.status ?? "DRAFT").toUpperCase() as TravelStatus;
  return {
    id: String(row.id ?? ""),
    jobId,
    jobTitle: jobTitleMap[jobId] ?? jobId,
    assignedTo: String(row.assignedTo ?? "—"),
    destinationCity: String(row.destinationCity ?? "—"),
    departureDate: typeof row.departureDate === "string" ? row.departureDate.slice(0, 10) : "—",
    returnDate: typeof row.returnDate === "string" ? row.returnDate.slice(0, 10) : null,
    approvedBudget: typeof row.approvedBudget === "number" ? row.approvedBudget : null,
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
        : Boolean(row.requiresLodging) && status === "ACTIVE" && (extras?.lodgingCount ?? 0) === 0
          ? "sin hospedaje requerido"
          : null,
    status: ["DRAFT", "PLANNED", "ACTIVE", "PENDING_SETTLEMENT", "CLOSED", "CANCELLED"].includes(status) ? status : "DRAFT",
  };
}

export default function AdminTravelPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const safeSearchParams = searchParams ?? new URLSearchParams();
  const safePathname = pathname ?? "/admin/travel";
  const [items, setItems] = useState<TravelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "closed">(
    (safeSearchParams.get("status") as "all" | "active" | "pending" | "closed") ?? "all"
  );
  const [search, setSearch] = useState(safeSearchParams.get("q") ?? "");
  const [cityFilter, setCityFilter] = useState(safeSearchParams.get("city") ?? "all");
  const [workerFilter, setWorkerFilter] = useState(safeSearchParams.get("worker") ?? "all");
  const [jobFilter, setJobFilter] = useState(safeSearchParams.get("job") ?? "all");
  const [showPending, setShowPending] = useState(safeSearchParams.get("grp_pending") !== "0");
  const [showRisk, setShowRisk] = useState(safeSearchParams.get("grp_risk") !== "0");
  const [showOk, setShowOk] = useState(safeSearchParams.get("grp_ok") !== "0");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [travels, jobs] = await Promise.all([
        fetchTravelAssignments({ scope: "all" }).catch(() => [] as Record<string, unknown>[]),
        fetchJobs().catch(() => []),
      ]);
      const jobTitleMap: Record<string, string> = {};
      for (const job of jobs) jobTitleMap[job.id] = job.title;
      const extras = await Promise.all(
        travels.map(async (item) => {
          const travelId = String(item.id ?? "");
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
      setItems(travels.map((item, index) => rawToRow(item, jobTitleMap, extras[index])));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    setFilter((safeSearchParams.get("status") as "all" | "active" | "pending" | "closed") ?? "all");
    setSearch(safeSearchParams.get("q") ?? "");
    setCityFilter(safeSearchParams.get("city") ?? "all");
    setWorkerFilter(safeSearchParams.get("worker") ?? "all");
    setJobFilter(safeSearchParams.get("job") ?? "all");
    setShowPending(safeSearchParams.get("grp_pending") !== "0");
    setShowRisk(safeSearchParams.get("grp_risk") !== "0");
    setShowOk(safeSearchParams.get("grp_ok") !== "0");
  }, [safeSearchParams]);

  const syncFilters = useCallback((next: {
    status?: "all" | "active" | "pending" | "closed";
    q?: string;
    city?: string;
    worker?: string;
    job?: string;
    grpPending?: boolean;
    grpRisk?: boolean;
    grpOk?: boolean;
  }) => {
    const params = new URLSearchParams(safeSearchParams.toString());
    const values = {
      status: next.status ?? filter,
      q: next.q ?? search,
      city: next.city ?? cityFilter,
      worker: next.worker ?? workerFilter,
      job: next.job ?? jobFilter,
      grpPending: next.grpPending ?? showPending,
      grpRisk: next.grpRisk ?? showRisk,
      grpOk: next.grpOk ?? showOk,
    };
    if (values.status && values.status !== "all") params.set("status", values.status); else params.delete("status");
    if (values.q && values.q.trim()) params.set("q", values.q.trim()); else params.delete("q");
    if (values.city && values.city !== "all") params.set("city", values.city); else params.delete("city");
    if (values.worker && values.worker !== "all") params.set("worker", values.worker); else params.delete("worker");
    if (values.job && values.job !== "all") params.set("job", values.job); else params.delete("job");
    if (!values.grpPending) params.set("grp_pending", "0"); else params.delete("grp_pending");
    if (!values.grpRisk) params.set("grp_risk", "0"); else params.delete("grp_risk");
    if (!values.grpOk) params.set("grp_ok", "0"); else params.delete("grp_ok");
    const query = params.toString();
    router.replace(query ? `${safePathname}?${query}` : safePathname);
  }, [cityFilter, filter, jobFilter, router, safePathname, safeSearchParams, search, showOk, showPending, showRisk, workerFilter]);

  const active = items.filter((item) => item.status === "ACTIVE").length;
  const pendingSettlement = items.filter((item) => item.status === "PENDING_SETTLEMENT").length;
  const drafts = items.filter((item) => item.status === "DRAFT" || item.status === "PLANNED").length;
  const budgeted = items.filter((item) => item.approvedBudget != null).length;
  const flaggedReceipts = items.filter((item) => item.missingReceipts > 0).length;
  const overBudget = items.filter((item) => item.approvedBudget != null && item.totalSpent != null && item.totalSpent > item.approvedBudget).length;
  const cityOptions = useMemo(() => Array.from(new Set(items.map((item) => item.destinationCity).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [items]);
  const workerOptions = useMemo(() => Array.from(new Set(items.map((item) => item.assignedTo).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [items]);
  const jobOptions = useMemo(() => Array.from(new Set(items.map((item) => item.jobTitle).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [items]);
  const filtered = items.filter((item) => {
    if (filter === "active") return item.status === "ACTIVE";
    if (filter === "pending") return item.status === "PENDING_SETTLEMENT";
    if (filter === "closed") return item.status === "CLOSED" || item.status === "CANCELLED";
    return true;
  }).filter((item) => {
    if (cityFilter !== "all" && item.destinationCity !== cityFilter) return false;
    if (workerFilter !== "all" && item.assignedTo !== workerFilter) return false;
    if (jobFilter !== "all" && item.jobTitle !== jobFilter) return false;
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return [
      item.destinationCity,
      item.assignedTo,
      item.jobTitle,
      item.jobId,
      item.id,
    ].some((value) => String(value).toLowerCase().includes(needle));
  });
  const pendingItems = filtered.filter((item) => item.status === "PENDING_SETTLEMENT");
  const riskItems = filtered.filter((item) =>
    item.status !== "PENDING_SETTLEMENT" &&
    (item.missingReceipts > 0 || (item.approvedBudget != null && item.totalSpent != null && item.totalSpent > item.approvedBudget))
  );
  const okItems = filtered.filter((item) =>
    item.status !== "PENDING_SETTLEMENT" &&
    !(item.missingReceipts > 0 || (item.approvedBudget != null && item.totalSpent != null && item.totalSpent > item.approvedBudget))
  );
  const sortByPriority = (a: TravelRow, b: TravelRow) => {
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
  };
  pendingItems.sort(sortByPriority);
  riskItems.sort(sortByPriority);
  okItems.sort(sortByPriority);

  function summarizeGroup(group: TravelRow[]) {
    return {
      budget: group.reduce((sum, item) => sum + (item.approvedBudget ?? 0), 0),
      spent: group.reduce((sum, item) => sum + (item.totalSpent ?? 0), 0),
      missing: group.reduce((sum, item) => sum + item.missingReceipts, 0),
    };
  }

  const pendingSummary = summarizeGroup(pendingItems);
  const riskSummary = summarizeGroup(riskItems);
  const okSummary = summarizeGroup(okItems);
  const readyToCloseCount = pendingItems.filter((item) => item.readyToClose).length;

  function renderTravelRow(item: TravelRow) {
    const status = STATUS_MAP[item.status];
    const overBudget = item.approvedBudget != null && item.totalSpent != null && item.totalSpent > item.approvedBudget;
    const detailHref = `/admin/travel/${item.id}`;
    const settlementHref = `${detailHref}?tab=liquidacion`;
    const expenseHref = `${detailHref}?tab=gastos`;
    const lodgingHref = `${detailHref}?tab=hospedaje`;
    const severity = overBudget ? "red" : item.missingReceipts > 0 ? "amber" : item.status === "PENDING_SETTLEMENT" ? "blue" : "green";
    const severityColor = severity === "red" ? "#dc2626" : severity === "amber" ? "#d97706" : severity === "blue" ? "#2563eb" : "#059669";
    const severityBg = severity === "red" ? "rgba(220,38,38,.12)" : severity === "amber" ? "rgba(217,119,6,.12)" : severity === "blue" ? "rgba(37,99,235,.12)" : "rgba(5,150,105,.12)";
    const severityLabel = severity === "red" ? "crítico" : severity === "amber" ? "atención" : severity === "blue" ? "por cerrar" : "estable";
    const balanceColor = item.expectedBalance == null ? "var(--faint)" : item.expectedBalance >= 0 ? "#166534" : "#b91c1c";
    return (
      <div key={item.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 16px", display: "flex", gap: "14px", alignItems: "center" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "12px", display: "grid", placeItems: "center", background: severityBg, flexShrink: 0 }}>
          <PlaneTakeoff size={17} color={severityColor} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "4px" }}>
            <Link href={detailHref} style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}>
              {item.destinationCity}
            </Link>
            <StatusBadge variant={status.variant} text={status.label} size="sm" />
            <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 6px", borderRadius: "999px", background: severityBg, color: severityColor }}>
              {severityLabel}
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
            {item.jobTitle} · worker {item.assignedTo}
          </p>
          <p style={{ fontSize: "11px", color: "var(--faint)", margin: "4px 0 0" }}>
            {item.departureDate}{item.returnDate ? ` → ${item.returnDate}` : ""}{item.approvedBudget != null ? ` · USD ${item.approvedBudget.toLocaleString()}` : " · sin presupuesto"}
            {item.totalSpent != null ? ` · gasto ${item.totalSpent.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : ""}
          </p>
          <p style={{ fontSize: "11px", color: "var(--faint)", margin: "4px 0 0" }}>
            gastos {item.expenseCount} · hospedaje {item.lodgingCount} · anticipos {item.advanceCount}
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "var(--faint)" }}>comprobantes {item.receiptCount}</span>
            {item.expectedBalance != null && (
              <span style={{ fontSize: "11px", fontWeight: 700, color: balanceColor }}>
                saldo esp. {item.expectedBalance >= 0 ? "+" : "-"}{Math.abs(item.expectedBalance).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
            {item.receiptCount === 0 && (
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 6px", borderRadius: "999px", background: "rgba(15,23,42,.08)", color: "#334155" }}>
                0 comprobantes
              </span>
            )}
            {item.status === "PENDING_SETTLEMENT" && (
              <Link href={settlementHref} style={{ fontSize: "10px", fontWeight: 700, padding: "3px 6px", borderRadius: "999px", background: "rgba(37,99,235,.12)", color: "#1d4ed8", textDecoration: "none" }}>
                abrir liquidación
              </Link>
            )}
            {item.readyToClose && (
              <Link href={settlementHref} style={{ fontSize: "10px", fontWeight: 700, padding: "3px 6px", borderRadius: "999px", background: "rgba(5,150,105,.12)", color: "#047857", textDecoration: "none" }}>
                listo para cerrar
              </Link>
            )}
            {item.blockedReason && (
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 6px", borderRadius: "999px", background: "rgba(15,23,42,.08)", color: "#334155" }}>
                {item.blockedReason}
              </span>
            )}
            {item.missingExpenseReceipts > 0 && (
              <Link href={expenseHref} style={{ fontSize: "10px", fontWeight: 700, padding: "3px 6px", borderRadius: "999px", background: "rgba(245,158,11,.12)", color: "#b45309", textDecoration: "none" }}>
                {item.missingExpenseReceipts} gasto{item.missingExpenseReceipts > 1 ? "s" : ""} sin soporte
              </Link>
            )}
            {item.missingLodgingReceipts > 0 && (
              <Link href={lodgingHref} style={{ fontSize: "10px", fontWeight: 700, padding: "3px 6px", borderRadius: "999px", background: "rgba(139,92,246,.12)", color: "#7c3aed", textDecoration: "none" }}>
                {item.missingLodgingReceipts} hospedaje{item.missingLodgingReceipts > 1 ? "s" : ""} sin soporte
              </Link>
            )}
            {overBudget && (
              <Link href={settlementHref} style={{ fontSize: "10px", fontWeight: 700, padding: "3px 6px", borderRadius: "999px", background: "rgba(239,68,68,.12)", color: "#b91c1c", textDecoration: "none" }}>
                sobre presupuesto
              </Link>
            )}
            {item.missingReceipts > 0 && (
              <Link href={detailHref} style={{ fontSize: "10px", fontWeight: 700, padding: "3px 6px", borderRadius: "999px", background: "rgba(15,23,42,.08)", color: "#334155", textDecoration: "none" }}>
                revisar viaje
              </Link>
            )}
          </div>
        </div>
        <Link href={item.status === "PENDING_SETTLEMENT" ? settlementHref : detailHref} style={{ color: "var(--muted)", display: "flex", flexShrink: 0 }}>
          <ChevronRight size={14} />
        </Link>
      </div>
    );
  }

  const hasActiveFilters =
    filter !== "all" ||
    !!search.trim() ||
    cityFilter !== "all" ||
    workerFilter !== "all" ||
    jobFilter !== "all";
  const activeFilterCount = [
    filter !== "all",
    !!search.trim(),
    cityFilter !== "all",
    workerFilter !== "all",
    jobFilter !== "all",
  ].filter(Boolean).length;

  return (
    <div style={{ maxWidth: "980px", margin: "0 auto" }}>
      <AdminPageHeader
        title={t("page.travelOps")}
        subtitle={t("page.travelOps.sub")}
        icon={PlaneTakeoff}
        iconColor="#8b5cf6"
        iconBg="rgba(139,92,246,0.15)"
        panel
        actions={
          <>
            <NotificationBanner audience="admin" />
            <button onClick={() => void load()} disabled={loading} style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex" }} title="Recargar">
              <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </button>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <StatCard label="Viajes totales" value={items.length} icon={PlaneTakeoff} color="violet" loading={loading} />
        <StatCard label="Activos" value={active} icon={PlaneTakeoff} color="green" loading={loading} />
        <StatCard label="Por liquidar" value={pendingSettlement} icon={Clock3} color="amber" loading={loading} />
        <StatCard label="Listos para cerrar" value={readyToCloseCount} icon={Clock3} color="green" loading={loading} />
        <StatCard label="Con presupuesto" value={budgeted} icon={Wallet} color="blue" loading={loading} />
        <StatCard label="Draft / plan" value={drafts} icon={AlertTriangle} color="orange" loading={loading} />
        <StatCard label="Sin comprobante" value={flaggedReceipts} icon={AlertTriangle} color="amber" loading={loading} />
        <StatCard label="Sobre presupuesto" value={overBudget} icon={Wallet} color="red" loading={loading} />
      </div>

      <div style={{ display: "flex", gap: "4px", background: "var(--surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)", marginBottom: "16px", width: "fit-content" }}>
        {(["all", "active", "pending", "closed"] as const).map((value) => (
          <button
            key={value}
            onClick={() => {
              setFilter(value);
              syncFilters({ status: value });
            }}
            style={{
              padding: "6px 14px",
              borderRadius: "7px",
              border: "none",
              background: filter === value ? "var(--brand)" : "transparent",
              color: filter === value ? "#fff" : "var(--muted)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {value === "all" ? "Todos" : value === "active" ? "Activos" : value === "pending" ? "Por liquidar" : "Cerrados"}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginBottom: "16px", alignItems: "start" }}>
        <input
          value={search}
          onChange={(e) => {
            const value = e.target.value;
            setSearch(value);
            syncFilters({ q: value });
          }}
          placeholder="Buscar por ciudad, worker, job o id"
          style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
        />
        <select value={cityFilter} onChange={(e) => {
          const value = e.target.value;
          setCityFilter(value);
          syncFilters({ city: value });
        }} style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "13px", outline: "none" }}>
          <option value="all">Todas las ciudades</option>
          {cityOptions.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={workerFilter} onChange={(e) => {
          const value = e.target.value;
          setWorkerFilter(value);
          syncFilters({ worker: value });
        }} style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "13px", outline: "none" }}>
          <option value="all">Todos los workers</option>
          {workerOptions.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={jobFilter} onChange={(e) => {
          const value = e.target.value;
          setJobFilter(value);
          syncFilters({ job: value });
        }} style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "13px", outline: "none" }}>
          <option value="all">Todos los jobs</option>
          {jobOptions.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <button
          onClick={() => {
            setFilter("all");
            setSearch("");
            setCityFilter("all");
            setWorkerFilter("all");
            setJobFilter("all");
            syncFilters({ status: "all", q: "", city: "all", worker: "all", job: "all" });
          }}
          disabled={!hasActiveFilters}
          style={{
            width: "100%",
            minHeight: "42px",
            padding: "10px 12px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            background: hasActiveFilters ? "var(--surface)" : "rgba(148,163,184,.08)",
            color: hasActiveFilters ? "var(--ink)" : "var(--faint)",
            fontSize: "13px",
            fontWeight: 700,
            cursor: hasActiveFilters ? "pointer" : "not-allowed",
          }}
        >
          Limpiar filtros
        </button>
      </div>

      {hasActiveFilters && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, padding: "4px 8px", borderRadius: "999px", background: "rgba(37,99,235,.12)", color: "#1d4ed8" }}>
            {activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""} activo{activeFilterCount > 1 ? "s" : ""}
          </span>
          <button
            onClick={() => {
              setFilter("all");
              setSearch("");
              setCityFilter("all");
              setWorkerFilter("all");
              setJobFilter("all");
              syncFilters({ status: "all", q: "", city: "all", worker: "all", job: "all" });
            }}
            style={{ fontSize: "12px", fontWeight: 700, color: "var(--brand)", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
          >
            limpiar rápido
          </button>
        </div>
      )}

      <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={320}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1, 2, 3, 4].map((i) => <div key={i} style={{ height: "72px", borderRadius: "10px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <Inbox size={32} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--muted)" }}>
              {items.length === 0 ? "Sin viajes operativos" : "Sin viajes en este filtro"}
            </p>
            <p style={{ fontSize: "12px", color: "var(--faint)", marginTop: "4px" }}>Los viajes creados por workers aparecerán aquí para seguimiento.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "18px" }}>
            {pendingItems.length > 0 && (
              <section style={{ display: "grid", gap: "8px" }}>
                <button onClick={() => {
                  const next = !showPending;
                  setShowPending(next);
                  syncFilters({ grpPending: next });
                }} aria-expanded={showPending} style={{ display: "grid", gap: "4px", background: "transparent", border: "none", padding: 0, cursor: "pointer", width: "fit-content", textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Clock3 size={14} color="#d97706" />
                    <h3 style={{ fontSize: "13px", fontWeight: 800, color: "var(--ink)" }}>Pendientes de liquidación</h3>
                    <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 6px", borderRadius: "999px", background: "rgba(217,119,6,.12)", color: "#b45309" }}>
                      {pendingItems.length}
                    </span>
                    <ChevronDown size={13} color="var(--muted)" style={{ transform: showPending ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .15s ease" }} />
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>{showPending ? "Ocultar" : "Mostrar"}</span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                    presupuesto {pendingSummary.budget.toLocaleString()} · gasto {pendingSummary.spent.toLocaleString()} · soportes faltantes {pendingSummary.missing} · listos para cerrar {readyToCloseCount}
                  </span>
                </button>
                {showPending && pendingItems.map(renderTravelRow)}
              </section>
            )}
            {riskItems.length > 0 && (
              <section style={{ display: "grid", gap: "8px" }}>
                <button onClick={() => {
                  const next = !showRisk;
                  setShowRisk(next);
                  syncFilters({ grpRisk: next });
                }} aria-expanded={showRisk} style={{ display: "grid", gap: "4px", background: "transparent", border: "none", padding: 0, cursor: "pointer", width: "fit-content", textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <AlertTriangle size={14} color="#ef4444" />
                    <h3 style={{ fontSize: "13px", fontWeight: 800, color: "var(--ink)" }}>Con riesgo operativo</h3>
                    <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 6px", borderRadius: "999px", background: "rgba(239,68,68,.12)", color: "#b91c1c" }}>
                      {riskItems.length}
                    </span>
                    <ChevronDown size={13} color="var(--muted)" style={{ transform: showRisk ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .15s ease" }} />
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>{showRisk ? "Ocultar" : "Mostrar"}</span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                    presupuesto {riskSummary.budget.toLocaleString()} · gasto {riskSummary.spent.toLocaleString()} · soportes faltantes {riskSummary.missing}
                  </span>
                </button>
                {showRisk && riskItems.map(renderTravelRow)}
              </section>
            )}
            {okItems.length > 0 && (
              <section style={{ display: "grid", gap: "8px" }}>
                <button onClick={() => {
                  const next = !showOk;
                  setShowOk(next);
                  syncFilters({ grpOk: next });
                }} aria-expanded={showOk} style={{ display: "grid", gap: "4px", background: "transparent", border: "none", padding: 0, cursor: "pointer", width: "fit-content", textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <PlaneTakeoff size={14} color="#10b981" />
                    <h3 style={{ fontSize: "13px", fontWeight: 800, color: "var(--ink)" }}>Operación estable</h3>
                    <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 6px", borderRadius: "999px", background: "rgba(16,185,129,.12)", color: "#047857" }}>
                      {okItems.length}
                    </span>
                    <ChevronDown size={13} color="var(--muted)" style={{ transform: showOk ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .15s ease" }} />
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>{showOk ? "Ocultar" : "Mostrar"}</span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                    presupuesto {okSummary.budget.toLocaleString()} · gasto {okSummary.spent.toLocaleString()} · soportes faltantes {okSummary.missing}
                  </span>
                </button>
                {showOk && okItems.map(renderTravelRow)}
              </section>
            )}
          </div>
        )}
      </HtmlInCanvasPanel>
    </div>
  );
}
