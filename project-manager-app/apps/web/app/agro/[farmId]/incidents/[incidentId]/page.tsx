"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { AgroFarmNav } from "../../AgroFarmNav";
import {
  agroFetch, FARM_ROLE_LABEL, fmtDateTime, INCIDENT_TYPE_LABEL, INCIDENT_TYPES, isForbidden, MEDIA_LABEL, MEDIA_TYPES,
  SEVERITIES, SEVERITY_BADGE, SEVERITY_LABEL, shortId, STATUS_BADGE, STATUS_LABEL, TIMELINE_LABEL, TRANSITION_LABEL,
} from "../../agro-ops";

type Detail = {
  incident: {
    id: string; title: string; description: string | null; type: string; severity: string; severityConfirmed: boolean;
    status: string; source: string; detectedAt: string; occurredAt: string | null; resolvedAt: string | null; closedAt: string | null;
    resolution: string | null; cancelReason: string | null; duplicateOfId: string | null;
    reportedById: string; assignedToId: string | null; relatedTaskSource: string | null; relatedTaskId: string | null;
    farmUnit: { name: string } | null; animal: { tagCode: string | null; species: string } | null;
    animalGroup: { name: string } | null; cropCycle: { cropName: string } | null; inventoryItem: { name: string } | null;
  };
  evidence: Array<{ id: string; mediaType: string; title: string | null; note: string | null; fileUrl: string | null; capturedAt: string; capturedById: string | null }>;
  timeline: Array<{ id: string; action: string; actorId: string | null; createdAt: string; before: any; after: any; source: string }>;
  relatedTask: { source: string; id: string; title?: string; status?: string; missing?: boolean } | null;
  viewer: {
    role: string; isAssignee: boolean; transitions: string[]; canTriage: boolean; canAssign: boolean; canLinkTask: boolean;
    canComment: boolean; canAssess: boolean; canAddEvidence: boolean;
  };
};
type Members = { owner: { userId: string } | null; members: Array<{ userId: string; role: string; status: string; displayName: string | null }> };

function timelineDetail(e: Detail["timeline"][number]): string | null {
  const a = e.after ?? {};
  switch (e.action) {
    case "incident.comment_added":
    case "incident.assessment_added": return a.body ?? null;
    case "incident.severity_changed": return `${SEVERITY_LABEL[e.before?.severity] ?? e.before?.severity} → ${SEVERITY_LABEL[a.severity] ?? a.severity}${a.reason ? ` · ${a.reason}` : ""}`;
    case "incident.type_changed": return `${INCIDENT_TYPE_LABEL[e.before?.type] ?? ""} → ${INCIDENT_TYPE_LABEL[a.type] ?? a.type}`;
    case "incident.assigned": return `Responsable: ${shortId(a.assignedToId)}`;
    case "incident.task_linked": return a.title ? `${a.title} (${a.source})` : null;
    case "incident.evidence_added": return MEDIA_LABEL[a.mediaType] ?? a.mediaType;
    case "incident.resolved": return a.resolution ?? null;
    case "incident.cancelled":
    case "incident.reopened": return a.reason ?? null;
    default: return null;
  }
}

export default function IncidentDetailPage() {
  const { farmId, incidentId } = useParams<{ farmId: string; incidentId: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [members, setMembers] = useState<Members | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [transitionTo, setTransitionTo] = useState<string | null>(null);
  const [transitionText, setTransitionText] = useState("");
  const [severity, setSeverity] = useState("");
  const [type, setType] = useState("");
  const [severityReason, setSeverityReason] = useState("");
  const [comment, setComment] = useState("");
  const [commentKind, setCommentKind] = useState<"COMMENT" | "ASSESSMENT">("COMMENT");
  const [evMedia, setEvMedia] = useState("PHOTO");
  const [evValue, setEvValue] = useState("");
  const [taskSource, setTaskSource] = useState("AGRO_FARM_TASK");
  const [taskId, setTaskId] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await agroFetch<Detail>(`/incidents/${encodeURIComponent(incidentId)}`);
      setDetail(d);
      setSeverity(d.incident.severity); setType(d.incident.type);
      if (d.viewer.canAssign && !members) {
        agroFetch<Members>(`/farms/${encodeURIComponent(farmId)}/members`).then(setMembers).catch(() => setMembers(null));
      }
    } catch (e: any) {
      if (isForbidden(e)) setForbidden(true); else setError(e.message);
    } finally { setLoading(false); }
  }, [incidentId, farmId, members]);

  useEffect(() => { void load(); }, [incidentId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(path: string, body: unknown, method: "POST" | "PATCH" = "POST") {
    setBusy(true); setActionError(null);
    try {
      await agroFetch(`/incidents/${encodeURIComponent(incidentId)}${path}`, { method, body });
      await load();
      return true;
    } catch (e: any) {
      setActionError(e.message);
      return false;
    } finally { setBusy(false); }
  }

  if (loading) return <div className="agro-shell"><div className="skel" style={{ height: 160 }} aria-busy="true" /></div>;
  if (forbidden) {
    return (
      <div className="agro-shell">
        <AgroFarmNav farmId={farmId} crumbs={[{ label: "Incidencias", href: `/agro/${farmId}/incidents` }]} />
        <div className="empty-state"><AlertTriangle size={36} className="empty-icon" aria-hidden /><p className="empty-title">Incidencia no disponible</p><p className="empty-desc">No existe o no tienes acceso a esta finca.</p></div>
      </div>
    );
  }
  if (error || !detail) {
    return (
      <div className="agro-shell">
        <AgroFarmNav farmId={farmId} crumbs={[{ label: "Incidencias", href: `/agro/${farmId}/incidents` }]} />
        <div className="alert-banner alert-critical" role="alert">No se pudo cargar la incidencia: {error}</div>
        <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => { setLoading(true); void load(); }}>Reintentar</button>
      </div>
    );
  }

  const { incident: i, viewer: v } = detail;
  const needsText = transitionTo === "RESOLVED" || transitionTo === "CANCELLED" || transitionTo === "DUPLICATE";
  const people = members ? [
    ...(members.owner ? [{ userId: members.owner.userId, label: `${FARM_ROLE_LABEL.OWNER}` }] : []),
    ...members.members.filter((m) => m.status === "ACTIVE").map((m) => ({ userId: m.userId, label: `${m.displayName ?? shortId(m.userId)} · ${FARM_ROLE_LABEL[m.role] ?? m.role}` })),
  ] : [];
  const card: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", padding: 14, marginBottom: 12 };

  return (
    <div className="agro-shell">
      <AgroFarmNav farmId={farmId} crumbs={[{ label: "Incidencias", href: `/agro/${farmId}/incidents` }, { label: shortId(i.id) }]} />

      <header style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          <span className={STATUS_BADGE[i.status] ?? "badge badge-slate"}>{STATUS_LABEL[i.status] ?? i.status}</span>
          <span className={SEVERITY_BADGE[i.severity] ?? "badge badge-slate"}>
            {SEVERITY_LABEL[i.severity]}{i.severityConfirmed ? "" : " · sugerida"}
          </span>
          <span className="badge badge-slate">{INCIDENT_TYPE_LABEL[i.type] ?? i.type}</span>
          {i.source === "PROMETEO" && <span className="badge badge-violet">Vía Prometeo</span>}
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", overflowWrap: "anywhere" }}>{i.title}</h1>
        {i.description && <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6, whiteSpace: "pre-wrap" }}>{i.description}</p>}
      </header>

      {actionError && <div className="alert-banner alert-critical" role="alert" style={{ marginBottom: 12 }}>{actionError}</div>}

      <section style={card} aria-label="Datos">
        <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, fontSize: 12 }}>
          {[
            ["Detectada", fmtDateTime(i.detectedAt)],
            ["Ocurrió", fmtDateTime(i.occurredAt)],
            ["Reportó", shortId(i.reportedById)],
            ["Responsable", i.assignedToId ? shortId(i.assignedToId) : "Sin asignar"],
            ["Corral / unidad", i.farmUnit?.name ?? "—"],
            ["Lote / grupo", i.animalGroup?.name ?? "—"],
            ["Animal", i.animal ? `${i.animal.tagCode ?? ""} ${i.animal.species}` : "—"],
            ["Cultivo / equipo", i.cropCycle?.cropName ?? i.inventoryItem?.name ?? "—"],
            ["Tarea", detail.relatedTask ? (detail.relatedTask.missing ? `${shortId(detail.relatedTask.id)} (no disponible)` : `${detail.relatedTask.title} · ${detail.relatedTask.status}`) : "—"],
          ].map(([k, val]) => (
            <div key={k}><dt style={{ color: "var(--faint)" }}>{k}</dt><dd style={{ color: "var(--ink)", margin: 0 }}>{val}</dd></div>
          ))}
        </dl>
        {i.resolution && <p style={{ fontSize: 12, marginTop: 10, color: "var(--ink)" }}><strong>Resolución:</strong> {i.resolution}</p>}
        {i.cancelReason && <p style={{ fontSize: 12, marginTop: 10, color: "var(--muted)" }}><strong>Motivo de cancelación:</strong> {i.cancelReason}</p>}
      </section>

      {v.transitions.length > 0 && (
        <section style={card} aria-label="Cambiar estado">
          <p className="fl">Estado</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {v.transitions.map((to) => (
              <button key={to} type="button" disabled={busy}
                className={to === "CANCELLED" || to === "DUPLICATE" ? "btn-ghost" : "btn-primary"}
                onClick={() => {
                  if (to === "RESOLVED" || to === "CANCELLED" || to === "DUPLICATE") { setTransitionTo(to); setTransitionText(""); }
                  else void act("/transition", { to });
                }}>
                {(i.status === "RESOLVED" || i.status === "CLOSED") && to === "IN_PROGRESS" ? "Reabrir" : TRANSITION_LABEL[to] ?? to}
              </button>
            ))}
          </div>
          {transitionTo && needsText && (
            <form style={{ display: "grid", gap: 8, marginTop: 10 }} onSubmit={async (e) => {
              e.preventDefault();
              const body = transitionTo === "RESOLVED" ? { to: transitionTo, resolution: transitionText }
                : transitionTo === "CANCELLED" ? { to: transitionTo, reason: transitionText }
                : { to: transitionTo, duplicateOfId: transitionText };
              if (await act("/transition", body)) setTransitionTo(null);
            }}>
              <label><span className="fl">{transitionTo === "RESOLVED" ? "¿Cómo se resolvió? *" : transitionTo === "CANCELLED" ? "Motivo *" : "ID de la incidencia original *"}</span>
                {transitionTo === "DUPLICATE"
                  ? <input className="fi" value={transitionText} onChange={(e) => setTransitionText(e.target.value)} required />
                  : <textarea className="fi" rows={3} value={transitionText} onChange={(e) => setTransitionText(e.target.value)} required />}
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="btn-accent" disabled={busy || !transitionText.trim()}>Confirmar</button>
                <button type="button" className="btn-ghost" onClick={() => setTransitionTo(null)}>Cancelar</button>
              </div>
            </form>
          )}
        </section>
      )}

      {(v.canTriage || v.canAssign || v.canLinkTask) && (
        <section style={card} aria-label="Clasificación y asignación">
          {v.canTriage && (
            <form style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 12 }}
              onSubmit={(e) => { e.preventDefault(); void act("", { type, severity, severityReason: severityReason || undefined }, "PATCH"); }}>
              <label><span className="fl">Tipo</span>
                <select className="fi" value={type} onChange={(e) => setType(e.target.value)}>{INCIDENT_TYPES.map((t) => <option key={t} value={t}>{INCIDENT_TYPE_LABEL[t]}</option>)}</select>
              </label>
              <label><span className="fl">Severidad</span>
                <select className="fi" value={severity} onChange={(e) => setSeverity(e.target.value)}>{SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}</select>
              </label>
              <label><span className="fl">Motivo</span><input className="fi" value={severityReason} onChange={(e) => setSeverityReason(e.target.value)} /></label>
              <button type="submit" className="btn-primary" disabled={busy} style={{ alignSelf: "end" }}>
                {i.severityConfirmed ? "Guardar clasificación" : "Confirmar clasificación"}
              </button>
            </form>
          )}
          {v.canAssign && (
            <label style={{ display: "block", marginBottom: 12 }}><span className="fl">Responsable</span>
              <select className="fi" value={i.assignedToId ?? ""} disabled={busy || !members}
                onChange={(e) => void act("/assign", { assignedToId: e.target.value || null })}>
                <option value="">Sin asignar</option>
                {people.map((p) => <option key={p.userId} value={p.userId}>{p.label}</option>)}
              </select>
            </label>
          )}
          {v.canLinkTask && (
            <form style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) 2fr auto", gap: 8 }}
              onSubmit={(e) => { e.preventDefault(); if (taskId.trim()) void act("/task", { task: { source: taskSource, id: taskId.trim() } }); }}>
              <label><span className="fl">Fuente</span>
                <select className="fi" value={taskSource} onChange={(e) => setTaskSource(e.target.value)}>
                  <option value="AGRO_FARM_TASK">Tarea Agro</option>
                  <option value="JOB_TASK">Tarea canónica (JobTask)</option>
                </select>
              </label>
              <label><span className="fl">ID de tarea</span><input className="fi" value={taskId} onChange={(e) => setTaskId(e.target.value)} /></label>
              <button type="submit" className="btn-ghost" disabled={busy || !taskId.trim()} style={{ alignSelf: "end" }}>Relacionar</button>
            </form>
          )}
        </section>
      )}

      <section style={card} aria-label="Evidencia">
        <p className="fl">Evidencia ({detail.evidence.length})</p>
        {detail.evidence.length === 0 ? <p style={{ fontSize: 12, color: "var(--faint)" }}>Sin evidencia todavía.</p> : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            {detail.evidence.map((ev) => (
              <li key={ev.id} style={{ fontSize: 12, color: "var(--ink)" }}>
                <span className="badge badge-slate" style={{ marginRight: 6 }}>{MEDIA_LABEL[ev.mediaType] ?? ev.mediaType}</span>
                {ev.fileUrl ? <a href={ev.fileUrl} target="_blank" rel="noreferrer noopener">{ev.title ?? "Abrir archivo"} <ExternalLink size={11} aria-hidden /></a> : ev.note}
                <span style={{ color: "var(--faint)" }}> · {fmtDateTime(ev.capturedAt)}</span>
              </li>
            ))}
          </ul>
        )}
        {v.canAddEvidence && (
          <form style={{ display: "grid", gridTemplateColumns: "minmax(110px, 1fr) 2fr auto", gap: 6, marginTop: 10 }}
            onSubmit={async (e) => {
              e.preventDefault();
              const isNote = evMedia === "NOTE" || evMedia === "MEASUREMENT";
              if (await act("/evidence", { mediaType: evMedia, ...(isNote ? { note: evValue } : { fileUrl: evValue }) })) setEvValue("");
            }}>
            <select className="fi" aria-label="Tipo de evidencia" value={evMedia} onChange={(e) => setEvMedia(e.target.value)}>
              {MEDIA_TYPES.map((m) => <option key={m} value={m}>{MEDIA_LABEL[m]}</option>)}
            </select>
            <input className="fi" aria-label="Contenido" value={evValue} onChange={(e) => setEvValue(e.target.value)}
              type={evMedia === "NOTE" || evMedia === "MEASUREMENT" ? "text" : "url"} placeholder={evMedia === "NOTE" ? "Nota" : evMedia === "MEASUREMENT" ? "Ej. 38.5 °C" : "https://…"} />
            <button type="submit" className="btn-ghost" disabled={busy || !evValue.trim()}>Agregar</button>
          </form>
        )}
      </section>

      {v.canComment && (
        <section style={card} aria-label="Comentar">
          <form style={{ display: "grid", gap: 8 }} onSubmit={async (e) => {
            e.preventDefault();
            if (await act("/comments", { body: comment, kind: commentKind })) setComment("");
          }}>
            <label><span className="fl">{commentKind === "ASSESSMENT" ? "Evaluación profesional" : "Comentario"}</span>
              <textarea className="fi" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {v.canAssess && (
                <label style={{ fontSize: 12, color: "var(--muted)", display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={commentKind === "ASSESSMENT"} onChange={(e) => setCommentKind(e.target.checked ? "ASSESSMENT" : "COMMENT")} />
                  Registrar como evaluación profesional ({FARM_ROLE_LABEL[v.role] ?? v.role})
                </label>
              )}
              <button type="submit" className="btn-primary" disabled={busy || !comment.trim()}>Publicar</button>
            </div>
          </form>
        </section>
      )}

      <section style={card} aria-label="Historial">
        <p className="fl">Historial</p>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {detail.timeline.map((e) => {
            const extra = timelineDetail(e);
            return (
              <li key={e.id} style={{ borderLeft: `2px solid ${e.action === "incident.assessment_added" ? "var(--brand)" : "var(--border)"}`, paddingLeft: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{TIMELINE_LABEL[e.action] ?? e.action}</p>
                {extra && <p style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "pre-wrap" }}>{extra}</p>}
                <p style={{ fontSize: 11, color: "var(--faint)" }}>
                  {fmtDateTime(e.createdAt)} · {shortId(e.actorId)}{e.after?.byRole || e.after?.authorRole ? ` (${FARM_ROLE_LABEL[e.after.byRole ?? e.after.authorRole] ?? ""})` : ""} · {e.source}
                </p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
