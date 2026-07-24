"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Plus, Search } from "lucide-react";
import {
  createManualEntry,
  fetchFreeProjects,
  fetchLaborEntries,
  type FreeProjectView,
  type TimeEntryView,
} from "../../../labor-api";
import type { JobRecordView } from "../../../../semse-api";
import {
  createTrackerEventId,
  enqueueTrackerEvent,
  readTrackerLocalState,
  writeTrackerLocalState,
  type TrackerLocalState,
  type TrackerPendingEvent,
} from "../trackerLocalStore";
import {
  BarList,
  formatCostSummary,
  KpiCard,
  pendingLocalEntries,
  PURPOSE_CHART_COLORS,
  PURPOSE_SHORT_LABELS,
  PurposeChip,
  entryCost,
  entrySeconds,
  entryDateLabel,
  entryTimeRange,
  exportEntriesCsv,
  fieldInput,
  fieldLabel,
  fmtHours,
  fmtMoney,
  friendlyConnectionMessage,
  resolveEntryProject,
  sectionCard,
  shouldPreserveLocalEvent,
} from "./trackerUi";

type EntriesRange = "week" | "month" | "all";
type PurposeFilter = "all" | TimeEntryView["purpose"];

const STATUS_LABELS: Record<TimeEntryView["status"], string> = {
  running: "Corriendo",
  paused: "En pausa",
  completed: "Completada",
  pending_review: "En revisión",
  approved: "Aprobada",
  deleted: "Eliminada",
  pending_sync: "Pendiente de sincronizar",
};

export function RegistrosTab({ jobs }: { jobs: JobRecordView[] }) {
  const [entries, setEntries] = useState<TimeEntryView[]>([]);
  const [freeProjects, setFreeProjects] = useState<FreeProjectView[]>([]);
  const [localState, setLocalState] = useState<TrackerLocalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [range, setRange] = useState<EntriesRange>("week");
  const [purposeFilter, setPurposeFilter] = useState<PurposeFilter>("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formPurpose, setFormPurpose] = useState<TimeEntryView["purpose"]>("personal");
  const [formJobId, setFormJobId] = useState("");
  const [formFreeProjectId, setFormFreeProjectId] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formStart, setFormStart] = useState("08:00");
  const [formEnd, setFormEnd] = useState("16:00");
  const [formBreak, setFormBreak] = useState("30");
  const [formRate, setFormRate] = useState("");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formLocation, setFormLocation] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const loadEntries = useCallback(async (nextRange: EntriesRange) => {
    setLoading(true);
    setError(null);
    try {
      const [entriesResult, projectsResult] = await Promise.all([
        fetchLaborEntries({ range: nextRange, limit: 500 }),
        fetchFreeProjects(),
      ]);
      setEntries(entriesResult);
      setFreeProjects(projectsResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los registros.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries(range);
  }, [loadEntries, range]);

  // Sesión activa aún no confirmada + entradas manuales encoladas offline
  // (trackerLocalStore) — sin esto, los totales de abajo solo cuentan lo ya
  // sincronizado con el backend. Ver docs/AUDIT_REMEDIATION_PLAN.md 2.3.
  useEffect(() => {
    setLocalState(readTrackerLocalState(window.localStorage));
  }, []);

  const pendingEntries = useMemo(
    () => (localState ? pendingLocalEntries(localState) : []),
    [localState]
  );

  const entriesWithPending = useMemo(
    () => (pendingEntries.length > 0 ? [...entries, ...pendingEntries] : entries),
    [entries, pendingEntries]
  );

  const filtered = useMemo(() => entriesWithPending.filter((entry) => {
    if (purposeFilter !== "all" && entry.purpose !== purposeFilter) return false;
    if (projectFilter !== "all") {
      if (projectFilter.startsWith("fp:") && entry.freeProjectId !== projectFilter.slice(3)) return false;
      if (projectFilter.startsWith("job:") && entry.jobId !== projectFilter.slice(4)) return false;
    }
    if (search.trim()) {
      const haystack = `${entry.notes ?? ""} ${entry.location ?? ""}`.toLowerCase();
      if (!haystack.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  }), [entriesWithPending, projectFilter, purposeFilter, search]);

  const totals = useMemo(() => {
    const seconds = filtered.reduce((sum, entry) => sum + entrySeconds(entry), 0);
    const costSummary = formatCostSummary(filtered);
    const days = new Set(filtered.map((entry) => entry.startedAt.slice(0, 10))).size;
    return { seconds, costSummary, days };
  }, [filtered]);

  const purposeBars = useMemo(() => (
    (Object.keys(PURPOSE_SHORT_LABELS) as TimeEntryView["purpose"][])
      .map((purpose) => ({
        label: PURPOSE_SHORT_LABELS[purpose],
        value: filtered.filter((entry) => entry.purpose === purpose).reduce((sum, entry) => sum + entrySeconds(entry), 0),
        color: PURPOSE_CHART_COLORS[purpose],
      }))
      .filter((item) => item.value > 0)
  ), [filtered]);

  const durationPreview = useMemo(() => {
    const start = new Date(`${formDate}T${formStart}:00`);
    let end = new Date(`${formDate}T${formEnd}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    if (end <= start) {
      // Overnight shift (e.g. 22:00-06:00): mirror the backend's rule (labor-engine.service.ts)
      // and treat endTime as landing on the next calendar day instead of flagging it invalid.
      if (formStart > formEnd) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      } else {
        return null;
      }
    }
    const breakMinutes = Math.max(0, Number(formBreak) || 0);
    const seconds = Math.floor((end.getTime() - start.getTime()) / 1000) - breakMinutes * 60;
    return seconds > 0 ? seconds : null;
  }, [formBreak, formDate, formEnd, formStart]);

  async function handleManualSave() {
    if (saving || durationPreview === null) return;
    if (formPurpose === "job_linked" && !formJobId) {
      setError("Selecciona el job formal al que se asocia el registro.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);

    const jobId = formPurpose === "job_linked" ? formJobId : undefined;
    const freeProjectId = formPurpose !== "job_linked" && formFreeProjectId ? formFreeProjectId : undefined;
    const breakMinutes = Math.max(0, Number(formBreak) || 0);
    const hourlyRate = formRate ? Number(formRate) : undefined;
    const location = formLocation || undefined;
    const notes = formNotes || undefined;

    try {
      await createManualEntry({
        purpose: formPurpose,
        jobId,
        freeProjectId,
        date: formDate,
        startTime: formStart,
        endTime: formEnd,
        breakMinutes,
        hourlyRate,
        currency: formCurrency,
        location,
        notes,
      });
      setShowForm(false);
      setFormNotes("");
      setNotice(`Registro guardado: ${fmtHours(durationPreview)}.`);
      await loadEntries(range);
    } catch (caught) {
      // Mismo fallback offline que el Timer tab (page.tsx handleManualSave):
      // si el registro no llegó al backend por falta de conexión o un 5xx, se
      // encola en el mismo almacén local del tracker en vez de perderse. Antes
      // este formulario no tenía este fallback (ver AUDIT_REMEDIATION_PLAN.md 2.5).
      if (shouldPreserveLocalEvent(caught)) {
        const event: TrackerPendingEvent = {
          id: createTrackerEventId(),
          type: "manual_session",
          purpose: formPurpose,
          jobId,
          freeProjectId,
          date: formDate,
          startTime: formStart,
          endTime: formEnd,
          breakMinutes,
          hourlyRate,
          currency: formCurrency,
          location,
          notes,
          localTimestamp: new Date().toISOString(),
        };
        const nextState = enqueueTrackerEvent(readTrackerLocalState(window.localStorage), event);
        writeTrackerLocalState(window.localStorage, nextState);
        setLocalState(nextState);
        setShowForm(false);
        setFormNotes("");
        setNotice(friendlyConnectionMessage("No pudimos guardar el registro en SEMSE ahora"));
      } else {
        setError(caught instanceof Error ? caught.message : "No se pudo guardar el registro manual.");
      }
    } finally {
      setSaving(false);
    }
  }

  const resolveProject = useCallback(
    (entry: TimeEntryView) => resolveEntryProject(entry, freeProjects, jobs),
    [freeProjects, jobs]
  );

  const rangeLabel = range === "week" ? "7 días" : range === "month" ? "30 días" : "todo";

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
        <KpiCard label="Horas del filtro" value={fmtHours(totals.seconds)} color="#3b82f6" hint={`${filtered.length} registros · ${rangeLabel}`} />
        <KpiCard label="Días con actividad" value={String(totals.days)} color="#059669" hint={totals.days > 0 ? `${fmtHours(Math.round(totals.seconds / totals.days))} promedio/día` : undefined} />
        <KpiCard label="Costo estimado" value={totals.costSummary} color="var(--accent)" hint="según tarifas registradas" />
      </div>

      <div style={sectionCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink)", margin: 0 }}>Registros de horas</h3>
            <p style={{ fontSize: "11px", color: "var(--muted)", margin: "3px 0 0" }}>
              Inmutables una vez guardados: el historial es la fuente auditable para pagos y disputas.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => exportEntriesCsv(filtered, resolveProject, `semse-registros-${range}.csv`)}
              disabled={filtered.length === 0}
              style={toolbarButton(filtered.length === 0)}
            >
              <Download size={13} /> CSV
            </button>
            <button type="button" data-testid="labor-manual-toggle" onClick={() => setShowForm((current) => !current)} style={toolbarButton(false)}>
              <Plus size={13} /> Entrada manual
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "8px", marginBottom: "14px" }}>
          <select value={range} onChange={(event) => setRange(event.target.value as EntriesRange)} style={fieldInput()} aria-label="Rango">
            <option value="week">Últimos 7 días</option>
            <option value="month">Últimos 30 días</option>
            <option value="all">Todo el historial</option>
          </select>
          <select value={purposeFilter} onChange={(event) => setPurposeFilter(event.target.value as PurposeFilter)} style={fieldInput()} aria-label="Propósito">
            <option value="all">Todos los propósitos</option>
            <option value="personal">{PURPOSE_SHORT_LABELS.personal}</option>
            <option value="payable">{PURPOSE_SHORT_LABELS.payable}</option>
            <option value="job_linked">{PURPOSE_SHORT_LABELS.job_linked}</option>
          </select>
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} style={fieldInput()} aria-label="Proyecto">
            <option value="all">Todos los proyectos</option>
            {freeProjects.map((project) => (
              <option key={project.id} value={`fp:${project.id}`}>{project.name}</option>
            ))}
            {jobs.map((job) => (
              <option key={job.id} value={`job:${job.id}`}>Job · {job.title}</option>
            ))}
          </select>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar en notas o ubicación..."
              style={{ ...fieldInput(), paddingLeft: "28px" }}
            />
          </div>
        </div>

        {notice ? (
          <p style={{ fontSize: "12px", color: "#059669", margin: "0 0 10px" }}>{notice}</p>
        ) : null}
        {error ? (
          <p style={{ fontSize: "12px", color: "#ef4444", margin: "0 0 10px" }}>{error}</p>
        ) : null}

        {showForm ? (
          <div style={{ border: "1px dashed var(--border)", borderRadius: "12px", padding: "14px", marginBottom: "14px", display: "grid", gap: "10px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
              <div>
                <label style={fieldLabel()}>Propósito</label>
                <select value={formPurpose} onChange={(event) => setFormPurpose(event.target.value as TimeEntryView["purpose"])} style={fieldInput()}>
                  <option value="personal">{PURPOSE_SHORT_LABELS.personal} — solo calcular</option>
                  <option value="payable">{PURPOSE_SHORT_LABELS.payable} — posible pago</option>
                  <option value="job_linked">{PURPOSE_SHORT_LABELS.job_linked} — job SEMSE</option>
                </select>
              </div>
              {formPurpose === "job_linked" ? (
                <div>
                  <label style={fieldLabel()}>Job formal</label>
                  <select value={formJobId} onChange={(event) => setFormJobId(event.target.value)} style={fieldInput()}>
                    <option value="">Seleccionar job...</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>{job.title}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={fieldLabel()}>Proyecto libre (opcional)</label>
                  <select value={formFreeProjectId} onChange={(event) => setFormFreeProjectId(event.target.value)} style={fieldInput()}>
                    <option value="">Sin proyecto</option>
                    {freeProjects.filter((project) => project.status === "active").map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label style={fieldLabel()}>Fecha</label>
                <input type="date" value={formDate} onChange={(event) => setFormDate(event.target.value)} style={fieldInput()} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" }}>
              <div>
                <label style={fieldLabel()}>Entrada</label>
                <input type="time" value={formStart} onChange={(event) => setFormStart(event.target.value)} style={fieldInput()} />
              </div>
              <div>
                <label style={fieldLabel()}>Salida</label>
                <input type="time" value={formEnd} onChange={(event) => setFormEnd(event.target.value)} style={fieldInput()} />
              </div>
              <div>
                <label style={fieldLabel()}>Descanso (min)</label>
                <input type="number" min="0" value={formBreak} onChange={(event) => setFormBreak(event.target.value)} style={fieldInput()} />
              </div>
              <div>
                <label style={fieldLabel()}>Tarifa/hora</label>
                <input type="number" min="0" step="0.5" value={formRate} onChange={(event) => setFormRate(event.target.value)} placeholder="Opcional" style={fieldInput()} />
              </div>
              <div>
                <label style={fieldLabel()}>Moneda</label>
                <select value={formCurrency} onChange={(event) => setFormCurrency(event.target.value)} style={fieldInput()}>
                  <option value="USD">USD</option>
                  <option value="MXN">MXN</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
              <div>
                <label style={fieldLabel()}>Ubicación</label>
                <input value={formLocation} onChange={(event) => setFormLocation(event.target.value)} placeholder="Obra, dirección..." style={fieldInput()} />
              </div>
              <div>
                <label style={fieldLabel()}>Notas</label>
                <input value={formNotes} onChange={(event) => setFormNotes(event.target.value)} placeholder="Actividad realizada..." style={fieldInput()} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                data-testid="labor-manual-save"
                onClick={() => void handleManualSave()}
                disabled={saving || durationPreview === null || (formPurpose === "job_linked" && !formJobId)}
                style={primaryToolbarButton(saving || durationPreview === null || (formPurpose === "job_linked" && !formJobId))}
              >
                {saving ? "Guardando..." : "Guardar registro"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={toolbarButton(false)}>Cancelar</button>
              <span style={{ fontSize: "12px", color: durationPreview === null ? "#ef4444" : "var(--muted)" }}>
                Duración neta: {durationPreview === null ? "rango inválido" : fmtHours(durationPreview)}
              </span>
            </div>
          </div>
        ) : null}

        {purposeBars.length > 1 ? (
          <div style={{ marginBottom: "14px" }}>
            <BarList items={purposeBars} valueFmt={fmtHours} emptyText="" />
          </div>
        ) : null}

        <div style={{ display: "grid", gap: "8px" }}>
          {loading ? (
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>Cargando registros...</p>
          ) : filtered.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>No hay registros que coincidan con estos filtros.</p>
          ) : (
            filtered.map((entry) => {
              const project = resolveProject(entry);
              const cost = entryCost(entry);
              return (
                <div key={entry.id} data-testid="labor-entry-row" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--bg)", flexWrap: "wrap" }}>
                  <div style={{ width: "4px", alignSelf: "stretch", borderRadius: "999px", background: project.color, flexShrink: 0, minHeight: "34px" }} />
                  <div style={{ flex: 1, minWidth: "180px" }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{project.label}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted)" }}>
                      {entryDateLabel(entry)} · {entryTimeRange(entry)}
                      {entry.breakMinutes > 0 ? ` · ${entry.breakMinutes}m descanso` : ""}
                      {entry.location ? ` · ${entry.location}` : ""}
                      {entry.notes ? ` · ${entry.notes}` : ""}
                    </p>
                  </div>
                  <PurposeChip purpose={entry.purpose} />
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)", flexShrink: 0 }}>
                    {entry.mode === "manual" ? "Manual" : "Timer"} · {STATUS_LABELS[entry.status]}
                  </span>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{fmtHours(entrySeconds(entry))}</p>
                    {cost != null ? <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>{fmtMoney(cost, entry.currency)}</p> : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function toolbarButton(disabled: boolean) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    height: "34px",
    padding: "0 12px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--ink)",
    fontSize: "12px",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  } as const;
}

function primaryToolbarButton(disabled: boolean) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    height: "34px",
    padding: "0 16px",
    borderRadius: "8px",
    border: "none",
    background: "var(--brand)",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  } as const;
}
