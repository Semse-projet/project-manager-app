"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, RefreshCw, MapPin, Calendar, DollarSign, Building2,
  Utensils, Truck, Wallet, CheckCircle2, AlertTriangle, Plus, X, Search,
} from "lucide-react";
import { HtmlInCanvasPanel, StatCard, StatusBadge } from "@semse/ui";
import {
  fetchTravelAssignment,
  fetchTravelExpenses,
  fetchTravelLodging,
  fetchTravelAdvances,
  fetchTravelSettlement,
  createTravelExpense,
  createTravelLodging,
  createTravelAdvance,
  closeTravelSettlement,
  updateTravelAssignmentStatus,
  searchTravelLodgingOptions,
  fetchTravelPlaceDetail,
  geocodeTravelAddress,
  planUpload,
  type TravelPlaceSearchItem,
} from "../../../../semse-api";
import { NotificationBanner } from "../../../../components/notifications/NotificationBanner";

type Tab = "resumen" | "hospedaje" | "gastos" | "anticipos" | "liquidacion";

type TravelStatus = "DRAFT" | "PLANNED" | "ACTIVE" | "PENDING_SETTLEMENT" | "CLOSED" | "CANCELLED";

const STATUS_VARIANT: Record<TravelStatus, "success" | "warning" | "info" | "neutral" | "error"> = {
  DRAFT: "neutral", PLANNED: "info", ACTIVE: "success",
  PENDING_SETTLEMENT: "warning", CLOSED: "neutral", CANCELLED: "error",
};
const STATUS_LABEL: Record<TravelStatus, string> = {
  DRAFT: "Borrador", PLANNED: "Planificado", ACTIVE: "Activo",
  PENDING_SETTLEMENT: "Por liquidar", CLOSED: "Cerrado", CANCELLED: "Cancelado",
};
const CATEGORY_LABEL: Record<string, string> = {
  meal: "Alimentos", transport: "Transporte", other: "Otro",
};

function fmt(v: unknown): string {
  if (v == null) return "—";
  return String(v);
}
function fmtMXN(v: unknown): string {
  const n = Number(v);
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}
function fmtDate(v: unknown): string {
  if (!v) return "—";
  try { return new Date(String(v)).toLocaleDateString("es-MX"); } catch { return String(v); }
}

// ─── Sub-forms ────────────────────────────────────────────────────────────────

interface ExpenseFormData {
  category: string; description: string; amount: string;
  expenseDate: string; vendor: string; origin: string; destination: string;
  receiptUrl: string;
}

interface LodgingFormData {
  name: string; type: string; address: string; checkIn: string; checkOut: string;
  placeId: string; googleMapsUri: string; latitude: string; longitude: string;
  costPerNight: string; confirmationCode: string; paidBy: string;
  receiptUrl: string;
}

interface AdvanceFormData {
  amount: string; method: string; purpose: string; approvedBy: string;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TravelDetailPage() {
  const params = useParams();
  const travelId = String(params?.travelId ?? "");

  const [activeTab, setActiveTab] = useState<Tab>("resumen");
  const [travel, setTravel] = useState<Record<string, unknown> | null>(null);
  const [expenses, setExpenses] = useState<Record<string, unknown>[]>([]);
  const [lodging, setLodging] = useState<Record<string, unknown>[]>([]);
  const [advances, setAdvances] = useState<Record<string, unknown>[]>([]);
  const [settlement, setSettlement] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showLodgingForm, setShowLodgingForm] = useState(false);
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeNotes, setCloseNotes] = useState("");
  const [receiptUploading, setReceiptUploading] = useState<"expense" | "lodging" | null>(null);
  const [mapsConfigured, setMapsConfigured] = useState<boolean | null>(null);
  const [lodgingSearchQuery, setLodgingSearchQuery] = useState("hotel");
  const [lodgingSearchLoading, setLodgingSearchLoading] = useState(false);
  const [lodgingSearchError, setLodgingSearchError] = useState<string | null>(null);
  const [lodgingSearchItems, setLodgingSearchItems] = useState<TravelPlaceSearchItem[]>([]);
  const [addressValidating, setAddressValidating] = useState(false);

  const expenseReceiptInputRef = useRef<HTMLInputElement | null>(null);
  const lodgingReceiptInputRef = useRef<HTMLInputElement | null>(null);

  const [expenseForm, setExpenseForm] = useState<ExpenseFormData>({
    category: "meal", description: "", amount: "", expenseDate: "", vendor: "", origin: "", destination: "", receiptUrl: "",
  });
  const [lodgingForm, setLodgingForm] = useState<LodgingFormData>({
    name: "", type: "hotel", address: "", checkIn: "", checkOut: "",
    placeId: "", googleMapsUri: "", latitude: "", longitude: "",
    costPerNight: "", confirmationCode: "", paidBy: "worker", receiptUrl: "",
  });
  const [advanceForm, setAdvanceForm] = useState<AdvanceFormData>({
    amount: "", method: "cash", purpose: "", approvedBy: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, exp, lodg, adv, sett] = await Promise.all([
        fetchTravelAssignment(travelId),
        fetchTravelExpenses(travelId).catch(() => []),
        fetchTravelLodging(travelId).catch(() => []),
        fetchTravelAdvances(travelId).catch(() => []),
        fetchTravelSettlement(travelId).catch(() => null),
      ]);
      setTravel(t);
      setExpenses(exp);
      setLodging(lodg);
      setAdvances(adv);
      setSettlement(sett);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar viaje");
    } finally {
      setLoading(false);
    }
  }, [travelId]);

  useEffect(() => { void load(); }, [load]);

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createTravelExpense(travelId, {
        category: expenseForm.category,
        description: expenseForm.description || undefined,
        amount: parseFloat(expenseForm.amount),
        expenseDate: expenseForm.expenseDate,
        vendor: expenseForm.vendor || undefined,
        origin: expenseForm.category === "transport" ? expenseForm.origin : undefined,
        destination: expenseForm.category === "transport" ? expenseForm.destination : undefined,
        receiptUrl: expenseForm.receiptUrl || undefined,
      });
      setShowExpenseForm(false);
      setExpenseForm({ category: "meal", description: "", amount: "", expenseDate: "", vendor: "", origin: "", destination: "", receiptUrl: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar gasto");
    } finally {
      setBusy(false);
    }
  };

  const handleLodgingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createTravelLodging(travelId, {
        name: lodgingForm.name,
        type: lodgingForm.type || undefined,
        address: lodgingForm.address || undefined,
        placeId: lodgingForm.placeId || undefined,
        googleMapsUri: lodgingForm.googleMapsUri || undefined,
        latitude: lodgingForm.latitude ? parseFloat(lodgingForm.latitude) : undefined,
        longitude: lodgingForm.longitude ? parseFloat(lodgingForm.longitude) : undefined,
        checkIn: lodgingForm.checkIn,
        checkOut: lodgingForm.checkOut,
        costPerNight: lodgingForm.costPerNight ? parseFloat(lodgingForm.costPerNight) : undefined,
        confirmationCode: lodgingForm.confirmationCode || undefined,
        paidBy: lodgingForm.paidBy || undefined,
        receiptUrl: lodgingForm.receiptUrl || undefined,
      });
      setShowLodgingForm(false);
      setLodgingForm({
        name: "", type: "hotel", address: "", checkIn: "", checkOut: "",
        placeId: "", googleMapsUri: "", latitude: "", longitude: "",
        costPerNight: "", confirmationCode: "", paidBy: "worker", receiptUrl: "",
      });
      setLodgingSearchItems([]);
      setLodgingSearchError(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar hospedaje");
    } finally {
      setBusy(false);
    }
  };

  const handleAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createTravelAdvance(travelId, {
        amount: parseFloat(advanceForm.amount),
        method: advanceForm.method || undefined,
        purpose: advanceForm.purpose || undefined,
        approvedBy: advanceForm.approvedBy || undefined,
      });
      setShowAdvanceForm(false);
      setAdvanceForm({ amount: "", method: "cash", purpose: "", approvedBy: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar anticipo");
    } finally {
      setBusy(false);
    }
  };

  const handleActivate = async () => {
    setBusy(true);
    try { await updateTravelAssignmentStatus(travelId, "ACTIVE"); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error al activar"); }
    finally { setBusy(false); }
  };

  const handleMarkPending = async () => {
    setBusy(true);
    try { await updateTravelAssignmentStatus(travelId, "PENDING_SETTLEMENT"); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setBusy(false); }
  };

  const handleClose = async () => {
    if (missingReceipts > 0) {
      setError("No se puede cerrar la liquidación mientras falten comprobantes.");
      return;
    }
    setBusy(true);
    try {
      await closeTravelSettlement(travelId, closeNotes || undefined);
      setShowCloseModal(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cerrar liquidación");
    } finally {
      setBusy(false);
    }
  };

  const prepareReceiptUpload = useCallback(async (file: File) => {
    const contentType = file.type || "application/octet-stream";
    const planned = await planUpload({
      domain: "travel",
      filename: file.name,
      contentType,
      fileSizeBytes: file.size,
      source: "field_ops",
    });

    const strategy = String(planned.recommendedStrategy ?? "single_put");
    const key = typeof planned.key === "string" ? planned.key : "";
    if (!key) {
      throw new Error(`No se pudo preparar el almacenamiento para "${file.name}".`);
    }

    if (strategy === "external_transfer") {
      // Files over the single-PUT limit (~25MB) don't have a working upload
      // path yet — fail clearly instead of returning a URL that was never PUT.
      throw new Error(`"${file.name}" es demasiado grande para subir aquí todavía (límite temporal ~25MB). Usa un archivo más pequeño o divídelo.`);
    }

    const uploadRes = await fetch(`/api/semse/uploads/files/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "content-type": contentType, "content-length": String(file.size) },
      body: file,
    });
    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => "");
      throw new Error(`No se pudo subir "${file.name}" (${uploadRes.status}).${text ? ` ${text}` : ""}`);
    }

    // receiptUrl must be a real, absolute, browser-fetchable URL (the backend
    // validates it with z.string().url() and the UI renders it as <a href>).
    // GET on this proxy is intentionally public (tenant-scoped random keys),
    // so this link works when opened directly, no auth header needed.
    return `${window.location.origin}/api/semse/uploads/files/${encodeURIComponent(key)}`;
  }, []);

  const handleReceiptFile = useCallback(async (kind: "expense" | "lodging", file?: File | null) => {
    if (!file) return;
    setReceiptUploading(kind);
    setError(null);
    try {
      const url = await prepareReceiptUpload(file);
      if (kind === "expense") {
        setExpenseForm((current) => ({ ...current, receiptUrl: url }));
      } else {
        setLodgingForm((current) => ({ ...current, receiptUrl: url }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo preparar el comprobante.");
    } finally {
      setReceiptUploading(null);
    }
  }, [prepareReceiptUpload]);

  const handleSearchLodging = useCallback(async () => {
    setLodgingSearchLoading(true);
    setLodgingSearchError(null);
    try {
      const response = await searchTravelLodgingOptions({
        query: lodgingSearchQuery,
        city: String(travel?.destinationCity ?? ""),
        pageSize: 6,
      });
      setMapsConfigured(response.configured);
      setLodgingSearchItems(response.items);
      if (!response.configured) {
        setLodgingSearchError("Google Maps no está configurado en servidor.");
      } else if (response.items.length === 0) {
        setLodgingSearchError("No encontré opciones con esa búsqueda.");
      }
    } catch (e) {
      setLodgingSearchError(e instanceof Error ? e.message : "No se pudo consultar Google Maps.");
    } finally {
      setLodgingSearchLoading(false);
    }
  }, [lodgingSearchQuery, travel?.destinationCity]);

  const applyPlaceToLodgingForm = useCallback(async (item: TravelPlaceSearchItem) => {
    setLodgingSearchError(null);
    try {
      const response = await fetchTravelPlaceDetail(item.id);
      setMapsConfigured(response.configured);
      const detail = response.item;
      setLodgingForm((current) => ({
        ...current,
        name: detail?.displayName || item.displayName || current.name,
        address: detail?.formattedAddress || item.formattedAddress || current.address,
        placeId: detail?.id || item.id || current.placeId,
        googleMapsUri: detail?.googleMapsUri || item.googleMapsUri || current.googleMapsUri,
        latitude: typeof (detail?.latitude ?? item.latitude) === "number"
          ? String(detail?.latitude ?? item.latitude)
          : current.latitude,
        longitude: typeof (detail?.longitude ?? item.longitude) === "number"
          ? String(detail?.longitude ?? item.longitude)
          : current.longitude,
      }));
    } catch (e) {
      setLodgingSearchError(e instanceof Error ? e.message : "No se pudo cargar el detalle del hospedaje.");
    }
  }, []);

  const handleValidateLodgingAddress = useCallback(async () => {
    const address = lodgingForm.address.trim();
    if (!address) return;
    setAddressValidating(true);
    setLodgingSearchError(null);
    try {
      const response = await geocodeTravelAddress(address);
      setMapsConfigured(response.configured);
      if (!response.configured) {
        setLodgingSearchError("Google Maps no está configurado en servidor.");
        return;
      }
      if (!response.item) {
        setLodgingSearchError("No pude validar esa dirección.");
        return;
      }
      setLodgingForm((current) => ({
        ...current,
        address: response.item?.formattedAddress || current.address,
        placeId: response.item?.placeId || current.placeId,
        latitude: typeof response.item?.latitude === "number" ? String(response.item.latitude) : current.latitude,
        longitude: typeof response.item?.longitude === "number" ? String(response.item.longitude) : current.longitude,
        googleMapsUri: response.item?.placeId
          ? `https://www.google.com/maps/place/?q=place_id:${response.item.placeId}`
          : current.googleMapsUri,
      }));
    } catch (e) {
      setLodgingSearchError(e instanceof Error ? e.message : "No se pudo validar la dirección.");
    } finally {
      setAddressValidating(false);
    }
  }, [lodgingForm.address]);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">Cargando viaje...</div>
    );
  }

  if (!travel) {
    return (
      <div className="p-8 text-center text-red-500">{error ?? "Viaje no encontrado"}</div>
    );
  }

  const status = String(travel.status ?? "DRAFT") as TravelStatus;
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalLodging = lodging.reduce((s, l) => {
    const estimated = Number(l.estimatedTotal);
    const perNight = Number(l.costPerNight);
    return s + (Number.isFinite(estimated) ? estimated : Number.isFinite(perNight) ? perNight : 0);
  }, 0);
  const totalAdvances = advances.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const totalSpent = totalExpenses + totalLodging;
  const balance = totalAdvances - totalSpent;
  const approvedBudget = Number(travel.approvedBudget);
  const hasBudget = Number.isFinite(approvedBudget) && approvedBudget > 0;
  const budgetRemaining = hasBudget ? approvedBudget - totalSpent : null;
  const isOverBudget = hasBudget && totalSpent > approvedBudget;
  const isNearBudgetLimit = hasBudget && totalSpent >= approvedBudget * 0.9 && totalSpent <= approvedBudget;
  const missingExpenseReceipts = expenses.filter((expense) => !String(expense.receiptUrl ?? "").trim()).length;
  const missingLodgingReceipts = lodging.filter((item) => !String(item.receiptUrl ?? "").trim()).length;
  const missingReceipts = missingExpenseReceipts + missingLodgingReceipts;
  const readyToClose = status === "PENDING_SETTLEMENT" && missingReceipts === 0;
  const expenseCount = expenses.length;
  const lodgingCount = lodging.length;
  const advanceCount = advances.length;
  const blockedPendingReason =
    expenseCount === 0 && lodgingCount === 0 && advanceCount === 0
      ? "sin base operativa"
      : Boolean(travel.requiresLodging) && lodgingCount === 0
        ? "hospedaje requerido pendiente"
        : null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "resumen",     label: "Resumen",     icon: <MapPin size={14} /> },
    { id: "hospedaje",   label: "Hospedaje",   icon: <Building2 size={14} /> },
    { id: "gastos",      label: "Gastos",      icon: <Utensils size={14} /> },
    { id: "anticipos",   label: "Anticipos",   icon: <Wallet size={14} /> },
    { id: "liquidacion", label: "Liquidación", icon: <CheckCircle2 size={14} /> },
  ];

  return (
    <HtmlInCanvasPanel>
      <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
        <NotificationBanner audience="worker" />

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/worker/travel" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-gray-900 truncate">
              {fmt(travel.destinationCity)}
            </h1>
            <p className="text-sm text-gray-500">{fmt(travel.jobTitle ?? travel.jobId)}</p>
          </div>
          <StatusBadge
            text={STATUS_LABEL[status] ?? status}
            variant={STATUS_VARIANT[status] ?? "neutral"}
          />
          <button onClick={() => void load()} disabled={busy} className="text-gray-400 hover:text-gray-600">
            <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertTriangle size={14} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Gastos"
            value={fmtMXN(totalExpenses)}
            icon={Utensils}
            color="blue"
          />
          <StatCard
            label="Hospedaje"
            value={fmtMXN(totalLodging)}
            icon={Building2}
            color="violet"
          />
          <StatCard
            label="Anticipos"
            value={fmtMXN(totalAdvances)}
            icon={Wallet}
            color="green"
          />
          <StatCard
            label="Balance"
            value={fmtMXN(balance)}
            icon={DollarSign}
            color={balance >= 0 ? "green" : "red"}
          />
        </div>

        {(hasBudget || missingReceipts > 0) && (
          <div className="grid gap-3 md:grid-cols-2">
            {hasBudget && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${isOverBudget ? "border-red-200 bg-red-50 text-red-700" : isNearBudgetLimit ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                <p className="font-semibold">Control de presupuesto</p>
                <p>
                  {isOverBudget
                    ? `Viaje excedido por ${fmtMXN(Math.abs(budgetRemaining ?? 0))}.`
                    : `Disponible ${fmtMXN(budgetRemaining ?? 0)} del presupuesto aprobado.`}
                </p>
              </div>
            )}
            {missingReceipts > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <p className="font-semibold">Comprobantes pendientes</p>
                <p>{missingReceipts} registro{missingReceipts > 1 ? "s" : ""} sin comprobante antes de liquidar.</p>
                <p className="mt-1 text-xs">
                  {missingExpenseReceipts > 0 ? `${missingExpenseReceipts} gasto${missingExpenseReceipts > 1 ? "s" : ""}` : ""}
                  {missingExpenseReceipts > 0 && missingLodgingReceipts > 0 ? " · " : ""}
                  {missingLodgingReceipts > 0 ? `${missingLodgingReceipts} hospedaje${missingLodgingReceipts > 1 ? "s" : ""}` : ""}
                </p>
              </div>
            )}
          </div>
        )}

        {status === "ACTIVE" && blockedPendingReason && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <p className="font-semibold">Bloqueo para pasar a liquidación</p>
            <p>
              Motivo: {blockedPendingReason}. Estado actual: gastos {expenseCount}, hospedaje {lodgingCount}, anticipos {advanceCount}.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isOverBudget ? "bg-red-100 text-red-700" : missingReceipts > 0 ? "bg-amber-100 text-amber-700" : readyToClose ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
            {isOverBudget ? "crítico" : missingReceipts > 0 ? "faltan soportes" : readyToClose ? "listo para cerrar" : "estable"}
          </span>
          {missingExpenseReceipts > 0 && (
            <button onClick={() => setActiveTab("gastos")} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              {missingExpenseReceipts} gasto{missingExpenseReceipts > 1 ? "s" : ""} sin soporte
            </button>
          )}
          {missingLodgingReceipts > 0 && (
            <button onClick={() => setActiveTab("hospedaje")} className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
              {missingLodgingReceipts} hospedaje{missingLodgingReceipts > 1 ? "s" : ""} sin soporte
            </button>
          )}
        </div>

        {/* Status actions */}
        <div className="flex flex-wrap gap-2">
          {status === "PLANNED" && (
            <button
              onClick={handleActivate}
              disabled={busy}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Activar viaje
            </button>
          )}
          {status === "ACTIVE" && (
            <button
              onClick={handleMarkPending}
              disabled={busy || Boolean(blockedPendingReason)}
              className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Marcar para liquidar
            </button>
          )}
          {status === "ACTIVE" && blockedPendingReason && (
            <span className="self-center text-xs font-semibold text-amber-700">bloqueado por {blockedPendingReason}</span>
          )}
          {status === "PENDING_SETTLEMENT" && (
            <button
              onClick={() => setShowCloseModal(true)}
              disabled={busy || missingReceipts > 0}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cerrar liquidación
            </button>
          )}
          {status === "PENDING_SETTLEMENT" && missingReceipts > 0 && (
            <span className="self-center text-xs font-semibold text-amber-700">bloqueado por soportes faltantes</span>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === t.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <button onClick={() => setActiveTab("resumen")} className={`rounded-lg border px-3 py-2 text-left text-xs ${activeTab === "resumen" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600"}`}>
            Resumen general
          </button>
          <button onClick={() => setActiveTab("hospedaje")} className={`rounded-lg border px-3 py-2 text-left text-xs ${activeTab === "hospedaje" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600"}`}>
            Hospedaje: {lodging.length}
          </button>
          <button onClick={() => setActiveTab("gastos")} className={`rounded-lg border px-3 py-2 text-left text-xs ${activeTab === "gastos" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600"}`}>
            Gastos: {expenses.length}
          </button>
          <button onClick={() => setActiveTab("anticipos")} className={`rounded-lg border px-3 py-2 text-left text-xs ${activeTab === "anticipos" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600"}`}>
            Anticipos: {advances.length}
          </button>
          <button onClick={() => setActiveTab("liquidacion")} className={`rounded-lg border px-3 py-2 text-left text-xs ${activeTab === "liquidacion" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600"}`}>
            Liquidación
          </button>
        </div>

        {/* Tab content */}
        <div className="min-h-[300px]">

          {/* RESUMEN */}
          {activeTab === "resumen" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                  <h3 className="font-medium text-gray-800">Detalles del viaje</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Destino</dt>
                      <dd className="font-medium">{fmt(travel.destinationCity)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Salida</dt>
                      <dd>{fmtDate(travel.departureDate)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Regreso</dt>
                      <dd>{fmtDate(travel.returnDate)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Días estimados</dt>
                      <dd>{fmt(travel.estimatedDays)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Transporte</dt>
                      <dd className="capitalize">{fmt(travel.mainTransportMode)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Requiere hospedaje</dt>
                      <dd>{travel.requiresLodging ? "Sí" : "No"}</dd>
                    </div>
                  </dl>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                  <h3 className="font-medium text-gray-800">Presupuesto</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Presupuesto aprobado</dt>
                      <dd className="font-medium">{fmtMXN(travel.approvedBudget)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Gasto total</dt>
                      <dd>{fmtMXN(totalSpent)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Anticipos entregados</dt>
                      <dd>{fmtMXN(totalAdvances)}</dd>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <dt className="text-gray-700 font-medium">Balance</dt>
                      <dd className={`font-semibold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {fmtMXN(balance)}
                      </dd>
                    </div>
                  </dl>
                  {Boolean(travel.notes) && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-gray-500 mb-1">Notas</p>
                      <p className="text-sm text-gray-700">{fmt(travel.notes)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* HOSPEDAJE */}
          {activeTab === "hospedaje" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-800">Registros de hospedaje</h3>
                {!["CLOSED", "CANCELLED"].includes(status) && (
                  <button
                    onClick={() => setShowLodgingForm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                  >
                    <Plus size={14} /> Agregar
                  </button>
                )}
              </div>

              {showLodgingForm && (
                <form onSubmit={handleLodgingSubmit} className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-medium text-blue-800">Nuevo hospedaje</h4>
                  <div className="rounded-xl border border-blue-200 bg-white p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Buscar hospedaje con Google Maps</p>
                        <p className="text-xs text-gray-500">
                          Busca hotel, hostal o alojamiento en {fmt(travel.destinationCity)} y llena dirección, maps y coordenadas.
                        </p>
                      </div>
                      {mapsConfigured === false && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-1">
                          Google Maps no configurado
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={lodgingSearchQuery}
                        onChange={(e) => setLodgingSearchQuery(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        placeholder={`hotel en ${fmt(travel.destinationCity)}`}
                      />
                      <button
                        type="button"
                        onClick={() => void handleSearchLodging()}
                        disabled={busy || lodgingSearchLoading}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        <Search size={14} />
                        {lodgingSearchLoading ? "Buscando..." : "Buscar"}
                      </button>
                    </div>
                    {lodgingSearchError && <p className="text-xs text-amber-700">{lodgingSearchError}</p>}
                    {lodgingSearchItems.length > 0 && (
                      <div className="space-y-2">
                        {lodgingSearchItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => void applyPlaceToLodgingForm(item)}
                            className="w-full text-left rounded-lg border border-blue-100 bg-blue-50 hover:bg-blue-100 px-3 py-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{item.displayName}</p>
                                <p className="text-xs text-gray-600">{item.formattedAddress}</p>
                              </div>
                              <div className="text-right text-xs text-gray-500">
                                {typeof item.rating === "number" ? <p>{item.rating.toFixed(1)}★</p> : null}
                                {typeof item.userRatingCount === "number" ? <p>{item.userRatingCount} reseñas</p> : null}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Nombre del hotel / lugar *</label>
                      <input required value={lodgingForm.name} onChange={(e) => setLodgingForm(p => ({ ...p, name: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Hotel Ejemplo" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Tipo</label>
                      <select value={lodgingForm.type} onChange={(e) => setLodgingForm(p => ({ ...p, type: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        <option value="hotel">Hotel</option>
                        <option value="airbnb">Airbnb</option>
                        <option value="hostel">Hostel</option>
                        <option value="company_house">Casa empresa</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Check-in *</label>
                      <input required type="date" value={lodgingForm.checkIn} onChange={(e) => setLodgingForm(p => ({ ...p, checkIn: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Check-out *</label>
                      <input required type="date" value={lodgingForm.checkOut} onChange={(e) => setLodgingForm(p => ({ ...p, checkOut: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Costo por noche (MXN)</label>
                      <input type="number" min="0" step="0.01" value={lodgingForm.costPerNight} onChange={(e) => setLodgingForm(p => ({ ...p, costPerNight: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Pagado por</label>
                      <select value={lodgingForm.paidBy} onChange={(e) => setLodgingForm(p => ({ ...p, paidBy: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        <option value="worker">Trabajador</option>
                        <option value="company">Empresa</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Dirección</label>
                      <input value={lodgingForm.address} onChange={(e) => setLodgingForm(p => ({ ...p, address: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                      <div className="mt-2 flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => void handleValidateLodgingAddress()}
                          disabled={busy || addressValidating || !lodgingForm.address.trim()}
                          className="px-3 py-1.5 bg-white border border-gray-300 text-xs rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                          {addressValidating ? "Validando..." : "Validar dirección"}
                        </button>
                        {lodgingForm.googleMapsUri && (
                          <a
                            href={lodgingForm.googleMapsUri}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-white border border-gray-300 text-xs rounded-lg hover:bg-gray-50 text-blue-600"
                          >
                            Abrir en Maps
                          </a>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Código de confirmación</label>
                      <input value={lodgingForm.confirmationCode} onChange={(e) => setLodgingForm(p => ({ ...p, confirmationCode: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">URL comprobante</label>
                      <input value={lodgingForm.receiptUrl} onChange={(e) => setLodgingForm(p => ({ ...p, receiptUrl: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
                    </div>
                  </div>
                  <input
                    ref={lodgingReceiptInputRef}
                    type="file"
                    accept="image/*,.pdf,.jpg,.jpeg,.png,.webp"
                    hidden
                    onChange={(e) => void handleReceiptFile("lodging", e.target.files?.[0])}
                  />
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => lodgingReceiptInputRef.current?.click()} disabled={busy || receiptUploading === "lodging"} className="px-4 py-2 bg-white border border-gray-300 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">
                      {receiptUploading === "lodging" ? "Preparando comprobante..." : "Cargar comprobante"}
                    </button>
                    <button type="submit" disabled={busy} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {busy ? "Guardando..." : "Guardar"}
                    </button>
                    <button type="button" onClick={() => setShowLodgingForm(false)} className="px-4 py-2 bg-white border border-gray-300 text-sm rounded-lg hover:bg-gray-50">
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {lodging.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Building2 size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Sin registros de hospedaje</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lodging.map((l) => (
                    <div key={String(l.id)} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{fmt(l.name)}</p>
                          <p className="text-xs text-gray-500 capitalize">{fmt(l.type)} · {fmt(l.address)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{fmtMXN(l.estimatedTotal ?? l.costPerNight)}</p>
                          <p className="text-xs text-gray-500">Pagado por: {fmt(l.paidBy)}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-4 text-xs text-gray-500">
                        <span>Check-in: {fmtDate(l.checkIn)}</span>
                        <span>Check-out: {fmtDate(l.checkOut)}</span>
                        {Boolean(l.confirmationCode) && <span>Conf: {fmt(l.confirmationCode)}</span>}
                        {Boolean(l.googleMapsUri) && (
                          <a href={String(l.googleMapsUri)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                            Abrir en Maps
                          </a>
                        )}
                        {Boolean(l.receiptUrl) && (
                          <a href={String(l.receiptUrl)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                            Ver comprobante
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* GASTOS */}
          {activeTab === "gastos" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-800">Gastos ({expenses.length})</h3>
                {!["CLOSED", "CANCELLED"].includes(status) && (
                  <button
                    onClick={() => setShowExpenseForm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                  >
                    <Plus size={14} /> Agregar
                  </button>
                )}
              </div>

              {showExpenseForm && (
                <form onSubmit={handleExpenseSubmit} className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-medium text-green-800">Nuevo gasto</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Categoría *</label>
                      <select required value={expenseForm.category} onChange={(e) => setExpenseForm(p => ({ ...p, category: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        <option value="meal">Alimentos</option>
                        <option value="transport">Transporte</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Monto (MXN) *</label>
                      <input required type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Fecha del gasto *</label>
                      <input required type="date" value={expenseForm.expenseDate} onChange={(e) => setExpenseForm(p => ({ ...p, expenseDate: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Proveedor / Establecimiento</label>
                      <input value={expenseForm.vendor} onChange={(e) => setExpenseForm(p => ({ ...p, vendor: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Ej. Taquería El Sol" />
                    </div>
                    {expenseForm.category === "transport" && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Origen</label>
                          <input value={expenseForm.origin} onChange={(e) => setExpenseForm(p => ({ ...p, origin: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Destino</label>
                          <input value={expenseForm.destination} onChange={(e) => setExpenseForm(p => ({ ...p, destination: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                      </>
                    )}
                    <div className="md:col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">Descripción</label>
                      <input value={expenseForm.description} onChange={(e) => setExpenseForm(p => ({ ...p, description: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">URL comprobante</label>
                      <input value={expenseForm.receiptUrl} onChange={(e) => setExpenseForm(p => ({ ...p, receiptUrl: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
                    </div>
                  </div>
                  <input
                    ref={expenseReceiptInputRef}
                    type="file"
                    accept="image/*,.pdf,.jpg,.jpeg,.png,.webp"
                    hidden
                    onChange={(e) => void handleReceiptFile("expense", e.target.files?.[0])}
                  />
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => expenseReceiptInputRef.current?.click()} disabled={busy || receiptUploading === "expense"} className="px-4 py-2 bg-white border border-gray-300 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">
                      {receiptUploading === "expense" ? "Preparando comprobante..." : "Cargar comprobante"}
                    </button>
                    <button type="submit" disabled={busy} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                      {busy ? "Guardando..." : "Guardar"}
                    </button>
                    <button type="button" onClick={() => setShowExpenseForm(false)} className="px-4 py-2 bg-white border border-gray-300 text-sm rounded-lg hover:bg-gray-50">
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {expenses.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Utensils size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Sin gastos registrados</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {expenses.map((exp) => (
                    <div key={String(exp.id)} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {CATEGORY_LABEL[String(exp.category)] ?? fmt(exp.category)}
                          {exp.subcategory ? ` · ${fmt(exp.subcategory)}` : ""}
                        </p>
                        <p className="text-xs text-gray-500">
                          {fmtDate(exp.expenseDate)}
                          {exp.vendor ? ` · ${fmt(exp.vendor)}` : ""}
                          {exp.description ? ` · ${fmt(exp.description)}` : ""}
                        </p>
                        {Boolean(exp.origin) && Boolean(exp.destination) && (
                          <p className="text-xs text-gray-400">{fmt(exp.origin)} → {fmt(exp.destination)}</p>
                        )}
                        {Boolean(exp.receiptUrl) && (
                          <a href={String(exp.receiptUrl)} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                            Ver comprobante
                          </a>
                        )}
                      </div>
                      <p className="font-semibold text-gray-900 ml-4 shrink-0">{fmtMXN(exp.amount)}</p>
                    </div>
                  ))}
                  <div className="flex justify-end pt-1">
                    <p className="text-sm font-semibold text-gray-800">Total: {fmtMXN(totalExpenses)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ANTICIPOS */}
          {activeTab === "anticipos" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-800">Anticipos ({advances.length})</h3>
                {!["CLOSED", "CANCELLED"].includes(status) && (
                  <button
                    onClick={() => setShowAdvanceForm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                  >
                    <Plus size={14} /> Registrar anticipo
                  </button>
                )}
              </div>

              {showAdvanceForm && (
                <form onSubmit={handleAdvanceSubmit} className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-medium text-purple-800">Nuevo anticipo</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Monto (MXN) *</label>
                      <input required type="number" min="0" step="0.01" value={advanceForm.amount} onChange={(e) => setAdvanceForm(p => ({ ...p, amount: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Método</label>
                      <select value={advanceForm.method} onChange={(e) => setAdvanceForm(p => ({ ...p, method: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        <option value="cash">Efectivo</option>
                        <option value="transfer">Transferencia</option>
                        <option value="card">Tarjeta</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Propósito</label>
                      <input value={advanceForm.purpose} onChange={(e) => setAdvanceForm(p => ({ ...p, purpose: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Gastos de viaje" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Aprobado por</label>
                      <input value={advanceForm.approvedBy} onChange={(e) => setAdvanceForm(p => ({ ...p, approvedBy: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={busy} className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50">
                      {busy ? "Guardando..." : "Guardar"}
                    </button>
                    <button type="button" onClick={() => setShowAdvanceForm(false)} className="px-4 py-2 bg-white border border-gray-300 text-sm rounded-lg hover:bg-gray-50">
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {advances.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Wallet size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Sin anticipos registrados</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {advances.map((a) => (
                    <div key={String(a.id)} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 capitalize">{fmt(a.method)} · {fmt(a.purpose)}</p>
                        <p className="text-xs text-gray-500">
                          {fmtDate(a.issuedAt ?? a.createdAt)}
                          {a.approvedBy ? ` · Aprobó: ${fmt(a.approvedBy)}` : ""}
                        </p>
                      </div>
                      <p className="font-semibold text-gray-900 ml-4 shrink-0">{fmtMXN(a.amount)}</p>
                    </div>
                  ))}
                  <div className="flex justify-end pt-1">
                    <p className="text-sm font-semibold text-gray-800">Total anticipado: {fmtMXN(totalAdvances)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LIQUIDACIÓN */}
          {activeTab === "liquidacion" && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-800">Liquidación</h3>

              {settlement ? (
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">Estado</p>
                    <StatusBadge
                      text={String(settlement.status ?? "DRAFT")}
                      variant={String(settlement.status ?? "DRAFT").toUpperCase() === "CLOSED" ? "success" : "warning"}
                    />
                  </div>
                  <dl className="divide-y divide-gray-100 text-sm">
                    <div className="flex justify-between py-2">
                      <dt className="text-gray-500">Subtotal alimentos</dt>
                      <dd>{fmtMXN(settlement.totalMeals)}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-gray-500">Subtotal transporte</dt>
                      <dd>{fmtMXN(settlement.totalTransport)}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-gray-500">Subtotal otros gastos</dt>
                      <dd>{fmtMXN(settlement.totalOther)}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-gray-500">Hospedaje</dt>
                      <dd>{fmtMXN(settlement.totalLodging)}</dd>
                    </div>
                    <div className="flex justify-between py-2 font-medium">
                      <dt className="text-gray-700">Total gastado</dt>
                      <dd>{fmtMXN(settlement.totalSpent)}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-gray-500">Anticipos entregados</dt>
                      <dd>{fmtMXN(settlement.totalAdvances)}</dd>
                    </div>
                    <div className="flex justify-between py-2 font-semibold text-base">
                      <dt className={Number(settlement.balanceDue) >= 0 ? "text-green-700" : "text-red-700"}>
                        {Number(settlement.balanceDue) >= 0 ? "Saldo a devolver" : "Saldo a pagar al trabajador"}
                      </dt>
                      <dd className={Number(settlement.balanceDue) >= 0 ? "text-green-700" : "text-red-700"}>
                        {fmtMXN(Math.abs(Number(settlement.balanceDue)))}
                      </dd>
                    </div>
                  </dl>
                  {Boolean(settlement.notes) && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-gray-500 mb-1">Notas de cierre</p>
                      <p className="text-sm text-gray-700">{fmt(settlement.notes)}</p>
                    </div>
                  )}
                  {Boolean(settlement.closedAt) && (
                    <p className="text-xs text-gray-400">Cerrada el {fmtDate(settlement.closedAt)}</p>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
                  <p className="text-sm text-gray-600">
                    La liquidación se calculará automáticamente con base en los gastos, hospedaje y anticipos registrados.
                  </p>
                  <dl className="divide-y divide-gray-100 text-sm">
                    <div className="flex justify-between py-2">
                      <dt className="text-gray-500">Gastos registrados</dt>
                      <dd>{fmtMXN(totalExpenses)}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-gray-500">Hospedaje</dt>
                      <dd>{fmtMXN(totalLodging)}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-gray-500">Anticipos entregados</dt>
                      <dd>{fmtMXN(totalAdvances)}</dd>
                    </div>
                    <div className="flex justify-between py-2 font-semibold">
                      <dt className={balance >= 0 ? "text-green-700" : "text-red-700"}>
                        {balance >= 0 ? "Estimado a devolver" : "Estimado a pagar"}
                      </dt>
                      <dd className={balance >= 0 ? "text-green-700" : "text-red-700"}>
                        {fmtMXN(Math.abs(balance))}
                      </dd>
                    </div>
                  </dl>
                  {status === "PENDING_SETTLEMENT" && (
                    <>
                      <button
                        onClick={() => setShowCloseModal(true)}
                        disabled={busy || missingReceipts > 0}
                        className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cerrar liquidación
                      </button>
                      {missingReceipts > 0 && (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                          <p className="font-semibold">Cierre bloqueado</p>
                          <p>
                            Faltan {missingReceipts} comprobante{missingReceipts > 1 ? "s" : ""}:
                            {missingExpenseReceipts > 0 ? ` ${missingExpenseReceipts} gasto${missingExpenseReceipts > 1 ? "s" : ""}` : ""}
                            {missingExpenseReceipts > 0 && missingLodgingReceipts > 0 ? " y" : ""}
                            {missingLodgingReceipts > 0 ? ` ${missingLodgingReceipts} hospedaje${missingLodgingReceipts > 1 ? "s" : ""}` : ""}.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Close settlement modal */}
        {showCloseModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Cerrar liquidación</h3>
              <p className="text-sm text-gray-600">
                Al cerrar la liquidación se registrará el balance final. Esta acción no se puede deshacer.
              </p>
              {missingReceipts > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <p className="font-semibold">No puedes cerrar todavía</p>
                  <p>
                    Faltan {missingReceipts} comprobante{missingReceipts > 1 ? "s" : ""}:
                    {missingExpenseReceipts > 0 ? ` ${missingExpenseReceipts} gasto${missingExpenseReceipts > 1 ? "s" : ""}` : ""}
                    {missingExpenseReceipts > 0 && missingLodgingReceipts > 0 ? " y" : ""}
                    {missingLodgingReceipts > 0 ? ` ${missingLodgingReceipts} hospedaje${missingLodgingReceipts > 1 ? "s" : ""}` : ""}.
                  </p>
                </div>
              )}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total gastado</span>
                  <span>{fmtMXN(totalSpent)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Anticipos</span>
                  <span>{fmtMXN(totalAdvances)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className={balance >= 0 ? "text-green-700" : "text-red-700"}>
                    {balance >= 0 ? "A devolver" : "A pagar al trabajador"}
                  </span>
                  <span className={balance >= 0 ? "text-green-700" : "text-red-700"}>
                    {fmtMXN(Math.abs(balance))}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Notas (opcional)</label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Observaciones de cierre..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleClose}
                  disabled={busy || missingReceipts > 0}
                  className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? "Cerrando..." : "Confirmar cierre"}
                </button>
                <button
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 py-2 bg-white border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </HtmlInCanvasPanel>
  );
}
