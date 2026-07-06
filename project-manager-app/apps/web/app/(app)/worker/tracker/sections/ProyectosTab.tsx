"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Archive, FolderOpen, Pencil, Plus } from "lucide-react";
import {
  archiveFreeProject,
  convertFreeProjectToJob,
  createFreeProject,
  fetchFreeProjects,
  fetchLaborEntries,
  updateFreeProject,
  type FreeProjectView,
  type TimeEntryView,
} from "../../../labor-api";
import type { JobRecordView } from "../../../../semse-api";
import {
  FREE_PROJECT_SWATCHES,
  entrySeconds,
  fieldInput,
  fieldLabel,
  fmtHours,
  sectionCard,
} from "./trackerUi";

const STATUS_META: Record<FreeProjectView["status"], { label: string; color: string }> = {
  active: { label: "Activo", color: "#059669" },
  archived: { label: "Archivado", color: "#64748b" },
  converted: { label: "Convertido a job", color: "#3b82f6" },
};

export function ProyectosTab({ jobs }: { jobs: JobRecordView[] }) {
  const [projects, setProjects] = useState<FreeProjectView[]>([]);
  const [entries, setEntries] = useState<TimeEntryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [convertJobId, setConvertJobId] = useState("");

  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(FREE_PROJECT_SWATCHES[0]);
  const [formLocation, setFormLocation] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectsResult, entriesResult] = await Promise.all([
        fetchFreeProjects(),
        fetchLaborEntries({ range: "all", limit: 500 }),
      ]);
      setProjects(projectsResult);
      setEntries(entriesResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los proyectos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const secondsByProject = useMemo(() => {
    const totals = new Map<string, number>();
    for (const entry of entries) {
      if (!entry.freeProjectId) continue;
      totals.set(entry.freeProjectId, (totals.get(entry.freeProjectId) ?? 0) + entrySeconds(entry));
    }
    return totals;
  }, [entries]);

  function startEdit(project: FreeProjectView) {
    setEditingId(project.id);
    setShowCreate(false);
    setFormName(project.name);
    setFormColor(project.color || FREE_PROJECT_SWATCHES[0]);
    setFormLocation(project.location ?? "");
    setFormDescription(project.description ?? "");
  }

  function startCreate() {
    setEditingId(null);
    setShowCreate(true);
    setFormName("");
    setFormColor(FREE_PROJECT_SWATCHES[0]);
    setFormLocation("");
    setFormDescription("");
  }

  async function handleSubmit() {
    if (saving || !formName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateFreeProject(editingId, {
          name: formName.trim(),
          color: formColor,
          location: formLocation || null,
          description: formDescription || null,
        });
      } else {
        await createFreeProject({
          name: formName.trim(),
          color: formColor,
          location: formLocation || undefined,
          description: formDescription || undefined,
        });
      }
      setShowCreate(false);
      setEditingId(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el proyecto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await archiveFreeProject(id);
      setConfirmArchiveId(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo archivar el proyecto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConvert(id: string) {
    if (saving || !convertJobId) return;
    setSaving(true);
    setError(null);
    try {
      await convertFreeProjectToJob(id, convertJobId);
      setConvertingId(null);
      setConvertJobId("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo convertir el proyecto.");
    } finally {
      setSaving(false);
    }
  }

  const formOpen = showCreate || editingId !== null;

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div style={sectionCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "6px" }}>
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <FolderOpen size={15} /> Proyectos libres
            </h3>
            <p style={{ fontSize: "11px", color: "var(--muted)", margin: "3px 0 0" }}>
              Espacios informales para registrar tiempo. Cuando el trabajo se formaliza, conviértelo en un job SEMSE con escrow y contrato.
            </p>
          </div>
          <button type="button" data-testid="labor-project-create" onClick={startCreate} style={brandButton(false)}>
            <Plus size={13} /> Nuevo proyecto
          </button>
        </div>

        {error ? <p style={{ fontSize: "12px", color: "#ef4444", margin: "8px 0 0" }}>{error}</p> : null}

        {formOpen ? (
          <div style={{ border: "1px dashed var(--border)", borderRadius: "12px", padding: "14px", marginTop: "12px", display: "grid", gap: "10px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
              <div>
                <label style={fieldLabel()}>Nombre</label>
                <input value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="Remodelación casa Pérez..." style={fieldInput()} />
              </div>
              <div>
                <label style={fieldLabel()}>Ubicación</label>
                <input value={formLocation} onChange={(event) => setFormLocation(event.target.value)} placeholder="Opcional" style={fieldInput()} />
              </div>
            </div>
            <div>
              <label style={fieldLabel()}>Descripción</label>
              <input value={formDescription} onChange={(event) => setFormDescription(event.target.value)} placeholder="Opcional" style={fieldInput()} />
            </div>
            <div>
              <label style={fieldLabel()}>Color</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {FREE_PROJECT_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => setFormColor(swatch)}
                    aria-label={`Color ${swatch}`}
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "8px",
                      background: swatch,
                      border: formColor === swatch ? "2px solid var(--ink)" : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" onClick={() => void handleSubmit()} disabled={saving || !formName.trim()} style={brandButton(saving || !formName.trim())}>
                {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear proyecto"}
              </button>
              <button type="button" onClick={() => { setShowCreate(false); setEditingId(null); }} style={ghostButton(false)}>Cancelar</button>
            </div>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div style={{ ...sectionCard, color: "var(--muted)", fontSize: "13px" }}>Cargando proyectos...</div>
      ) : projects.length === 0 ? (
        <div style={{ ...sectionCard, color: "var(--muted)", fontSize: "13px" }}>
          Aún no tienes proyectos libres. Crea uno para organizar tus horas fuera de los jobs formales.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
          {projects.map((project) => {
            const meta = STATUS_META[project.status];
            const seconds = secondsByProject.get(project.id) ?? 0;
            const convertedJob = project.convertedJobId ? jobs.find((job) => job.id === project.convertedJobId) : null;
            return (
              <div key={project.id} data-testid="labor-project-card" style={{ ...sectionCard, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ height: "4px", background: project.color || "var(--brand)" }} />
                <div style={{ padding: "16px", display: "grid", gap: "10px", flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "var(--ink)" }}>{project.name}</p>
                      {project.location ? <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted)" }}>{project.location}</p> : null}
                    </div>
                    <span style={{ padding: "3px 9px", borderRadius: "999px", background: `${meta.color}1c`, color: meta.color, fontSize: "10px", fontWeight: 800, flexShrink: 0 }}>
                      {meta.label}
                    </span>
                  </div>

                  {project.description ? (
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>{project.description}</p>
                  ) : null}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                    <span style={{ color: "var(--muted)" }}>Horas acumuladas</span>
                    <span style={{ color: "var(--ink)", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmtHours(seconds)}</span>
                  </div>

                  {convertedJob ? (
                    <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>→ Job: {convertedJob.title}</p>
                  ) : null}

                  {project.status === "active" ? (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "auto" }}>
                      <button type="button" onClick={() => startEdit(project)} style={ghostButton(saving)}>
                        <Pencil size={12} /> Editar
                      </button>
                      {confirmArchiveId === project.id ? (
                        <button type="button" onClick={() => void handleArchive(project.id)} disabled={saving} style={dangerGhostButton(saving)}>
                          Confirmar archivar
                        </button>
                      ) : (
                        <button type="button" onClick={() => setConfirmArchiveId(project.id)} style={ghostButton(saving)}>
                          <Archive size={12} /> Archivar
                        </button>
                      )}
                      {convertingId === project.id ? (
                        <div style={{ display: "flex", gap: "6px", width: "100%", marginTop: "4px" }}>
                          <select value={convertJobId} onChange={(event) => setConvertJobId(event.target.value)} style={{ ...fieldInput(), flex: 1 }}>
                            <option value="">Elegir job destino...</option>
                            {jobs.map((job) => (
                              <option key={job.id} value={job.id}>{job.title}</option>
                            ))}
                          </select>
                          <button type="button" onClick={() => void handleConvert(project.id)} disabled={saving || !convertJobId} style={brandButton(saving || !convertJobId)}>
                            Convertir
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => { setConvertingId(project.id); setConvertJobId(""); }} disabled={jobs.length === 0} style={ghostButton(jobs.length === 0)} title={jobs.length === 0 ? "Necesitas un job aceptado para convertir" : undefined}>
                          <ArrowRightLeft size={12} /> Convertir a job
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function brandButton(disabled: boolean) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    height: "34px",
    padding: "0 14px",
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

function ghostButton(disabled: boolean) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    height: "30px",
    padding: "0 10px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--muted)",
    fontSize: "11px",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  } as const;
}

function dangerGhostButton(disabled: boolean) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    height: "30px",
    padding: "0 10px",
    borderRadius: "8px",
    border: "1px solid rgba(239,68,68,.35)",
    background: "rgba(239,68,68,.1)",
    color: "#ef4444",
    fontSize: "11px",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  } as const;
}
