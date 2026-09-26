"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { AgroFarmNav } from "../../AgroFarmNav";
import { uploadAgroEvidenceFile } from "../../agro-evidence-upload";
import {
  agroFetch, CAP_LEVEL_LABEL, CAP_LEVELS, CAP_STATUS_BADGE, CAP_STATUS_LABEL, FARM_ROLE_LABEL, fmtDateTime, isForbidden,
  MEDIA_LABEL, MEDIA_TYPES, shortId, VERIFICATION_METHOD_LABEL,
} from "../../agro-ops";

type Evidence = { id: string; mediaType: string; title: string | null; note: string | null; fileUrl: string | null; capturedAt: string };
type Verification = { id: string; verifierId: string; verifierFarmRole: string; method: string; result: string; levelAssessed: string | null; notes: string | null; verifiedAt: string; expiresAt: string | null; evidence: Evidence[] };
type Profile = {
  viewerRole: string;
  worker: { userId: string; farmRole: string; displayName: string | null };
  roles: Array<{ id: string; isPrimary: boolean; source: string; role: { key: string; name: string; sector: string }; specialties: Array<{ key: string; name: string }> }>;
  capabilities: Array<{
    id: string; level: string; status: string; source: string; verifiedAt: string | null; expiresAt: string | null;
    capability: { key: string; name: string; category: string; requiresProfessional: boolean; evidenceRequired: boolean; parent: { name: string } | null; specialty: { name: string } | null };
    lastVerification: Verification | null; verifications: Verification[]; evidence: Evidence[];
  }>;
};
type Catalog = { roles: Array<{ id: string; key: string; name: string; sector: string }>; capabilities: Array<{ id: string; key: string; name: string; category: string; requiresProfessional: boolean; parent: { name: string } | null }> };

const VERIFIERS = ["OWNER", "MANAGER", "SUPERVISOR", "TECHNICIAN", "SPECIALIST", "VETERINARIAN", "AGRONOMIST"];
const PROFESSIONALS = ["TECHNICIAN", "SPECIALIST", "VETERINARIAN", "AGRONOMIST"];

export default function WorkerProfilePage() {
  const { farmId, workerId } = useParams<{ farmId: string; workerId: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [newCap, setNewCap] = useState("");
  const [newLevel, setNewLevel] = useState("BASIC");
  const [open, setOpen] = useState<{ id: string; mode: "verify" | "revoke" | "evidence" } | null>(null);
  const [vForm, setVForm] = useState({ result: "APPROVED", method: "DIRECT_OBSERVATION", levelAssessed: "", notes: "", evidenceIds: [] as string[], reason: "", mediaType: "PHOTO", value: "" });
  const [evUploading, setEvUploading] = useState(false);

  // T-053: sube el archivo elegido y deja la URL real en vForm.value; antes
  // era una URL escrita a mano y nadie subía nada.
  async function handleEvidenceFile(file: File) {
    setEvUploading(true); setActionError(null);
    try { const url = await uploadAgroEvidenceFile(file); setVForm((f) => ({ ...f, value: url })); }
    catch (e: any) { setActionError(e?.message ?? "No se pudo subir el archivo"); }
    finally { setEvUploading(false); }
  }

  const base = `/farms/${encodeURIComponent(farmId)}`;
  const load = useCallback(async () => {
    setError(null);
    try {
      setProfile(await agroFetch<Profile>(`${base}/workers/${encodeURIComponent(workerId)}`));
    } catch (e: any) {
      if (isForbidden(e)) setForbidden(true); else setError(e.message);
    } finally { setLoading(false); }
  }, [base, workerId]);

  useEffect(() => {
    void load();
    agroFetch<Catalog>("/workforce/catalog").then(setCatalog).catch(() => setCatalog(null));
  }, [load]);

  async function act(path: string, body: unknown) {
    setBusy(true); setActionError(null);
    try { await agroFetch(path, { method: "POST", body }); await load(); return true; }
    catch (e: any) { setActionError(e.message); return false; }
    finally { setBusy(false); }
  }

  const crumbs = [{ label: "Equipo", href: `/agro/${farmId}/workforce` }, { label: workerId === "me" ? "Mi perfil" : "Perfil" }];
  if (loading) return <div className="agro-shell"><div className="skel" style={{ height: 200 }} aria-busy="true" /></div>;
  if (forbidden) return (
    <div className="agro-shell"><AgroFarmNav farmId={farmId} crumbs={crumbs} />
      <div className="empty-state"><ShieldAlert size={36} className="empty-icon" aria-hidden /><p className="empty-title">Perfil no disponible</p><p className="empty-desc">Solo supervisores y profesionales de la finca pueden ver perfiles ajenos.</p></div>
    </div>
  );
  if (error || !profile) return (
    <div className="agro-shell"><AgroFarmNav farmId={farmId} crumbs={crumbs} />
      <div className="alert-banner alert-critical" role="alert">No se pudo cargar el perfil: {error}</div>
    </div>
  );

  const self = workerId === "me";
  const canVerify = !self && VERIFIERS.includes(profile.viewerRole);
  const canAssign = self || ["OWNER", "MANAGER", "SUPERVISOR"].includes(profile.viewerRole);
  const card: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", padding: 14, marginBottom: 12 };
  const specialties = [...new Map(profile.roles.flatMap((r) => r.specialties).map((s) => [s.key, s])).values()];

  return (
    <div className="agro-shell">
      <AgroFarmNav farmId={farmId} crumbs={crumbs} />
      <header style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>{profile.worker.displayName ?? shortId(profile.worker.userId)}</h1>
        <p style={{ fontSize: 12, color: "var(--muted)" }}>{FARM_ROLE_LABEL[profile.worker.farmRole] ?? profile.worker.farmRole} en esta finca</p>
      </header>
      {actionError && <div className="alert-banner alert-critical" role="alert" style={{ marginBottom: 12 }}>{actionError}</div>}

      <section style={card} aria-label="Oficios y especialidades">
        <p className="fl">Oficios</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {profile.roles.length === 0 ? <span style={{ fontSize: 12, color: "var(--faint)" }}>Sin oficio registrado.</span> :
            profile.roles.map((r) => <span key={r.id} className={r.isPrimary ? "badge badge-teal" : "badge badge-slate"}>{r.role.name}{r.isPrimary ? " · principal" : ""}</span>)}
        </div>
        <p className="fl">Especialidades</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {specialties.length === 0 ? <span style={{ fontSize: 12, color: "var(--faint)" }}>—</span> : specialties.map((s) => <span key={s.key} className="badge badge-blue">{s.name}</span>)}
        </div>
        {canAssign && catalog && (
          <form style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }} onSubmit={async (e) => {
            e.preventDefault(); if (newRole && await act(`${base}/workers/${encodeURIComponent(workerId)}/roles`, { role: newRole, isPrimary: profile.roles.length === 0 })) setNewRole("");
          }}>
            <select className="fi" aria-label="Oficio" value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ flex: 1, minWidth: 180 }}>
              <option value="">Agregar oficio…</option>
              {catalog.roles.map((r) => <option key={r.id} value={r.key}>{r.name}</option>)}
            </select>
            <button type="submit" className="btn-ghost" disabled={busy || !newRole}>Agregar</button>
          </form>
        )}
      </section>

      <section style={card} aria-label="Capacidades">
        <p className="fl">Capacidades</p>
        {profile.capabilities.length === 0 && <p style={{ fontSize: 12, color: "var(--faint)" }}>Sin capacidades registradas.</p>}
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {profile.capabilities.map((c) => {
            const lv = c.lastVerification;
            const verifyAllowed = canVerify && (!c.capability.requiresProfessional || PROFESSIONALS.includes(profile.viewerRole));
            const allEvidence = [...new Map([...c.evidence, ...c.verifications.flatMap((v) => v.evidence)].map((e) => [e.id, e])).values()];
            return (
              <li key={c.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                      {c.capability.name}{c.capability.requiresProfessional && <span className="badge badge-violet" style={{ marginLeft: 6 }}>Profesional</span>}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--muted)" }}>
                      {[c.capability.specialty?.name, c.capability.parent?.name].filter(Boolean).join(" › ") || c.capability.category}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <span className="badge badge-slate">{CAP_LEVEL_LABEL[c.level] ?? c.level}</span>
                    <span className={CAP_STATUS_BADGE[c.status] ?? "badge badge-slate"}>{CAP_STATUS_LABEL[c.status] ?? c.status}</span>
                  </div>
                </div>
                {lv && (
                  <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    {lv.result === "APPROVED" ? "Verificó" : lv.result === "REVOKED" ? "Revocó" : "Rechazó"} {shortId(lv.verifierId)} ({FARM_ROLE_LABEL[lv.verifierFarmRole] ?? lv.verifierFarmRole})
                    {" · "}{VERIFICATION_METHOD_LABEL[lv.method] ?? lv.method} · {fmtDateTime(lv.verifiedAt)}
                    {c.expiresAt && ` · vence ${fmtDateTime(c.expiresAt)}`}
                    {lv.notes && ` · “${lv.notes}”`}
                  </p>
                )}
                {allEvidence.length > 0 && (
                  <p style={{ fontSize: 11, marginTop: 4 }}>
                    Evidencia: {allEvidence.map((e, i) => (
                      <span key={e.id}>{i > 0 && ", "}{e.fileUrl ? <a href={e.fileUrl} target="_blank" rel="noreferrer noopener">{MEDIA_LABEL[e.mediaType] ?? e.mediaType} <ExternalLink size={10} aria-hidden /></a> : `${MEDIA_LABEL[e.mediaType]}: ${e.note ?? ""}`}</span>
                    ))}
                  </p>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {(self || canVerify) && <button type="button" className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setOpen({ id: c.id, mode: "evidence" })}>Agregar evidencia</button>}
                  {canAssign && ["SELF_REPORTED", "REJECTED", "EXPIRED"].includes(c.status) &&
                    <button type="button" className="btn-ghost" style={{ fontSize: 11 }} disabled={busy} onClick={() => void act(`${base}/worker-capabilities/${c.id}/request-review`, {})}>Pedir revisión</button>}
                  {verifyAllowed && c.status !== "REVOKED" &&
                    <button type="button" className="btn-primary" style={{ fontSize: 11 }} onClick={() => { setVForm((f) => ({ ...f, evidenceIds: allEvidence.map((e) => e.id).slice(0, 1), notes: "" })); setOpen({ id: c.id, mode: "verify" }); }}>Verificar</button>}
                  {verifyAllowed && (c.status === "VERIFIED" || c.status === "EXPIRED") &&
                    <button type="button" className="btn-danger" style={{ fontSize: 11 }} onClick={() => setOpen({ id: c.id, mode: "revoke" })}>Revocar</button>}
                </div>

                {open?.id === c.id && open.mode === "evidence" && (
                  <form style={{ display: "grid", gridTemplateColumns: "minmax(110px, 1fr) 2fr auto", gap: 6, marginTop: 8 }} onSubmit={async (e) => {
                    e.preventDefault();
                    const isNote = vForm.mediaType === "NOTE" || vForm.mediaType === "MEASUREMENT";
                    if (await act(`${base}/worker-capabilities/${c.id}/evidence`, { mediaType: vForm.mediaType, ...(isNote ? { note: vForm.value } : { fileUrl: vForm.value }) })) { setOpen(null); setVForm((f) => ({ ...f, value: "" })); }
                  }}>
                    <select className="fi" aria-label="Tipo" value={vForm.mediaType} onChange={(e) => setVForm({ ...vForm, mediaType: e.target.value, value: "" })}>
                      {MEDIA_TYPES.map((m) => <option key={m} value={m}>{MEDIA_LABEL[m]}</option>)}
                    </select>
                    {vForm.mediaType === "NOTE" || vForm.mediaType === "MEASUREMENT" ? (
                      <input className="fi" aria-label="Nota" value={vForm.value} onChange={(e) => setVForm({ ...vForm, value: e.target.value })} placeholder={vForm.mediaType === "MEASUREMENT" ? "Ej. 38.5 °C" : "Nota"} />
                    ) : vForm.mediaType === "EXTERNAL_URL" ? (
                      <input className="fi" aria-label="Enlace" type="url" value={vForm.value} onChange={(e) => setVForm({ ...vForm, value: e.target.value })} placeholder="https://…" />
                    ) : (
                      <div>
                        <input className="fi" aria-label="Archivo" type="file" disabled={evUploading}
                          accept={vForm.mediaType === "PHOTO" ? "image/*" : vForm.mediaType === "VIDEO" ? "video/*" : vForm.mediaType === "AUDIO" ? "audio/*" : undefined}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleEvidenceFile(f); e.target.value = ""; }} />
                        {evUploading && <p style={{ fontSize: 11, color: "var(--muted)" }}>Subiendo…</p>}
                        {!evUploading && vForm.value && <p style={{ fontSize: 11, color: "var(--ok)" }}>Archivo listo ✓</p>}
                      </div>
                    )}
                    <button type="submit" className="btn-ghost" disabled={busy || evUploading || !vForm.value.trim()}>Guardar</button>
                  </form>
                )}

                {open?.id === c.id && open.mode === "verify" && (
                  <form style={{ display: "grid", gap: 8, marginTop: 8, border: "1px solid var(--border)", borderRadius: 10, padding: 10 }} onSubmit={async (e) => {
                    e.preventDefault();
                    const ok = await act(`${base}/worker-capabilities/${c.id}/verify`, {
                      result: vForm.result, method: vForm.method, levelAssessed: vForm.levelAssessed || undefined,
                      evidenceIds: vForm.evidenceIds, notes: vForm.notes || undefined,
                    });
                    if (ok) setOpen(null);
                  }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                      <label><span className="fl">Resultado</span>
                        <select className="fi" value={vForm.result} onChange={(e) => setVForm({ ...vForm, result: e.target.value })}>
                          <option value="APPROVED">Aprobar</option><option value="REJECTED">Rechazar</option>
                        </select>
                      </label>
                      <label><span className="fl">Método</span>
                        <select className="fi" value={vForm.method} onChange={(e) => setVForm({ ...vForm, method: e.target.value })}>
                          {Object.entries(VERIFICATION_METHOD_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                      </label>
                      <label><span className="fl">Nivel evaluado</span>
                        <select className="fi" value={vForm.levelAssessed} onChange={(e) => setVForm({ ...vForm, levelAssessed: e.target.value })}>
                          <option value="">Mantener ({CAP_LEVEL_LABEL[c.level]})</option>
                          {CAP_LEVELS.map((l) => <option key={l} value={l}>{CAP_LEVEL_LABEL[l]}</option>)}
                        </select>
                      </label>
                    </div>
                    <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                      <legend className="fl">Evidencia usada {c.capability.evidenceRequired && vForm.result === "APPROVED" ? "*" : ""}</legend>
                      {allEvidence.length === 0 ? <p style={{ fontSize: 11, color: "var(--faint)" }}>Agrega evidencia primero.</p> : allEvidence.map((ev) => (
                        <label key={ev.id} style={{ display: "flex", gap: 6, fontSize: 12, alignItems: "center" }}>
                          <input type="checkbox" checked={vForm.evidenceIds.includes(ev.id)} onChange={(e) => setVForm({ ...vForm, evidenceIds: e.target.checked ? [...vForm.evidenceIds, ev.id] : vForm.evidenceIds.filter((x) => x !== ev.id) })} />
                          {MEDIA_LABEL[ev.mediaType]} · {ev.title ?? ev.note ?? ev.fileUrl ?? shortId(ev.id)}
                        </label>
                      ))}
                    </fieldset>
                    <label><span className="fl">Notas {vForm.result === "REJECTED" ? "*" : ""}</span><textarea className="fi" rows={2} value={vForm.notes} onChange={(e) => setVForm({ ...vForm, notes: e.target.value })} /></label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="submit" className="btn-accent" disabled={busy}>Registrar verificación</button>
                      <button type="button" className="btn-ghost" onClick={() => setOpen(null)}>Cancelar</button>
                    </div>
                  </form>
                )}

                {open?.id === c.id && open.mode === "revoke" && (
                  <form style={{ display: "grid", gap: 8, marginTop: 8 }} onSubmit={async (e) => {
                    e.preventDefault(); if (await act(`${base}/worker-capabilities/${c.id}/revoke`, { reason: vForm.reason })) { setOpen(null); setVForm((f) => ({ ...f, reason: "" })); }
                  }}>
                    <label><span className="fl">Motivo de revocación *</span><textarea className="fi" rows={2} value={vForm.reason} onChange={(e) => setVForm({ ...vForm, reason: e.target.value })} required /></label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="submit" className="btn-danger" disabled={busy || !vForm.reason.trim()}>Revocar verificación</button>
                      <button type="button" className="btn-ghost" onClick={() => setOpen(null)}>Cancelar</button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>

        {canAssign && catalog && (
          <form style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8, marginTop: 12 }} onSubmit={async (e) => {
            e.preventDefault(); if (newCap && await act(`${base}/workers/${encodeURIComponent(workerId)}/capabilities`, { capability: newCap, level: newLevel })) setNewCap("");
          }}>
            <select className="fi" aria-label="Capacidad" value={newCap} onChange={(e) => setNewCap(e.target.value)}>
              <option value="">{self ? "Declarar una capacidad…" : "Asignar una capacidad…"}</option>
              {catalog.capabilities.map((c) => <option key={c.id} value={c.key}>{c.parent ? `${c.parent.name} › ` : ""}{c.name}</option>)}
            </select>
            <select className="fi" aria-label="Nivel" value={newLevel} onChange={(e) => setNewLevel(e.target.value)}>
              {CAP_LEVELS.map((l) => <option key={l} value={l}>{CAP_LEVEL_LABEL[l]}</option>)}
            </select>
            <button type="submit" className="btn-primary" disabled={busy || !newCap}>Agregar</button>
          </form>
        )}
      </section>
    </div>
  );
}
