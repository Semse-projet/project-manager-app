"use client";

import { useEffect, useState } from "react";
import {
  fetchLeads, fetchLeadStats, createLead, updateLead, deleteLead, chatWithPrometeo,
  type ContractorLead, type LeadStatus, type LeadStats, type Invoice,
} from "../../../semse-api";
import { EstimateModal } from "../../../../components/contractor/estimate-modal";
import { Phone, Mail, MapPin, Plus, Search, RefreshCw, X, ChevronDown, Briefcase, Clock, DollarSign, User, FileText, MessageSquare, Copy, Check } from "lucide-react";

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  estimate_sent: "Estimado enviado",
  estimate_approved: "Estimado aprobado",
  in_progress: "En progreso",
  completed: "Completado",
  lost: "Perdido",
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "#60a5fa",
  contacted: "#a78bfa",
  estimate_sent: "#fbbf24",
  estimate_approved: "#34d399",
  in_progress: "#f97316",
  completed: "#86efac",
  lost: "#f87171",
};

const JOB_TYPES = ["Drywall", "Pintura", "Pisos", "Remodelación", "Reparación general", "Plomería", "Electricidad", "Limpieza post-obra", "Techo", "Otro"];
const URGENCY_LABELS: Record<string, string> = { asap: "Lo antes posible", this_week: "Esta semana", this_month: "Este mes", flexible: "Flexible" };
const SOURCES: Record<string, string> = { referral: "Referido", nextdoor: "Nextdoor", facebook: "Facebook", call: "Llamada", website: "Sitio web", other: "Otro" };

function StatusBadge({ status }: { status: LeadStatus }) {
  const color = STATUS_COLORS[status] ?? "#6b7280";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}20`, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function StatKpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: "center", padding: "12px 8px", background: "var(--surface)", border: `1px solid ${color}33`, borderRadius: 12, minWidth: 80 }}>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

const EMPTY_FORM = {
  name: "", phone: "", email: "", address: "", city: "", state: "",
  jobType: "", description: "", budgetRange: "", urgency: "" as ContractorLead["urgency"],
  notes: "", nextAction: "", nextActionAt: "", source: "" as ContractorLead["source"],
  status: "new" as LeadStatus,
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<ContractorLead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "">("");
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<ContractorLead | null>(null);
  const [estimateLead, setEstimateLead] = useState<ContractorLead | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([
        fetchLeads({ search: search || undefined, status: filterStatus || undefined }),
        fetchLeadStats(),
      ]);
      setLeads(l);
      setStats(s);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [search, filterStatus]);

  function openNew() {
    setEditingLead(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(lead: ContractorLead) {
    setEditingLead(lead);
    setForm({
      name: lead.name,
      phone: lead.phone ?? "",
      email: lead.email ?? "",
      address: lead.address ?? "",
      city: lead.city ?? "",
      state: lead.state ?? "",
      jobType: lead.jobType ?? "",
      description: lead.description ?? "",
      budgetRange: lead.budgetRange ?? "",
      urgency: lead.urgency,
      notes: lead.notes ?? "",
      nextAction: lead.nextAction ?? "",
      nextActionAt: lead.nextActionAt ? lead.nextActionAt.slice(0, 10) : "",
      source: lead.source,
      status: lead.status,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        jobType: form.jobType || null,
        description: form.description || null,
        budgetRange: form.budgetRange || null,
        urgency: form.urgency || null,
        notes: form.notes || null,
        nextAction: form.nextAction || null,
        nextActionAt: form.nextActionAt ? new Date(form.nextActionAt).toISOString() : null,
        source: form.source || null,
        status: form.status,
      };
      if (editingLead) {
        await updateLead(editingLead.id, payload);
      } else {
        await createLead(payload);
      }
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(lead: ContractorLead, newStatus: LeadStatus) {
    await updateLead(lead.id, { status: newStatus });
    await load();
  }

  async function handleDelete(lead: ContractorLead) {
    if (!confirm(`¿Eliminar el lead de ${lead.name}?`)) return;
    await deleteLead(lead.id);
    await load();
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", margin: 0 }}>Leads & Clientes</h1>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0, marginTop: 2 }}>Gestiona tus contactos y oportunidades de trabajo</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => void load()} disabled={loading} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer" }}>
            <RefreshCw size={14} style={{ display: "block" }} />
          </button>
          <button onClick={openNew} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "none", background: "#3b82f6", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            <Plus size={14} /> Nuevo lead
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <StatKpi label="Total" value={stats.total} color="#94a3b8" />
          <StatKpi label="Nuevos" value={stats.new} color="#60a5fa" />
          <StatKpi label="Contactados" value={stats.contacted} color="#a78bfa" />
          <StatKpi label="Estimado" value={stats.estimate_sent} color="#fbbf24" />
          <StatKpi label="Aprobado" value={stats.estimate_approved} color="#34d399" />
          <StatKpi label="En curso" value={stats.in_progress} color="#f97316" />
          <StatKpi label="Cerrados" value={stats.completed} color="#86efac" />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono, trabajo..."
            style={{ width: "100%", paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as LeadStatus | "")}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 13, cursor: "pointer" }}
        >
          <option value="">Todos los estados</option>
          {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Lead list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13 }}>Cargando leads...</div>
      ) : leads.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}>
          <User size={40} style={{ margin: "0 auto 12px", opacity: 0.3, display: "block" }} />
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No hay leads todavía</div>
          <div style={{ fontSize: 13 }}>Haz click en &quot;Nuevo lead&quot; para registrar tu primer contacto</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onEdit={() => openEdit(lead)}
              onDelete={() => void handleDelete(lead)}
              onStatusChange={(s) => void handleStatusChange(lead, s)}
              onEstimate={() => setEstimateLead(lead)}
            />
          ))}
        </div>
      )}

      {/* Estimate modal */}
      {estimateLead && (
        <EstimateModal
          lead={estimateLead}
          onClose={() => setEstimateLead(null)}
          onCreated={(_invoice: Invoice) => {
            setEstimateLead(null);
            void load();
          }}
        />
      )}

      {/* Form modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>
                {editingLead ? "Editar lead" : "Nuevo lead"}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ padding: 4, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>

            <FormField label="Nombre *">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Juan Rodríguez" style={inputStyle()} />
            </FormField>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FormField label="Teléfono">
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(305) 555-0100" style={inputStyle()} />
              </FormField>
              <FormField label="Email">
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="juan@email.com" style={inputStyle()} type="email" />
              </FormField>
            </div>

            <FormField label="Dirección">
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main St" style={inputStyle()} />
            </FormField>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FormField label="Ciudad">
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Miami" style={inputStyle()} />
              </FormField>
              <FormField label="Estado">
                <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="FL" style={inputStyle()} />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FormField label="Tipo de trabajo">
                <select value={form.jobType} onChange={(e) => setForm({ ...form, jobType: e.target.value })} style={inputStyle()}>
                  <option value="">Seleccionar...</option>
                  {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Presupuesto aprox.">
                <input value={form.budgetRange} onChange={(e) => setForm({ ...form, budgetRange: e.target.value })} placeholder="$500-$1,500" style={inputStyle()} />
              </FormField>
            </div>

            <FormField label="Descripción del trabajo">
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalles del trabajo solicitado..." rows={2} style={{ ...inputStyle(), resize: "vertical" as const }} />
            </FormField>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FormField label="Urgencia">
                <select value={form.urgency ?? ""} onChange={(e) => setForm({ ...form, urgency: e.target.value as ContractorLead["urgency"] })} style={inputStyle()}>
                  <option value="">Seleccionar...</option>
                  {Object.entries(URGENCY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </FormField>
              <FormField label="Fuente">
                <select value={form.source ?? ""} onChange={(e) => setForm({ ...form, source: e.target.value as ContractorLead["source"] })} style={inputStyle()}>
                  <option value="">Seleccionar...</option>
                  {Object.entries(SOURCES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FormField label="Estado">
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })} style={inputStyle()}>
                  {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </FormField>
              <FormField label="Próxima acción — fecha">
                <input value={form.nextActionAt} onChange={(e) => setForm({ ...form, nextActionAt: e.target.value })} type="date" style={inputStyle()} />
              </FormField>
            </div>

            <FormField label="Próxima acción">
              <input value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} placeholder="Llamar para confirmar visita" style={inputStyle()} />
            </FormField>

            <FormField label="Notas">
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas adicionales..." rows={2} style={{ ...inputStyle(), resize: "vertical" as const }} />
            </FormField>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 13 }}>
                Cancelar
              </button>
              <button onClick={() => void handleSave()} disabled={saving || !form.name.trim()} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#3b82f6", color: "white", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Guardando..." : editingLead ? "Guardar cambios" : "Crear lead"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LeadCard({
  lead,
  onEdit,
  onDelete,
  onStatusChange,
  onEstimate,
}: {
  lead: ContractorLead;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: LeadStatus) => void;
  onEstimate: () => void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [generatingMsg, setGeneratingMsg] = useState(false);
  const [generatedMsg, setGeneratedMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerateMessage() {
    setGeneratingMsg(true);
    setGeneratedMsg(null);
    try {
      const prompt = `Redacta un mensaje de WhatsApp profesional en español para el cliente ${lead.name}. El trabajo es: ${lead.jobType ?? lead.description ?? "trabajo de construcción"}. El estado del lead es: ${STATUS_LABELS[lead.status]}. Incluye un saludo, el asunto del mensaje y un próximo paso claro. Máximo 3 párrafos cortos. Solo el texto del mensaje, sin explicaciones adicionales.`;
      const res = await chatWithPrometeo({ message: prompt, agentId: "assistant" });
      setGeneratedMsg(res.response ?? "");
    } catch {
      setGeneratedMsg("No se pudo generar el mensaje. Inténtalo de nuevo.");
    } finally {
      setGeneratingMsg(false);
    }
  }

  function handleCopy(text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>{lead.name}</span>
          <StatusBadge status={lead.status} />
          {lead.urgency && (
            <span style={{ fontSize: 10, color: "var(--muted)", background: "var(--bg)", padding: "2px 6px", borderRadius: 10, border: "1px solid var(--border)" }}>
              {URGENCY_LABELS[lead.urgency]}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
          {lead.phone && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--muted)" }}>
              <Phone size={11} /> {lead.phone}
            </span>
          )}
          {lead.email && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--muted)" }}>
              <Mail size={11} /> {lead.email}
            </span>
          )}
          {(lead.city ?? lead.address) && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--muted)" }}>
              <MapPin size={11} /> {[lead.city, lead.state].filter(Boolean).join(", ") || lead.address}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {lead.jobType && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#818cf8" }}>
              <Briefcase size={11} /> {lead.jobType}
            </span>
          )}
          {lead.budgetRange && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#34d399" }}>
              <DollarSign size={11} /> {lead.budgetRange}
            </span>
          )}
          {lead.nextAction && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--muted)" }}>
              <Clock size={11} /> {lead.nextAction}
              {lead.nextActionAt && ` — ${new Date(lead.nextActionAt).toLocaleDateString("es-MX")}`}
            </span>
          )}
        </div>

        {lead.description && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, fontStyle: "italic" }}>{lead.description}</div>
        )}

        {/* Generated message area */}
        {generatedMsg && (
          <div style={{ marginTop: 10, padding: "10px 12px", background: "#10b98112", border: "1px solid #10b98133", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#34d399", textTransform: "uppercase" }}>Mensaje generado (WhatsApp)</span>
              <button
                onClick={() => handleCopy(generatedMsg)}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, border: "none", background: copied ? "#10b981" : "rgba(255,255,255,.1)", color: copied ? "white" : "#34d399", cursor: "pointer", fontSize: 10, fontWeight: 700 }}
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{generatedMsg}</div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {/* Status quick-change */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setStatusOpen(!statusOpen)}
            style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}
          >
            Estado <ChevronDown size={10} />
          </button>
          {statusOpen && (
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, zIndex: 20, minWidth: 160, padding: 4 }}>
              {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => { onStatusChange(s); setStatusOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 10px", border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: STATUS_COLORS[s], fontWeight: lead.status === s ? 800 : 500, borderRadius: 6 }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLORS[s], flexShrink: 0 }} />
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onEstimate}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, border: "none", background: "#3b82f620", color: "#60a5fa", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
          title="Crear estimado para este lead"
        >
          <FileText size={11} /> Estimado
        </button>
        <button
          onClick={() => void handleGenerateMessage()}
          disabled={generatingMsg}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, border: "none", background: "#10b98120", color: "#34d399", cursor: generatingMsg ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, opacity: generatingMsg ? 0.7 : 1 }}
          title="Generar mensaje WhatsApp con IA"
        >
          <MessageSquare size={11} /> {generatingMsg ? "..." : "Mensaje"}
        </button>
        <button onClick={onEdit} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
          Editar
        </button>
        <button onClick={onDelete} style={{ padding: "5px 8px", borderRadius: 7, border: "none", background: "#fca5a520", color: "#f87171", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
          ×
        </button>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
      {children}
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--ink)",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  };
}
