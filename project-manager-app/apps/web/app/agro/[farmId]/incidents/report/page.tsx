"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Info, Plus, Sparkles, Trash2 } from "lucide-react";
import { AgroFarmNav } from "../../AgroFarmNav";
import { uploadAgroEvidenceFile } from "../../agro-evidence-upload";
import {
  agroFetch, INCIDENT_TYPE_LABEL, INCIDENT_TYPES, isForbidden, MEDIA_LABEL, MEDIA_TYPES, newClientEventId,
  SEVERITIES, SEVERITY_LABEL, STATUS_LABEL,
} from "../../agro-ops";

type Context = {
  units: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string; species: string; count: number }>;
  animals: Array<{ id: string; tagCode: string | null; species: string }>;
};
type Proposal = {
  intent: "INCIDENT" | "TASK_COMPLETION" | "UNKNOWN";
  confidence: number;
  engine: string;
  disclaimer: string;
  incident?: { type: string; suggestedSeverity: string; title: string; description: string; relations: { farmUnitId: string | null; animalGroupId: string | null; animalId: string | null } };
  duplicateCandidates?: Array<{ id: string; title: string; status: string }>;
  taskMatches?: Array<{ task: { id: string; source: string; title: string; status: string }; score: number; reasons: string[] }>;
  recommendedAction: { kind: string; question?: string; task?: { title: string } };
};
type EvidenceDraft = { mediaType: string; fileUrl: string; note: string };
type Draft = {
  clientEventId: string; text: string; type: string; severity: string; title: string; description: string;
  farmUnitId: string; animalGroupId: string; animalId: string; evidence: EvidenceDraft[]; usedProposal: boolean;
  proposalMeta?: { engine: string; confidence: number; action: string };
};

const DRAFT_KEY = (farmId: string) => `semse:agro:incident-draft:${farmId}`;

function emptyDraft(): Draft {
  return {
    clientEventId: newClientEventId(), text: "", type: "", severity: "", title: "", description: "",
    farmUnitId: "", animalGroupId: "", animalId: "", evidence: [], usedProposal: false,
  };
}

function loadDraft(farmId: string): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(farmId));
    return raw ? { ...emptyDraft(), ...JSON.parse(raw) } : emptyDraft();
  } catch { return emptyDraft(); }
}

export default function ReportIncidentPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [step, setStep] = useState<"describe" | "review">("describe");
  const [context, setContext] = useState<Context | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState<"" | "analyze" | "submit">("");
  const [error, setError] = useState<string | null>(null);
  const [savedLocally, setSavedLocally] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!farmId) return;
    const d = loadDraft(farmId);
    setDraft(d);
    if (d.type) { setStep("review"); setSavedLocally(true); }
    agroFetch<Context>(`/farms/${encodeURIComponent(farmId)}/incidents/context`)
      .then(setContext)
      .catch((e) => (isForbidden(e) ? setForbidden(true) : setContextError(e.message)));
  }, [farmId]);

  // El borrador vive en el dispositivo hasta que el servidor confirma (offline / señal débil).
  useEffect(() => {
    if (!farmId) return;
    try { localStorage.setItem(DRAFT_KEY(farmId), JSON.stringify(draft)); } catch { /* almacenamiento no disponible */ }
  }, [farmId, draft]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function analyze() {
    if (!draft.text.trim()) return;
    setBusy("analyze"); setError(null);
    try {
      const { proposal: p } = await agroFetch<{ proposal: Proposal }>(`/farms/${encodeURIComponent(farmId)}/intake`, { method: "POST", body: { text: draft.text } });
      setProposal(p);
      if (p.intent === "INCIDENT" && p.incident) {
        setDraft((d) => ({
          ...d, usedProposal: true, type: p.incident!.type, severity: p.incident!.suggestedSeverity,
          title: p.incident!.title, description: p.incident!.description,
          farmUnitId: p.incident!.relations.farmUnitId ?? "", animalGroupId: p.incident!.relations.animalGroupId ?? "",
          animalId: p.incident!.relations.animalId ?? "",
          proposalMeta: { engine: p.engine, confidence: p.confidence, action: p.recommendedAction.kind },
        }));
        setStep("review");
      }
    } catch (e: any) {
      setError(`Prometeo no pudo analizar el reporte (${e.message}). Puedes clasificarlo manualmente.`);
    } finally { setBusy(""); }
  }

  // T-053: sube el archivo elegido (presign → PUT) y guarda la URL real en la
  // fila; antes "Enlace del archivo" era texto libre, así que nadie subía nada.
  async function handleEvidenceFile(idx: number, file: File) {
    setUploadingIdx((m) => ({ ...m, [idx]: true }));
    try {
      const url = await uploadAgroEvidenceFile(file);
      set("evidence", draft.evidence.map((x, i) => (i === idx ? { ...x, fileUrl: url } : x)));
    } catch (e: any) {
      setError(e?.message ?? "No se pudo subir el archivo");
    } finally {
      setUploadingIdx((m) => { const n = { ...m }; delete n[idx]; return n; });
    }
  }

  function manual() {
    setDraft((d) => ({ ...d, usedProposal: false, type: d.type || "OTHER", title: d.title || d.text.slice(0, 120), description: d.description || d.text }));
    setStep("review");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("submit"); setError(null);
    try {
      const body = {
        type: draft.type, title: draft.title.trim(), description: draft.description || undefined,
        severity: draft.severity || undefined,
        farmUnitId: draft.farmUnitId || undefined, animalGroupId: draft.animalGroupId || undefined, animalId: draft.animalId || undefined,
        source: draft.usedProposal ? "PROMETEO" : "MOBILE",
        clientEventId: draft.clientEventId,
        evidence: draft.evidence
          .filter((ev) => ev.fileUrl.trim() || ev.note.trim())
          .map((ev) => ({ mediaType: ev.mediaType, fileUrl: ev.fileUrl.trim() || undefined, note: ev.note.trim() || undefined })),
        ...(draft.proposalMeta && { metadata: { prometeo: draft.proposalMeta, originalText: draft.text } }),
      };
      const res = await agroFetch<{ incident: { id: string } }>(`/farms/${encodeURIComponent(farmId)}/incidents`, { method: "POST", body });
      try { localStorage.removeItem(DRAFT_KEY(farmId)); } catch { /* noop */ }
      router.push(`/agro/${farmId}/incidents/${res.incident.id}`);
    } catch (e: any) {
      // Error de red: el borrador queda en el dispositivo y el reintento es idempotente (clientEventId).
      setSavedLocally(true);
      setError(e?.message ?? "Error de red");
      setBusy("");
    }
  }

  const species = (s: string) => ({ PIG: "Cerdo", CATTLE: "Bovino", CHICKEN: "Ave", GOAT: "Cabra", SHEEP: "Oveja", HORSE: "Equino" } as Record<string, string>)[s] ?? s;

  if (forbidden) {
    return (
      <div className="agro-shell">
        <AgroFarmNav farmId={farmId} crumbs={[{ label: "Incidencias", href: `/agro/${farmId}/incidents` }, { label: "Reportar" }]} />
        <div className="empty-state"><p className="empty-title">Sin acceso a esta finca</p><p className="empty-desc">Solo los miembros de la finca pueden reportar.</p></div>
      </div>
    );
  }

  return (
    <div className="agro-shell" style={{ maxWidth: 640 }}>
      <AgroFarmNav farmId={farmId} crumbs={[{ label: "Incidencias", href: `/agro/${farmId}/incidents` }, { label: "Reportar" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>Reportar un problema</h1>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
        Paso {step === "describe" ? "1" : "2"} de 2 · {step === "describe" ? "Cuéntalo con tus palabras" : "Revisa y confirma"}
      </p>

      {savedLocally && (
        <div className="alert-banner" role="status" style={{ marginBottom: 12 }}>
          Borrador guardado en este dispositivo. Al reenviar no se duplicará la incidencia.
        </div>
      )}
      {error && <div className="alert-banner alert-critical" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      {contextError && <div className="alert-banner" role="status" style={{ marginBottom: 12 }}>No se cargaron corrales/lotes ({contextError}); puedes reportar igual.</div>}

      {step === "describe" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            <span className="fl">¿Qué pasó y dónde?</span>
            <textarea className="fi" rows={5} value={draft.text} onChange={(e) => set("text", e.target.value)} autoFocus
              placeholder="Ej. Al lote 15 le falta agua · Este cerdito tiene una herida en el cachete" />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn-accent" onClick={() => void analyze()} disabled={!draft.text.trim() || busy !== ""} style={{ flex: 1, minWidth: 180 }}>
              <Sparkles size={13} aria-hidden /> {busy === "analyze" ? "Analizando…" : "Analizar con Prometeo"}
            </button>
            <button type="button" className="btn-ghost" onClick={manual} disabled={!draft.text.trim() || busy !== ""}>Clasificar manualmente</button>
          </div>

          {proposal && proposal.intent === "TASK_COMPLETION" && (
            <div className="alert-banner" role="status">
              <strong>Esto parece trabajo realizado, no un problema.</strong>{" "}
              {proposal.recommendedAction.kind === "COMPLETE_TASK" && proposal.recommendedAction.task
                ? <>Coincide con la tarea pendiente “{proposal.recommendedAction.task.title}”. </>
                : <>No hay una tarea pendiente que coincida. </>}
              <Link href={`/agro/${farmId}/tasks`}>Ir a tareas</Link> para marcarla, o clasifícalo manualmente si es un problema.
            </div>
          )}
          {proposal && proposal.intent === "UNKNOWN" && (
            <div className="alert-banner" role="status">{proposal.recommendedAction.question} Puedes clasificarlo manualmente.</div>
          )}
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {proposal?.disclaimer && draft.usedProposal && (
            <p style={{ display: "flex", gap: 6, fontSize: 11, color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
              <Info size={14} aria-hidden style={{ flexShrink: 0 }} /> Propuesta de Prometeo ({Math.round((proposal.confidence ?? 0) * 100)}% de confianza). {proposal.disclaimer}
            </p>
          )}
          {proposal?.duplicateCandidates && proposal.duplicateCandidates.length > 0 && (
            <div className="alert-banner" role="status">
              Ya hay incidencias abiertas parecidas:{" "}
              {proposal.duplicateCandidates.map((d, i) => (
                <span key={d.id}>{i > 0 && ", "}<Link href={`/agro/${farmId}/incidents/${d.id}`}>{d.title}</Link> ({STATUS_LABEL[d.status] ?? d.status})</span>
              ))}. Si es la misma, agrega tu evidencia allí en vez de crear otra.
            </div>
          )}

          <label><span className="fl">Tipo *</span>
            <select className="fi" value={draft.type} onChange={(e) => set("type", e.target.value)} required>
              <option value="" disabled>Selecciona…</option>
              {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{INCIDENT_TYPE_LABEL[t]}</option>)}
            </select>
          </label>
          <label><span className="fl">Título *</span>
            <input className="fi" value={draft.title} onChange={(e) => set("title", e.target.value)} required maxLength={200} />
          </label>
          <label><span className="fl">Descripción</span>
            <textarea className="fi" rows={3} value={draft.description} onChange={(e) => set("description", e.target.value)} />
          </label>
          <label><span className="fl">Severidad sugerida</span>
            <select className="fi" value={draft.severity} onChange={(e) => set("severity", e.target.value)}>
              <option value="">Que la defina el supervisor</option>
              {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
            </select>
            <span style={{ fontSize: 11, color: "var(--faint)" }}>Un supervisor la confirmará al clasificar.</span>
          </label>

          <fieldset style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
            <legend className="fl" style={{ padding: "0 4px" }}>¿Dónde / a quién afecta?</legend>
            <label><span className="fl">Corral / unidad</span>
              <select className="fi" value={draft.farmUnitId} onChange={(e) => set("farmUnitId", e.target.value)}>
                <option value="">—</option>
                {context?.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label><span className="fl">Lote / grupo</span>
              <select className="fi" value={draft.animalGroupId} onChange={(e) => set("animalGroupId", e.target.value)}>
                <option value="">—</option>
                {context?.groups.map((g) => <option key={g.id} value={g.id}>{g.name} · {species(g.species)} ({g.count})</option>)}
              </select>
            </label>
            <label><span className="fl">Animal</span>
              <select className="fi" value={draft.animalId} onChange={(e) => set("animalId", e.target.value)}>
                <option value="">—</option>
                {context?.animals.filter((a) => a.tagCode).map((a) => <option key={a.id} value={a.id}>{a.tagCode} · {species(a.species)}</option>)}
              </select>
            </label>
          </fieldset>

          <fieldset style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
            <legend className="fl" style={{ padding: "0 4px" }}>Evidencia (foto, video, audio, documento…)</legend>
            {draft.evidence.map((ev, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 1fr) 2fr auto", gap: 6, alignItems: "start" }}>
                <select className="fi" aria-label="Tipo de evidencia" value={ev.mediaType}
                  onChange={(e) => set("evidence", draft.evidence.map((x, i) => (i === idx ? { ...x, mediaType: e.target.value } : x)))}>
                  {MEDIA_TYPES.map((m) => <option key={m} value={m}>{MEDIA_LABEL[m]}</option>)}
                </select>
                {ev.mediaType === "NOTE" || ev.mediaType === "MEASUREMENT" ? (
                  <input className="fi" aria-label="Nota" placeholder={ev.mediaType === "MEASUREMENT" ? "Ej. 38.5 °C" : "Nota"} value={ev.note}
                    onChange={(e) => set("evidence", draft.evidence.map((x, i) => (i === idx ? { ...x, note: e.target.value } : x)))} />
                ) : ev.mediaType === "EXTERNAL_URL" ? (
                  <input className="fi" type="url" aria-label="Enlace" placeholder="https://…" value={ev.fileUrl}
                    onChange={(e) => set("evidence", draft.evidence.map((x, i) => (i === idx ? { ...x, fileUrl: e.target.value } : x)))} />
                ) : (
                  <div>
                    <input className="fi" type="file" aria-label="Archivo"
                      accept={ev.mediaType === "PHOTO" ? "image/*" : ev.mediaType === "VIDEO" ? "video/*" : ev.mediaType === "AUDIO" ? "audio/*" : undefined}
                      disabled={!!uploadingIdx[idx]}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleEvidenceFile(idx, f); e.target.value = ""; }} />
                    {uploadingIdx[idx] && <p style={{ fontSize: 11, color: "var(--muted)" }}>Subiendo…</p>}
                    {!uploadingIdx[idx] && ev.fileUrl && <p style={{ fontSize: 11, color: "var(--ok)" }}>Archivo listo ✓</p>}
                  </div>
                )}
                <button type="button" className="btn-ghost" aria-label="Quitar evidencia" onClick={() => set("evidence", draft.evidence.filter((_, i) => i !== idx))}>
                  <Trash2 size={13} aria-hidden />
                </button>
              </div>
            ))}
            {draft.evidence.length < 10 && (
              <button type="button" className="btn-ghost" onClick={() => set("evidence", [...draft.evidence, { mediaType: "PHOTO", fileUrl: "", note: "" }])}>
                <Plus size={13} aria-hidden /> Agregar evidencia
              </button>
            )}
          </fieldset>

          <div style={{ display: "flex", gap: 8, position: "sticky", bottom: 0, padding: "10px 0", background: "var(--bg, var(--surface))", borderTop: "1px solid var(--border)" }}>
            <button type="submit" className="btn-accent"
              disabled={busy !== "" || !draft.type || !draft.title.trim() || Object.keys(uploadingIdx).length > 0}
              style={{ flex: 1 }}>
              {busy === "submit" ? "Enviando…" : savedLocally ? "Reintentar envío" : "Crear incidencia"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setStep("describe")}>Atrás</button>
            <button type="button" className="btn-ghost" onClick={() => { setDraft(emptyDraft()); setProposal(null); setStep("describe"); setSavedLocally(false); }}>
              Descartar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
