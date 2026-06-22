"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import { normalizeErrorMessage } from "../../../semse-api";

// ── Types (mirrors API DTOs) ───────────────────────────────────────────────────

type UnitStatus = "PENDING" | "IN_PROGRESS" | "COMPLETE" | "ON_HOLD" | "CANCELLED";

interface FieldUnit {
  id: string;
  code: string;
  name: string | null;
  address: string | null;
  status: UnitStatus;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

interface WorklogEntry {
  id: string;
  fieldUnitId: string;
  date: string;
  doneToday: string;
  pendingNext: string;
  blockers: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  fieldUnit?: { id: string; code: string; name: string | null };
}

interface ContextMemoryEntry {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  visibility: "TEAM" | "ORG" | "PUBLIC";
  worklogId: string | null;
  createdBy: string;
  createdAt: string;
}

interface ComplianceDoc {
  id: string;
  type: string;
  status: "MISSING" | "PENDING" | "APPROVED" | "EXPIRED";
  fileUrl: string | null;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const UNIT_STATUS_CFG: Record<UnitStatus, { label: string; dot: string; text: string }> = {
  PENDING:     { label: "Pendiente",    dot: "bg-zinc-400",   text: "text-zinc-400" },
  IN_PROGRESS: { label: "En progreso",  dot: "bg-blue-400",   text: "text-blue-400" },
  COMPLETE:    { label: "Completo",     dot: "bg-emerald-400",text: "text-emerald-400" },
  ON_HOLD:     { label: "En pausa",     dot: "bg-yellow-400", text: "text-yellow-400" },
  CANCELLED:   { label: "Cancelado",    dot: "bg-red-400",    text: "text-red-400" },
};

const COMPLIANCE_STATUS_CFG: Record<string, { label: string; color: string }> = {
  MISSING:  { label: "Faltante",  color: "text-red-400 bg-red-500/10" },
  PENDING:  { label: "Pendiente", color: "text-yellow-400 bg-yellow-500/10" },
  APPROVED: { label: "Aprobado",  color: "text-emerald-400 bg-emerald-500/10" },
  EXPIRED:  { label: "Vencido",   color: "text-orange-400 bg-orange-500/10" },
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(normalizeErrorMessage(json?.error) ?? `HTTP ${res.status}`);
  }
  return (json as { data: T }).data;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ cfg }: { cfg: { label: string; dot: string; text: string } }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", cfg.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-[var(--ink)]">{title}</h2>
      {action}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] py-12 text-center">
      <p className="text-sm text-[var(--muted)]">{message}</p>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mb-4 flex items-start justify-between rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
      <span>⚠ {message}</span>
      <button onClick={onDismiss} className="ml-4 text-red-400/60 hover:text-red-400">✕</button>
    </div>
  );
}

// ── Units Tab ─────────────────────────────────────────────────────────────────

function UnitsTab() {
  const [units, setUnits] = useState<FieldUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FieldUnit | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // New unit form
  const [showForm, setShowForm] = useState(false);
  const [formProjectId, setFormProjectId] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<FieldUnit[]>("/api/semse/field-ops/units");
      setUnits(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando unidades");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function updateStatus(unit: FieldUnit, status: UnitStatus) {
    setUpdatingId(unit.id);
    try {
      const updated = await apiFetch<FieldUnit>(`/api/semse/field-ops/units/${unit.id}/status`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setUnits(prev => prev.map(u => u.id === updated.id ? updated : u));
      if (selected?.id === updated.id) setSelected(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error actualizando estado");
    } finally {
      setUpdatingId(null);
    }
  }

  async function createUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!formProjectId.trim() || !formCode.trim()) return;
    setCreating(true);
    try {
      const created = await apiFetch<FieldUnit>("/api/semse/field-ops/units", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: formProjectId.trim(),
          code: formCode.trim(),
          name: formName.trim() || undefined,
          address: formAddress.trim() || undefined,
        }),
      });
      setUnits(prev => [...prev, created]);
      setShowForm(false);
      setFormProjectId(""); setFormCode(""); setFormName(""); setFormAddress("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error creando unidad");
    } finally {
      setCreating(false);
    }
  }

  const counts = Object.keys(UNIT_STATUS_CFG).reduce<Record<string, number>>((acc, k) => {
    acc[k] = units.filter(u => u.status === k).length;
    return acc;
  }, {});

  return (
    <div>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(Object.entries(UNIT_STATUS_CFG) as [UnitStatus, typeof UNIT_STATUS_CFG[UnitStatus]][]).map(([key, cfg]) => (
          <div key={key} className="rounded-xl border border-white/[0.06] bg-[var(--bg-2,#111)] p-3">
            <p className="text-[0.65rem] text-[var(--muted)]">{cfg.label}</p>
            <p className={cn("mt-0.5 text-xl font-bold", cfg.text)}>{counts[key] ?? 0}</p>
          </div>
        ))}
      </div>

      <SectionHeader
        title={`Unidades (${units.length})`}
        action={
          <button
            onClick={() => setShowForm(v => !v)}
            className="rounded-lg border border-[var(--brand,#3b82f6)]/40 px-3 py-1.5 text-xs font-medium text-[var(--brand,#3b82f6)] hover:bg-[var(--brand,#3b82f6)]/10 transition-colors"
          >
            {showForm ? "Cancelar" : "+ Nueva unidad"}
          </button>
        }
      />

      {/* New unit form */}
      {showForm && (
        <form onSubmit={createUnit} className="mb-5 rounded-xl border border-white/[0.08] bg-[var(--bg-2,#111)] p-4">
          <p className="mb-3 text-xs font-semibold text-[var(--ink)]">Nueva unidad de trabajo</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[0.65rem] text-[var(--muted)]">Project ID *</label>
              <input value={formProjectId} onChange={e => setFormProjectId(e.target.value)}
                required placeholder="cuid del proyecto"
                className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg,#0a0a0a)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)]" />
            </div>
            <div>
              <label className="mb-1 block text-[0.65rem] text-[var(--muted)]">Código *</label>
              <input value={formCode} onChange={e => setFormCode(e.target.value)}
                required placeholder="Ej: 110, Wing-A"
                className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg,#0a0a0a)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)]" />
            </div>
            <div>
              <label className="mb-1 block text-[0.65rem] text-[var(--muted)]">Nombre</label>
              <input value={formName} onChange={e => setFormName(e.target.value)}
                placeholder="Nombre amigable"
                className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg,#0a0a0a)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)]" />
            </div>
            <div>
              <label className="mb-1 block text-[0.65rem] text-[var(--muted)]">Dirección</label>
              <input value={formAddress} onChange={e => setFormAddress(e.target.value)}
                placeholder="Dirección física"
                className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg,#0a0a0a)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)]" />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="submit" disabled={creating || !formProjectId.trim() || !formCode.trim()}
              className="rounded-lg bg-[var(--brand,#3b82f6)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90">
              {creating ? "Creando…" : "Crear unidad"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-white/[0.03]" />
        ))}</div>
      ) : units.length === 0 ? (
        <EmptyState message="No hay unidades. Crea la primera para comenzar." />
      ) : (
        <div className="space-y-2">
          {units.map(unit => {
            const cfg = UNIT_STATUS_CFG[unit.status];
            return (
              <div
                key={unit.id}
                onClick={() => setSelected(s => s?.id === unit.id ? null : unit)}
                className={cn(
                  "cursor-pointer rounded-xl border px-4 py-3 transition-all",
                  selected?.id === unit.id
                    ? "border-[var(--brand,#3b82f6)]/30 bg-[var(--brand,#3b82f6)]/5"
                    : "border-white/[0.06] bg-[var(--bg-2,#111)] hover:border-white/[0.12]"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold", cfg.text, "bg-current/10")}
                      style={{ background: "rgba(255,255,255,0.04)" }}>
                      {unit.code}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--ink)]">
                        {unit.name ?? `Unidad ${unit.code}`}
                      </p>
                      {unit.address && (
                        <p className="truncate text-[0.65rem] text-[var(--muted)]">{unit.address}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge cfg={cfg} />
                  </div>
                </div>

                {/* Inline status changer */}
                {selected?.id === unit.id && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3">
                    <span className="text-[0.65rem] text-[var(--muted)] self-center mr-1">Cambiar estado:</span>
                    {(Object.keys(UNIT_STATUS_CFG) as UnitStatus[]).filter(s => s !== unit.status).map(s => (
                      <button key={s} disabled={updatingId === unit.id}
                        onClick={ev => { ev.stopPropagation(); void updateStatus(unit, s); }}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[0.6rem] font-medium transition-all disabled:opacity-40",
                          UNIT_STATUS_CFG[s].text,
                          "border border-current/20 hover:bg-current/10"
                        )}>
                        {updatingId === unit.id ? "…" : UNIT_STATUS_CFG[s].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Worklogs Tab ──────────────────────────────────────────────────────────────

function WorklogsTab() {
  const [worklogs, setWorklogs] = useState<WorklogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterUnit, setFilterUnit] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [fUnitId, setFUnitId] = useState("");
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10));
  const [fDone, setFDone] = useState("");
  const [fPending, setFPending] = useState("");
  const [fBlockers, setFBlockers] = useState("");
  const [fNotes, setFNotes] = useState("");

  const load = useCallback(async (unitId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = unitId ? `?fieldUnitId=${encodeURIComponent(unitId)}` : "";
      const data = await apiFetch<WorklogEntry[]>(`/api/semse/field-ops/worklogs${qs}`);
      setWorklogs(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando worklogs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submitWorklog(e: React.FormEvent) {
    e.preventDefault();
    if (!fUnitId.trim() || !fDone.trim() || !fPending.trim()) return;
    setSubmitting(true);
    try {
      const created = await apiFetch<WorklogEntry>("/api/semse/field-ops/worklogs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fieldUnitId: fUnitId.trim(),
          date: fDate,
          doneToday: fDone.trim(),
          pendingNext: fPending.trim(),
          blockers: fBlockers.trim() || undefined,
          notes: fNotes.trim() || undefined,
        }),
      });
      setWorklogs(prev => [created, ...prev]);
      setShowForm(false);
      setFUnitId(""); setFDone(""); setFPending(""); setFBlockers(""); setFNotes("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error creando worklog");
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = filterUnit.trim()
    ? worklogs.filter(w => w.fieldUnitId === filterUnit.trim() || w.fieldUnit?.code.includes(filterUnit))
    : worklogs;

  return (
    <div>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <SectionHeader
        title={`Worklogs (${filtered.length})`}
        action={
          <button onClick={() => setShowForm(v => !v)}
            className="rounded-lg border border-[var(--brand,#3b82f6)]/40 px-3 py-1.5 text-xs font-medium text-[var(--brand,#3b82f6)] hover:bg-[var(--brand,#3b82f6)]/10 transition-colors">
            {showForm ? "Cancelar" : "+ Registrar avance"}
          </button>
        }
      />

      {/* Filter */}
      <div className="mb-4">
        <input value={filterUnit} onChange={e => setFilterUnit(e.target.value)}
          placeholder="Filtrar por código de unidad…"
          className="w-full max-w-xs rounded-lg border border-white/[0.08] bg-[var(--bg-2,#111)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)] placeholder:text-[var(--muted)]" />
      </div>

      {/* New worklog form */}
      {showForm && (
        <form onSubmit={submitWorklog} className="mb-5 rounded-xl border border-white/[0.08] bg-[var(--bg-2,#111)] p-4">
          <p className="mb-3 text-xs font-semibold text-[var(--ink)]">Registrar avance diario</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[0.65rem] text-[var(--muted)]">Field Unit ID *</label>
              <input value={fUnitId} onChange={e => setFUnitId(e.target.value)} required
                className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg,#0a0a0a)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)]" />
            </div>
            <div>
              <label className="mb-1 block text-[0.65rem] text-[var(--muted)]">Fecha *</label>
              <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} required
                className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg,#0a0a0a)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)]" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[0.65rem] text-[var(--muted)]">Hecho hoy *</label>
              <textarea value={fDone} onChange={e => setFDone(e.target.value)} required rows={2}
                className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg,#0a0a0a)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)] resize-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[0.65rem] text-[var(--muted)]">Pendiente siguiente *</label>
              <textarea value={fPending} onChange={e => setFPending(e.target.value)} required rows={2}
                className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg,#0a0a0a)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)] resize-none" />
            </div>
            <div>
              <label className="mb-1 block text-[0.65rem] text-[var(--muted)]">Bloqueadores</label>
              <input value={fBlockers} onChange={e => setFBlockers(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg,#0a0a0a)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)]" />
            </div>
            <div>
              <label className="mb-1 block text-[0.65rem] text-[var(--muted)]">Notas</label>
              <input value={fNotes} onChange={e => setFNotes(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg,#0a0a0a)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)]" />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="submit" disabled={submitting || !fUnitId.trim() || !fDone.trim() || !fPending.trim()}
              className="rounded-lg bg-[var(--brand,#3b82f6)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90">
              {submitting ? "Guardando…" : "Guardar avance"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.03]" />
        ))}</div>
      ) : filtered.length === 0 ? (
        <EmptyState message="No hay registros de avance aún." />
      ) : (
        <div className="space-y-2">
          {filtered.map(w => (
            <div key={w.id} className="rounded-xl border border-white/[0.06] bg-[var(--bg-2,#111)] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-[var(--brand,#3b82f6)]">
                      {w.fieldUnit ? `Unidad ${w.fieldUnit.code}` : w.fieldUnitId.slice(0, 8)}
                    </span>
                    <span className="text-[0.65rem] text-[var(--muted)]">
                      {fmtDate(w.date)} · por {w.createdBy}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--ink)]">
                    <span className="text-[var(--muted)]">✓ </span>{w.doneToday}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ink)]/70">
                    <span className="text-[var(--muted)]">→ </span>{w.pendingNext}
                  </p>
                  {w.blockers && (
                    <p className="mt-1 text-xs text-red-400/80">
                      <span className="font-medium">⚠ </span>{w.blockers}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Context Memory Tab ───────────────────────────────────────────────────────

function KnowledgeTab() {
  const [facts, setFacts] = useState<ContextMemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fSubject, setFSubject] = useState("");
  const [fPredicate, setFPredicate] = useState("");
  const [fObject, setFObject] = useState("");
  const [fConfidence, setFConfidence] = useState("0.7");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ContextMemoryEntry[]>("/api/semse/field-ops/facts");
      setFacts(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando hechos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createFact(e: React.FormEvent) {
    e.preventDefault();
    if (!fSubject.trim() || !fPredicate.trim() || !fObject.trim()) return;
    setSubmitting(true);
    try {
      const created = await apiFetch<ContextMemoryEntry>("/api/semse/field-ops/facts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject: fSubject.trim(),
          predicate: fPredicate.trim(),
          object: fObject.trim(),
          confidence: parseFloat(fConfidence) || 0.7,
        }),
      });
      setFacts(prev => [created, ...prev]);
      setShowForm(false);
      setFSubject(""); setFPredicate(""); setFObject(""); setFConfidence("0.7");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error creando hecho");
    } finally {
      setSubmitting(false);
    }
  }

  function confidenceColor(c: number) {
    if (c >= 0.85) return "text-emerald-400";
    if (c >= 0.6)  return "text-yellow-400";
    return "text-red-400";
  }

  return (
    <div>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <SectionHeader
        title={`Memoria contextual (${facts.length})`}
        action={
          <button onClick={() => setShowForm(v => !v)}
            className="rounded-lg border border-[var(--brand,#3b82f6)]/40 px-3 py-1.5 text-xs font-medium text-[var(--brand,#3b82f6)] hover:bg-[var(--brand,#3b82f6)]/10 transition-colors">
            {showForm ? "Cancelar" : "+ Nueva entrada"}
          </button>
        }
      />

      {showForm && (
        <form onSubmit={createFact} className="mb-5 rounded-xl border border-white/[0.08] bg-[var(--bg-2,#111)] p-4">
          <p className="mb-3 text-xs font-semibold text-[var(--ink)]">Nueva entrada de memoria contextual</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[0.65rem] text-[var(--muted)]">Sujeto *</label>
              <input value={fSubject} onChange={e => setFSubject(e.target.value)} required
                placeholder="FieldUnit:110"
                className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg,#0a0a0a)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)]" />
            </div>
            <div>
              <label className="mb-1 block text-[0.65rem] text-[var(--muted)]">Predicado *</label>
              <input value={fPredicate} onChange={e => setFPredicate(e.target.value)} required
                placeholder="blocked_by, status…"
                className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg,#0a0a0a)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)]" />
            </div>
            <div>
              <label className="mb-1 block text-[0.65rem] text-[var(--muted)]">Objeto *</label>
              <input value={fObject} onChange={e => setFObject(e.target.value)} required
                placeholder="Valor o descripción"
                className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg,#0a0a0a)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)]" />
            </div>
          </div>
          <div className="mt-3 flex items-end gap-3">
            <div className="w-32">
              <label className="mb-1 block text-[0.65rem] text-[var(--muted)]">Confianza (0–1)</label>
              <input type="number" min="0" max="1" step="0.05" value={fConfidence}
                onChange={e => setFConfidence(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg,#0a0a0a)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)]" />
            </div>
            <button type="submit" disabled={submitting || !fSubject.trim() || !fPredicate.trim() || !fObject.trim()}
              className="rounded-lg bg-[var(--brand,#3b82f6)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90">
              {submitting ? "Guardando…" : "Crear hecho"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.03]" />
        ))}</div>
      ) : facts.length === 0 ? (
        <EmptyState message="No hay memoria contextual registrada. Crea una entrada o promueve señal desde un worklog." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] bg-[var(--bg-2,#111)]">
                {["Sujeto", "Predicado", "Objeto", "Confianza", "Por", "Fecha"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[0.65rem] font-semibold text-[var(--muted)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facts.map((f, i) => (
                <tr key={f.id} className={cn("border-b border-white/[0.04]", i % 2 === 0 ? "" : "bg-white/[0.01]")}>
                  <td className="px-4 py-2.5 font-medium text-[var(--brand,#3b82f6)]">{f.subject}</td>
                  <td className="px-4 py-2.5 text-[var(--muted)]">{f.predicate}</td>
                  <td className="px-4 py-2.5 text-[var(--ink)] max-w-[200px] truncate">{f.object}</td>
                  <td className={cn("px-4 py-2.5 font-mono font-semibold", confidenceColor(f.confidence))}>
                    {(f.confidence * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-2.5 text-[var(--muted)]">{f.createdBy}</td>
                  <td className="px-4 py-2.5 text-[var(--muted)]">{fmtDate(f.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Vendors Tab ───────────────────────────────────────────────────────────────

function VendorsTab() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [fName, setFName] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fEmail, setFEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Vendor[]>("/api/semse/field-ops/vendors");
      setVendors(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando vendedores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createVendor(e: React.FormEvent) {
    e.preventDefault();
    if (!fName.trim()) return;
    setCreating(true);
    try {
      const created = await apiFetch<Vendor>("/api/semse/field-ops/vendors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: fName.trim(),
          phone: fPhone.trim() || undefined,
          email: fEmail.trim() || undefined,
        }),
      });
      setVendors(prev => [...prev, { ...created, compliance: [] }]);
      setShowForm(false);
      setFName(""); setFPhone(""); setFEmail("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error creando proveedor");
    } finally {
      setCreating(false);
    }
  }

  async function upsertCompliance(vendorId: string, type: string, status: string) {
    try {
      await apiFetch<ComplianceDoc>(`/api/semse/field-ops/vendors/${vendorId}/compliance`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, status }),
      });
      void load(); // refresh to get updated compliance
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error actualizando compliance");
    }
  }

  const COMPLIANCE_TYPES = ["INSURANCE", "LICENSE", "W9", "CONTRACT", "ID"];

  return (
    <div>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <SectionHeader
        title={`Proveedores (${vendors.length})`}
        action={
          <button onClick={() => setShowForm(v => !v)}
            className="rounded-lg border border-[var(--brand,#3b82f6)]/40 px-3 py-1.5 text-xs font-medium text-[var(--brand,#3b82f6)] hover:bg-[var(--brand,#3b82f6)]/10 transition-colors">
            {showForm ? "Cancelar" : "+ Nuevo proveedor"}
          </button>
        }
      />

      {showForm && (
        <form onSubmit={createVendor} className="mb-5 rounded-xl border border-white/[0.08] bg-[var(--bg-2,#111)] p-4">
          <p className="mb-3 text-xs font-semibold text-[var(--ink)]">Nuevo proveedor</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[0.65rem] text-[var(--muted)]">Nombre *</label>
              <input value={fName} onChange={e => setFName(e.target.value)} required
                className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg,#0a0a0a)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)]" />
            </div>
            <div>
              <label className="mb-1 block text-[0.65rem] text-[var(--muted)]">Teléfono</label>
              <input value={fPhone} onChange={e => setFPhone(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg,#0a0a0a)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)]" />
            </div>
            <div>
              <label className="mb-1 block text-[0.65rem] text-[var(--muted)]">Email</label>
              <input type="email" value={fEmail} onChange={e => setFEmail(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg,#0a0a0a)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand,#3b82f6)]" />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="submit" disabled={creating || !fName.trim()}
              className="rounded-lg bg-[var(--brand,#3b82f6)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90">
              {creating ? "Creando…" : "Crear proveedor"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-white/[0.03]" />
        ))}</div>
      ) : vendors.length === 0 ? (
        <EmptyState message="No hay proveedores registrados." />
      ) : (
        <div className="space-y-2">
          {vendors.map(v => {
            const isOpen = expanded === v.id;
            const missingCount = COMPLIANCE_TYPES.filter(t =>
              !v.compliance.find(c => c.type === t && c.status === "APPROVED")
            ).length;
            return (
              <div key={v.id} className="rounded-xl border border-white/[0.06] bg-[var(--bg-2,#111)]">
                <button
                  onClick={() => setExpanded(isOpen ? null : v.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-[0.65rem] font-bold text-[var(--brand,#3b82f6)]">
                      {v.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--ink)]">{v.name}</p>
                      <p className="text-[0.65rem] text-[var(--muted)]">
                        {v.phone ?? "–"} · {v.email ?? "–"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 ml-3">
                    {missingCount > 0 && (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[0.6rem] font-semibold text-red-400">
                        {missingCount} doc{missingCount > 1 ? "s" : ""} faltante{missingCount > 1 ? "s" : ""}
                      </span>
                    )}
                    <svg className={cn("h-3.5 w-3.5 text-[var(--muted)] transition-transform", isOpen && "rotate-180")}
                      viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M2 4l4 4 4-4" />
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
                    <p className="mb-2 text-[0.65rem] font-semibold text-[var(--muted)]">DOCUMENTOS DE COMPLIANCE</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {COMPLIANCE_TYPES.map(type => {
                        const doc = v.compliance.find(c => c.type === type);
                        const status = doc?.status ?? "MISSING";
                        const cfg = COMPLIANCE_STATUS_CFG[status];
                        return (
                          <div key={type} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-[var(--ink)]">{type}</span>
                              <span className={cn("rounded-full px-2 py-0.5 text-[0.6rem] font-semibold", cfg.color)}>
                                {cfg.label}
                              </span>
                            </div>
                            <div className="mt-2 flex gap-1.5">
                              {(["MISSING", "PENDING", "APPROVED", "EXPIRED"] as const).filter(s => s !== status).map(s => (
                                <button key={s}
                                  onClick={() => void upsertCompliance(v.id, type, s)}
                                  className={cn("rounded text-[0.55rem] px-1.5 py-0.5 font-medium transition-colors", COMPLIANCE_STATUS_CFG[s].color, "border border-current/20 hover:opacity-80")}>
                                  → {COMPLIANCE_STATUS_CFG[s].label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "units",     label: "Unidades",        icon: "⬡" },
  { id: "worklogs",  label: "Worklogs",         icon: "📋" },
  { id: "knowledge", label: "Base de conocimiento", icon: "🧠" },
  { id: "vendors",   label: "Proveedores",      icon: "🏢" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function FieldOpsPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>("units");

  return (
    <div className="min-h-screen bg-[var(--bg,#080810)] px-4 py-8">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-8">
          <Link href="/worker/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none", marginBottom: "12px" }}>
            <span style={{ fontSize: "14px" }}>←</span> Dashboard
          </Link>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand,#3b82f6)]/10 text-lg">
                🔧
              </div>
              <div>
                <h1 className="text-xl font-bold text-[var(--ink,#f7f8fa)]">{t("page.workerFieldOps")}</h1>
                <p className="text-xs text-[var(--muted,#94979e)]">
                  Gestión de unidades de campo, avances diarios y base de conocimiento
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/worker/travel"
                className="inline-flex items-center rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/15"
              >
                Movilidad y estancia
              </Link>
              <NotificationBanner audience="worker" />
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-[var(--bg-2,#111)] p-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                activeTab === tab.id
                  ? "bg-[var(--brand,#3b82f6)]/15 text-[var(--brand,#3b82f6)]"
                  : "text-[var(--muted,#94979e)] hover:text-[var(--ink,#f7f8fa)]"
              )}
            >
              <span className="text-sm" aria-hidden>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "units"     && <UnitsTab />}
          {activeTab === "worklogs"  && <WorklogsTab />}
          {activeTab === "knowledge" && <KnowledgeTab />}
          {activeTab === "vendors"   && <VendorsTab />}
        </div>
      </div>
    </div>
  );
}
