"use client";

import Link from "next/link";
import { useLanguage } from "../../../../lib/language-context";
import { useCallback, useEffect, useState } from "react";
import { Package, Plus, ChevronDown, Clock, DollarSign, RefreshCw, Inbox } from "lucide-react";
import { HtmlInCanvasPanel, StatCard, StatusBadge } from "@semse/ui";
import { fetchMaterials, createMaterialRequest, fetchMyJobs } from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

interface MaterialRequest {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  jobTitle: string;
  jobId: string;
  milestone: string;
  estimatedCost: number;
  status: "pending" | "approved" | "delivered" | "rejected";
  requestedAt: string;
}

const STATUS_MAP: Record<MaterialRequest["status"], { variant: "warning" | "success" | "info" | "neutral" | "error"; label: string }> = {
  pending:   { variant: "warning", label: "Pendiente" },
  approved:  { variant: "info",    label: "Aprobado"  },
  delivered: { variant: "success", label: "Entregado" },
  rejected:  { variant: "error",   label: "Rechazado" },
};

function rawToReq(m: Record<string, unknown>, jobTitleMap: Record<string, string>): MaterialRequest {
  const jobId = String(m.jobId ?? "");
  const status = String(m.status ?? "pending").toLowerCase();
  return {
    id:            String(m.id ?? ""),
    item:          String(m.item ?? m.name ?? "Material"),
    quantity:      typeof m.quantity === "number" ? m.quantity : Number(m.quantity ?? 1),
    unit:          String(m.unit ?? "unidades"),
    jobTitle:      jobTitleMap[jobId] ?? jobId,
    jobId,
    milestone:     String(m.milestoneTitle ?? m.milestone ?? m.milestoneId ?? ""),
    estimatedCost: typeof m.estimatedCost === "number" ? m.estimatedCost : Number(m.estimatedCost ?? 0),
    status:        (["pending", "approved", "delivered", "rejected"].includes(status) ? status : "pending") as MaterialRequest["status"],
    requestedAt:   typeof m.createdAt === "string" ? m.createdAt.slice(0, 10) : "",
  };
}

export default function WorkerMaterialsPage() {
  const { t } = useLanguage();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [jobs, setJobs]           = useState<{ id: string; title: string }[]>([]);
  const [formJobId, setFormJobId] = useState("");
  const [formItem, setFormItem]   = useState("");
  const [formQty, setFormQty]     = useState("");
  const [formUnit, setFormUnit]   = useState("unidades");
  const [formCost, setFormCost]   = useState("");

  const qtyValue = formQty.trim() === "" ? NaN : Number(formQty);
  const qtyIsInvalid = formQty.trim() !== "" && (!Number.isFinite(qtyValue) || qtyValue <= 0);
  const qtyError = qtyIsInvalid ? "La cantidad debe ser un número mayor que 0." : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rawMats, rawJobs] = await Promise.all([
        fetchMaterials().catch(() => [] as Record<string, unknown>[]),
        fetchMyJobs().catch(() => []),
      ]);
      const jobTitleMap: Record<string, string> = {};
      for (const j of rawJobs) jobTitleMap[j.id] = j.title;
      setJobs(rawJobs.map(j => ({ id: j.id, title: j.title })));
      if (formJobId === "" && rawJobs.length > 0) setFormJobId(rawJobs[0].id);
      setRequests(rawMats.map(m => rawToReq(m, jobTitleMap)));
    } catch { /* keep empty */ }
    setLoading(false);
  }, [formJobId]);

  useEffect(() => { void load(); }, [load]);

  async function handleSubmit() {
    if (!formItem.trim() || !formQty || !formJobId || submitting || qtyIsInvalid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createMaterialRequest({
        jobId: formJobId,
        item: formItem.trim(),
        quantity: Number(formQty),
        unit: formUnit,
        estimatedCost: formCost ? Number(formCost) : undefined,
      });
      setFormItem(""); setFormQty(""); setFormCost("");
      setShowForm(false);
      await load();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "No se pudo enviar la solicitud.");
    }
    setSubmitting(false);
  }

  const approved  = requests.filter(r => r.status === "approved");
  const pending   = requests.filter(r => r.status === "pending");
  const delivered = requests.filter(r => r.status === "delivered");
  const rejected  = requests.filter(r => r.status === "rejected");
  const totalApproved  = approved.reduce((s, r) => s + r.estimatedCost, 0);
  const totalPending   = pending.reduce((s, r) => s + r.estimatedCost, 0);

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
  };

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto" }}>
      {/* Header */}
      <HtmlInCanvasPanel as="section" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }} canvasClassName="rounded-2xl" minHeight={82}>
        <div>
          <Link href="/worker/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px" }}>←</span> Dashboard
          </Link>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>{t("page.materials")}</h1>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>Solicita y rastrea materiales para tus trabajos activos</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <NotificationBanner audience="worker" />
          <button onClick={() => void load()} disabled={loading} style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex" }} title="Recargar">
            <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
          <button onClick={() => setShowForm(v => !v)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "10px", border: "none", background: "var(--brand)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            <Plus size={15} /> Solicitar material
          </button>
        </div>
      </HtmlInCanvasPanel>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <StatCard label="Aprobados"  value={`$${totalApproved.toLocaleString()}`} icon={DollarSign} color="green"  loading={loading} />
        <StatCard label="Pendientes" value={`$${totalPending.toLocaleString()}`}  icon={DollarSign} color="amber"  loading={loading} />
        <StatCard label="Entregados" value={delivered.length}                      icon={Package}    color="blue"   loading={loading} />
        <StatCard label="Rechazados" value={rejected.length}                       icon={Package}    color="red"    loading={loading} />
      </div>

      {/* Form */}
      {showForm && (
        <HtmlInCanvasPanel as="section" style={{ ...card, padding: "20px", marginBottom: "20px" }} canvasClassName="rounded-2xl" minHeight={280}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", marginBottom: "16px" }}>Nueva solicitud de material</h2>
          <div style={{ display: "grid", gap: "12px" }}>
            {jobs.length > 0 && (
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>TRABAJO</label>
                <div style={{ position: "relative" }}>
                  <select value={formJobId} onChange={e => setFormJobId(e.target.value)} style={{ width: "100%", padding: "9px 28px 9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", appearance: "none", outline: "none", cursor: "pointer" }}>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                  </select>
                  <ChevronDown size={12} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                </div>
              </div>
            )}
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>MATERIAL / ÍTEM</label>
              <input value={formItem} onChange={e => setFormItem(e.target.value)} placeholder="Ej: Cemento Portland 50 kg" style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>CANTIDAD</label>
                <input type="number" min="0" step="any" value={formQty} onChange={e => setFormQty(e.target.value)} placeholder="0" aria-invalid={qtyIsInvalid} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: `1px solid ${qtyIsInvalid ? "#ef4444" : "var(--border)"}`, background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
                {qtyError && <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px" }}>{qtyError}</p>}
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>UNIDAD</label>
                <div style={{ position: "relative" }}>
                  <select value={formUnit} onChange={e => setFormUnit(e.target.value)} style={{ width: "100%", padding: "9px 28px 9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", appearance: "none", outline: "none", cursor: "pointer" }}>
                    {["unidades","metros","sacos","rollos","cajas","piezas","litros"].map(u => <option key={u}>{u}</option>)}
                  </select>
                  <ChevronDown size={12} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>COSTO EST. (USD)</label>
                <input type="number" value={formCost} onChange={e => setFormCost(e.target.value)} placeholder="0" style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            {submitError && <p style={{ fontSize: "12px", color: "#ef4444" }}>{submitError}</p>}
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={() => void handleSubmit()} disabled={submitting || !formItem.trim() || !formQty || qtyIsInvalid} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: "var(--brand)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", opacity: (submitting || qtyIsInvalid) ? 0.7 : 1 }}>
                {submitting ? "Enviando…" : "Enviar solicitud"}
              </button>
            </div>
          </div>
        </HtmlInCanvasPanel>
      )}

      {/* List */}
      <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={300}>
        <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", marginBottom: "12px" }}>Solicitudes de material</h2>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1,2,3].map(i => <div key={i} style={{ height: "68px", borderRadius: "10px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />)}
          </div>
        ) : requests.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <Inbox size={32} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted)" }}>Sin solicitudes</p>
            <p style={{ fontSize: "12px", color: "var(--faint)", marginTop: "4px" }}>Solicita materiales usando el botón de arriba.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {requests.map(req => {
              const s = STATUS_MAP[req.status];
              return (
                <div key={req.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(139,92,246,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Package size={18} color="#8b5cf6" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", marginBottom: "2px" }}>{req.item}</p>
                    <p style={{ fontSize: "11px", color: "var(--muted)" }}>
                      {req.quantity} {req.unit}
                      {req.jobTitle ? ` · ${req.jobTitle}` : ""}
                      {req.milestone ? ` · ${req.milestone}` : ""}
                    </p>
                    {req.requestedAt && (
                      <p style={{ fontSize: "11px", color: "var(--faint)", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                        <Clock size={10} /> {req.requestedAt}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {req.estimatedCost > 0 && <p style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>${req.estimatedCost.toLocaleString()}</p>}
                    <StatusBadge variant={s.variant} text={s.label} size="sm" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </HtmlInCanvasPanel>
    </div>
  );
}
