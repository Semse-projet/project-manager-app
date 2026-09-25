"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BadgeCheck, ShieldAlert, UserPlus, Users } from "lucide-react";
import { AgroFarmNav } from "../AgroFarmNav";
import {
  agroFetch, CAP_LEVEL_LABEL, CAP_STATUS_BADGE, CAP_STATUS_LABEL, FARM_MEMBER_ROLES, FARM_ROLE_LABEL, fmtDateTime,
  isForbidden, shortId,
} from "../agro-ops";

type Matrix = {
  viewerRole: string;
  workers: Array<{
    userId: string; role: string; displayName: string | null;
    capabilities: Array<{ id: string; key: string; name: string; category: string; level: string; status: string; verifiedAt: string | null; expiresAt: string | null; hasVerificationEvidence: boolean }>;
  }>;
};

const MANAGERS = ["OWNER", "MANAGER"];

export default function WorkforcePage() {
  const { farmId } = useParams<{ farmId: string }>();
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ userId: "", role: "WORKER", displayName: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      setMatrix(await agroFetch<Matrix>(`/farms/${encodeURIComponent(farmId)}/workforce/matrix`));
    } catch (e: any) {
      if (isForbidden(e)) setForbidden(true); else setError(e.message);
    } finally { setLoading(false); }
  }, [farmId]);

  useEffect(() => { if (farmId) void load(); }, [farmId, load]);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setFormError(null);
    try {
      await agroFetch(`/farms/${encodeURIComponent(farmId)}/members`, {
        method: "POST", body: { userId: form.userId.trim(), role: form.role, displayName: form.displayName.trim() || undefined },
      });
      setForm({ userId: "", role: "WORKER", displayName: "" }); setShowAdd(false);
      await load();
    } catch (err: any) { setFormError(err.message); } finally { setBusy(false); }
  }

  const canManage = matrix ? MANAGERS.includes(matrix.viewerRole) : false;

  return (
    <div className="agro-shell">
      <AgroFarmNav farmId={farmId} crumbs={[{ label: "Equipo" }]} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Equipo y capacidades</h1>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Qué sabe hacer cada persona, a qué nivel y quién lo verificó.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn-ghost" href={`/agro/${farmId}/workforce/me`}>Mi perfil</Link>
          {canManage && <button type="button" className="btn-accent" onClick={() => setShowAdd((s) => !s)}><UserPlus size={13} aria-hidden /> Agregar miembro</button>}
        </div>
      </div>

      {showAdd && (
        <form onSubmit={(e) => void addMember(e)} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
          {formError && <div className="alert-banner alert-critical" role="alert" style={{ gridColumn: "1 / -1" }}>{formError}</div>}
          <label><span className="fl">ID de usuario SEMSE *</span><input className="fi" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required /></label>
          <label><span className="fl">Nombre visible</span><input className="fi" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
          <label><span className="fl">Rol en la finca *</span>
            <select className="fi" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {FARM_MEMBER_ROLES.filter((r) => r !== "MANAGER" || matrix?.viewerRole === "OWNER").map((r) => <option key={r} value={r}>{FARM_ROLE_LABEL[r]}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-primary" disabled={busy || !form.userId.trim()} style={{ alignSelf: "end" }}>{busy ? "Guardando…" : "Agregar"}</button>
        </form>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }} role="group" aria-label="Filtrar capacidades por estado">
        {["", "VERIFIED", "IN_REVIEW", "SELF_REPORTED", "EXPIRED"].map((s) => (
          <button key={s || "all"} type="button" aria-pressed={statusFilter === s} onClick={() => setStatusFilter(s)}
            style={{ padding: "4px 12px", borderRadius: 999, border: "1px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: statusFilter === s ? "var(--brand)" : "transparent", color: statusFilter === s ? "#fff" : "var(--muted)",
              borderColor: statusFilter === s ? "var(--brand)" : "var(--border)" }}>
            {s ? CAP_STATUS_LABEL[s] : "Todas"}
          </button>
        ))}
      </div>

      {forbidden ? (
        <div className="empty-state"><ShieldAlert size={36} className="empty-icon" aria-hidden /><p className="empty-title">Sin acceso a esta finca</p><p className="empty-desc">Pide al propietario que te agregue como miembro.</p></div>
      ) : error ? (
        <div className="alert-banner alert-critical" role="alert">No se pudo cargar el equipo: {error} <button className="btn-ghost" onClick={() => { setLoading(true); void load(); }}>Reintentar</button></div>
      ) : loading || !matrix ? (
        <div style={{ display: "grid", gap: 8 }} aria-busy="true">{[1, 2].map((i) => <div key={i} className="skel" style={{ height: 120 }} />)}</div>
      ) : matrix.workers.length === 0 ? (
        <div className="empty-state"><Users size={36} className="empty-icon" aria-hidden /><p className="empty-title">Sin miembros</p><p className="empty-desc">Agrega trabajadores, supervisores y profesionales a la finca.</p></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {matrix.workers.map((w) => {
            const caps = w.capabilities.filter((c) => !statusFilter || c.status === statusFilter);
            const verified = w.capabilities.filter((c) => c.status === "VERIFIED").length;
            return (
              <article key={w.userId} style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", padding: 14 }}>
                <header style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/agro/${farmId}/workforce/${encodeURIComponent(w.userId)}`} style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                      {w.displayName ?? shortId(w.userId)}
                    </Link>
                    <p style={{ fontSize: 11, color: "var(--muted)" }}>{FARM_ROLE_LABEL[w.role] ?? w.role}</p>
                  </div>
                  <span className="badge badge-green" title="Capacidades verificadas"><BadgeCheck size={11} aria-hidden /> {verified}/{w.capabilities.length}</span>
                </header>
                {caps.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--faint)" }}>{w.capabilities.length === 0 ? "Sin capacidades registradas." : "Ninguna con este estado."}</p>
                ) : (
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead><tr style={{ color: "var(--faint)", textAlign: "left" }}><th scope="col">Capacidad</th><th scope="col">Nivel</th><th scope="col">Estado</th><th scope="col" aria-label="Evidencia">Ev.</th></tr></thead>
                    <tbody>
                      {caps.map((c) => (
                        <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "6px 4px 6px 0", color: "var(--ink)" }}>{c.name}</td>
                          <td style={{ padding: "6px 4px" }}>{CAP_LEVEL_LABEL[c.level] ?? c.level}</td>
                          <td style={{ padding: "6px 4px" }}>
                            <span className={CAP_STATUS_BADGE[c.status] ?? "badge badge-slate"} title={c.verifiedAt ? `Verificada ${fmtDateTime(c.verifiedAt)}${c.expiresAt ? ` · vence ${fmtDateTime(c.expiresAt)}` : ""}` : undefined}>
                              {CAP_STATUS_LABEL[c.status] ?? c.status}
                            </span>
                          </td>
                          <td style={{ padding: "6px 0" }}>{c.hasVerificationEvidence ? "✓" : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
