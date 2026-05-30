"use client";

import Link from "next/link";
import { useLanguage } from "../../../../lib/language-context";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, Building2, Check, CheckCircle2, Mail, MapPin, Phone, Scale, Shield, Star, User, X } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";
import {
  fetchCurrentUser,
  fetchDisputes,
  fetchMyProfile,
  fetchRatings,
  fetchUserMemberships,
  updateMyProfile,
  type RatingListItem,
  type UserMembershipView,
  type UserProfileView,
  type UserView,
} from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

const KNOWN_TRADES = [
  "Electricidad", "Plomería", "Pintura", "Albañilería", "Carpintería",
  "Jardinería", "Limpieza", "Soldadura", "Climatización", "Cerrajería",
];

function deriveDisplayName(user: UserView | null, profile: UserProfileView | null, memberships: UserMembershipView[]): string {
  if (profile?.displayName) return profile.displayName;
  const primaryOrgName = memberships[0]?.org?.name?.trim();
  if (primaryOrgName) return primaryOrgName;
  if (!user) return "Perfil";
  const localPart = user.email.split("@")[0] ?? user.email;
  return localPart.split(/[._-]+/).filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function formatRoleLabel(roleKey: string): string {
  const labels: Record<string, string> = { OPS_ADMIN: "Operaciones", PRO: "Profesional", WORKER: "Worker", CLIENT: "Cliente" };
  return labels[roleKey] ?? roleKey;
}

function formatStatusLabel(status: string): string {
  return { active: "Activo", pending: "Pendiente", suspended: "Suspendido" }[status] ?? status;
}

function formatVerificationLabel(status: string): string {
  return { verified: "Verificado", pending: "En revisión", suspended: "Suspendido" }[status] ?? "Sin verificar";
}

const card: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px",
};

export default function WorkerProfilePage() {
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState<UserView | null>(null);
  const [profile, setProfile] = useState<UserProfileView | null>(null);
  const [memberships, setMemberships] = useState<UserMembershipView[]>([]);
  const [ratings, setRatings] = useState<RatingListItem[]>([]);
  const [openDisputes, setOpenDisputes] = useState(0);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyDone, setVerifyDone] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ displayName: string; bio: string; location: string; trades: string[]; availability: boolean }>({
    displayName: "", bio: "", location: "", trades: [], availability: true,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const user = await fetchCurrentUser();
        const [profileData, membershipRows, ratingsResult, disputes] = await Promise.all([
          fetchMyProfile().catch(() => null),
          fetchUserMemberships(user.id).catch(() => []),
          fetchRatings().catch(() => ({ actorUserId: null, items: [] })),
          fetchDisputes().catch(() => []),
        ]);
        if (cancelled) return;
        setCurrentUser(user);
        setProfile(profileData);
        setMemberships(membershipRows);
        setRatings(ratingsResult.items.filter((item) => item.toUser?.id === user.id));
        setOpenDisputes(disputes.filter((item) => {
          const row = item as Record<string, unknown>;
          return ["OPEN", "ASSIGNED", "UNDER_REVIEW"].includes(String(row.status ?? "").toUpperCase());
        }).length);
        if (profileData) {
          setDraft({
            displayName: profileData.displayName ?? "",
            bio: profileData.bio ?? "",
            location: profileData.location ?? "",
            trades: profileData.trades ?? [],
            availability: profileData.availability ?? true,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const displayName = useMemo(() => deriveDisplayName(currentUser, profile, memberships), [currentUser, profile, memberships]);
  const avgRating = ratings.length > 0
    ? (ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1) : "—";
  const isVerified = currentUser?.verificationStatus === "verified";
  const uniqueRoles = Array.from(new Set(memberships.map((m) => m.role.key)));
  const memberSince = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString("es-MX", { month: "long", year: "numeric" }) : "—";

  function startEditing() {
    setDraft({
      displayName: profile?.displayName ?? "",
      bio: profile?.bio ?? "",
      location: profile?.location ?? "",
      trades: profile?.trades ?? [],
      availability: profile?.availability ?? true,
    });
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setSaveError(null);
    setEditing(false);
  }

  async function requestVerification(type: string) {
    if (!currentUser) return;
    setVerifyBusy(true);
    setVerifyError(null);
    setVerifyDone(null);
    try {
      const res = await fetch(`/api/semse/users/${currentUser.id}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ verificationType: type }),
      });
      const json = await res.json() as { data?: unknown; error?: { message?: string } };
      if (!res.ok) throw new Error(typeof json.error?.message === "string" ? json.error.message : "Error al solicitar verificación");
      setVerifyDone(type);
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setVerifyBusy(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateMyProfile({
        displayName: draft.displayName.trim() || undefined,
        bio: draft.bio.trim() || undefined,
        location: draft.location.trim() || undefined,
        trades: draft.trades,
        availability: draft.availability,
      });
      setProfile(updated);
      setEditing(false);
    } catch {
      setSaveError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  function toggleTrade(trade: string) {
    setDraft((prev) => ({
      ...prev,
      trades: prev.trades.includes(trade)
        ? prev.trades.filter((t) => t !== trade)
        : [...prev.trades, trade],
    }));
  }

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto" }}>
      <HtmlInCanvasPanel
        as="section"
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: "24px" }}
        canvasClassName="rounded-2xl"
        minHeight={82}
      >
        <div>
          <Link
            href="/worker/dashboard"
            style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none", marginBottom: "8px" }}
          >
            <span style={{ fontSize: "14px" }}>←</span> Dashboard
          </Link>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>{t("page.profile")}</h1>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>Identidad canónica y perfil público editable</p>
        </div>
        <NotificationBanner audience="worker" />
      </HtmlInCanvasPanel>

      {/* Identidad base */}
      <HtmlInCanvasPanel as="section" style={{ ...card, marginBottom: "16px" }} canvasClassName="rounded-2xl" minHeight={180}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "18px", background: "var(--brand)18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <User size={32} color="var(--brand)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--ink)" }}>{loading ? "Cargando…" : displayName}</h2>
              {isVerified ? <Shield size={16} color="#10b981" /> : null}
            </div>
            <div style={{ display: "grid", gap: "6px", marginBottom: "10px" }}>
              <span style={{ fontSize: "12px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Mail size={12} /> {currentUser?.email ?? "—"}
              </span>
              <span style={{ fontSize: "12px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Phone size={12} /> {currentUser?.phone ?? "Sin teléfono registrado"}
              </span>
              {profile?.location ? (
                <span style={{ fontSize: "12px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <MapPin size={12} /> {profile.location}
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {uniqueRoles.map((key) => (
                <span key={key} style={{ padding: "5px 10px", borderRadius: "999px", background: "var(--brand)14", color: "var(--brand)", fontSize: "12px", fontWeight: 700 }}>
                  {formatRoleLabel(key)}
                </span>
              ))}
              <span style={{ padding: "5px 10px", borderRadius: "999px", background: "rgba(16,185,129,.12)", color: "#10b981", fontSize: "12px", fontWeight: 700 }}>
                Trust {Math.round((currentUser?.trustScore ?? 0) * 100)}%
              </span>
              <span style={{ padding: "5px 10px", borderRadius: "999px", background: profile?.availability ? "rgba(16,185,129,.10)" : "rgba(156,163,175,.12)", color: profile?.availability ? "#10b981" : "var(--muted)", fontSize: "12px", fontWeight: 700 }}>
                {profile?.availability ? "Disponible" : "No disponible"}
              </span>
            </div>
          </div>
        </div>
      </HtmlInCanvasPanel>

      <div style={{ display: "grid", gap: "14px" }}>
        {/* Perfil editable */}
        <HtmlInCanvasPanel as="section" style={card} canvasClassName="rounded-2xl" minHeight={200}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>Perfil público</h3>
            {!editing ? (
              <button
                onClick={startEditing}
                style={{ padding: "7px 14px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
              >
                Editar
              </button>
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={cancelEditing}
                  disabled={saving}
                  style={{ padding: "7px 14px", borderRadius: "9px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
                >
                  <X size={13} /> Cancelar
                </button>
                <button
                  onClick={() => void saveProfile()}
                  disabled={saving}
                  style={{ padding: "7px 14px", borderRadius: "9px", border: "none", background: "var(--brand)", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "5px", opacity: saving ? 0.7 : 1 }}
                >
                  <Check size={13} /> {saving ? "Guardando…" : t("ui.save")}
                </button>
              </div>
            )}
          </div>

          {saveError ? (
            <p style={{ fontSize: "12px", color: "#ef4444", marginBottom: "12px" }}>{saveError}</p>
          ) : null}

          {editing ? (
            <div style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Nombre público</label>
                <input
                  value={draft.displayName}
                  onChange={(e) => setDraft((p) => ({ ...p, displayName: e.target.value }))}
                  maxLength={80}
                  placeholder="Tu nombre o nombre de empresa"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Bio</label>
                <textarea
                  value={draft.bio}
                  onChange={(e) => setDraft((p) => ({ ...p, bio: e.target.value }))}
                  maxLength={500}
                  rows={3}
                  placeholder="Describe tu experiencia y especialidad (máx. 500 caracteres)"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none", resize: "vertical", boxSizing: "border-box" }}
                />
                <p style={{ fontSize: "11px", color: "var(--faint)", textAlign: "right" }}>{draft.bio.length}/500</p>
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Ubicación</label>
                <input
                  value={draft.location}
                  onChange={(e) => setDraft((p) => ({ ...p, location: e.target.value }))}
                  maxLength={100}
                  placeholder="Ciudad o zona de cobertura"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Oficios (máx. 10)</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {KNOWN_TRADES.map((trade) => {
                    const selected = draft.trades.includes(trade);
                    return (
                      <button
                        key={trade}
                        onClick={() => toggleTrade(trade)}
                        style={{ padding: "6px 12px", borderRadius: "999px", border: `1px solid ${selected ? "var(--brand)" : "var(--border)"}`, background: selected ? "var(--brand)14" : "transparent", color: selected ? "var(--brand)" : "var(--muted)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                      >
                        {trade}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>Disponible para trabajos</label>
                <button
                  onClick={() => setDraft((p) => ({ ...p, availability: !p.availability }))}
                  style={{ width: "40px", height: "22px", borderRadius: "999px", border: "none", background: draft.availability ? "#10b981" : "var(--border)", cursor: "pointer", position: "relative", transition: "background 0.2s" }}
                >
                  <span style={{ position: "absolute", top: "3px", left: draft.availability ? "20px" : "3px", width: "16px", height: "16px", borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {profile?.bio ? (
                <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.6 }}>{profile.bio}</p>
              ) : (
                <p style={{ fontSize: "13px", color: "var(--faint)" }}>Sin bio. Haz clic en &quot;Editar&quot; para agregar una descripción.</p>
              )}
              {profile?.trades && profile.trades.length > 0 ? (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {profile.trades.map((trade) => (
                    <span key={trade} style={{ padding: "5px 10px", borderRadius: "999px", background: "var(--brand)10", color: "var(--brand)", fontSize: "12px", fontWeight: 600 }}>
                      {trade}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "12px", color: "var(--faint)" }}>Sin oficios registrados.</p>
              )}
            </div>
          )}
        </HtmlInCanvasPanel>

        {/* Estado canónico */}
        <HtmlInCanvasPanel as="section" style={card} canvasClassName="rounded-2xl" minHeight={120}>
          <h3 style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", marginBottom: "12px" }}>Estado canónico</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" }}>
            {[
              { label: "Cuenta", value: formatStatusLabel(currentUser?.status ?? "active") },
              { label: "Verificación", value: formatVerificationLabel(currentUser?.verificationStatus ?? "unverified"), color: isVerified ? "#10b981" : "#f59e0b" },
              { label: "Miembro desde", value: memberSince },
              { label: "Risk", value: currentUser?.riskLevel ?? "low" },
              { label: "Flags", value: String(currentUser?.flags.length ?? 0) },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg)" }}>
                <p style={{ fontSize: "11px", color: "var(--faint)", textTransform: "uppercase", fontWeight: 700 }}>{label}</p>
                <p style={{ fontSize: "15px", color: color ?? "var(--ink)", fontWeight: 800 }}>{value}</p>
              </div>
            ))}
          </div>
        </HtmlInCanvasPanel>

        {/* Membresías */}
        <HtmlInCanvasPanel as="section" style={card} canvasClassName="rounded-2xl" minHeight={100}>
          <h3 style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", marginBottom: "12px" }}>Membresías activas</h3>
          {memberships.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>No hay memberships visibles en este tenant.</p>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {memberships.map((m) => (
                <div key={`${m.userId}-${m.orgId}`} style={{ padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Building2 size={16} color="var(--brand)" />
                    <div>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{m.org.name}</p>
                      <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>{m.org.type} · {formatRoleLabel(m.role.key)}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--faint)" }}>
                    {new Date(m.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </HtmlInCanvasPanel>

        {/* ── Verificación de perfil ── */}
        {!isVerified && (
          <HtmlInCanvasPanel as="section" style={{ ...card, background: "rgba(245,158,11,.04)", borderColor: "rgba(245,158,11,.25)" }} canvasClassName="rounded-2xl" minHeight={80}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <BadgeCheck size={17} color="#f59e0b" />
              <div>
                <h3 style={{ fontSize: "13px", fontWeight: 800, color: "#f59e0b", margin: 0 }}>Verificar tu perfil</h3>
                <p style={{ fontSize: "11px", color: "var(--muted)", margin: 0 }}>Los profesionales verificados reciben 3× más propuestas.</p>
              </div>
            </div>
            {verifyError && <p style={{ fontSize: "12px", color: "#ef4444", marginBottom: "10px" }}>{verifyError}</p>}
            {verifyDone && <p style={{ fontSize: "12px", color: "#10b981", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}><CheckCircle2 size={13} />Solicitud enviada. El equipo revisará tu {verifyDone === "id_document" ? "documento de identidad" : verifyDone === "background_check" ? "antecedentes" : verifyDone}.</p>}
            <div style={{ display: "grid", gap: "8px" }}>
              {([
                { type: "id_document",      label: "Documento de identidad",    desc: "Pasaporte, licencia de conducir o cédula" },
                { type: "background_check", label: "Verificación de antecedentes", desc: "Revisión de historial criminal básico" },
                { type: "phone",            label: "Teléfono verificado",       desc: "Confirma tu número de contacto" },
              ] as const).map((item) => (
                <div key={item.type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 12px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--bg)" }}>
                  <div>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", margin: 0 }}>{item.label}</p>
                    <p style={{ fontSize: "11px", color: "var(--muted)", margin: 0 }}>{item.desc}</p>
                  </div>
                  <button
                    type="button"
                    disabled={verifyBusy || verifyDone === item.type}
                    onClick={() => void requestVerification(item.type)}
                    style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid rgba(245,158,11,.4)", background: verifyDone === item.type ? "rgba(16,185,129,.1)" : "rgba(245,158,11,.1)", color: verifyDone === item.type ? "#10b981" : "#f59e0b", fontSize: "12px", fontWeight: 700, cursor: verifyBusy ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: verifyBusy ? 0.7 : 1 }}
                  >
                    {verifyDone === item.type ? "✓ Enviado" : "Solicitar"}
                  </button>
                </div>
              ))}
            </div>
          </HtmlInCanvasPanel>
        )}

        {isVerified && (
          <HtmlInCanvasPanel as="section" style={{ ...card, background: "rgba(16,185,129,.04)", borderColor: "rgba(16,185,129,.2)" }} canvasClassName="rounded-2xl" minHeight={60}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <BadgeCheck size={17} color="#10b981" />
              <div>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#10b981", margin: 0 }}>Perfil verificado</p>
                <p style={{ fontSize: "11px", color: "var(--muted)", margin: 0 }}>Tu identidad fue confirmada. Apareces como profesional de confianza.</p>
              </div>
            </div>
          </HtmlInCanvasPanel>
        )}

        {openDisputes > 0 ? (
          <HtmlInCanvasPanel as="section" style={{ ...card, background: "rgba(239,68,68,.04)", borderColor: "rgba(239,68,68,.2)" }} canvasClassName="rounded-2xl" minHeight={70}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Scale size={18} color="#ef4444" />
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#ef4444" }}>{openDisputes} disputa{openDisputes > 1 ? "s" : ""} activa{openDisputes > 1 ? "s" : ""}</p>
                  <p style={{ fontSize: "11px", color: "var(--muted)" }}>Disputas activas en el tenant canónico.</p>
                </div>
              </div>
              <Link href="/worker/disputes?status=open" style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "9px", border: "1px solid rgba(239,68,68,.3)", background: "rgba(239,68,68,.08)", color: "#ef4444", fontSize: "12px", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                Ver →
              </Link>
            </div>
          </HtmlInCanvasPanel>
        ) : null}

        {/* Reseñas */}
        <HtmlInCanvasPanel as="section" style={card} canvasClassName="rounded-2xl" minHeight={160}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>Reseñas recibidas</h3>
            {ratings.length > 0 ? (
              <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>{avgRating} promedio · {ratings.length} total</span>
            ) : null}
          </div>
          {loading ? (
            <div style={{ display: "grid", gap: "8px" }}>
              {[1, 2].map((i) => <div key={i} style={{ height: "58px", borderRadius: "10px", background: "var(--raised)" }} />)}
            </div>
          ) : ratings.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>Aún no hay reseñas visibles para este usuario.</p>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {ratings.slice(0, 5).map((r) => (
                <div key={r.id} style={{ padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg)", display: "grid", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {[1, 2, 3, 4, 5].map((v) => (
                        <Star key={v} size={12} color={v <= r.score ? "#f59e0b" : "var(--faint)"} fill={v <= r.score ? "#f59e0b" : "transparent"} />
                      ))}
                      <span style={{ fontSize: "12px", fontWeight: 800, color: "#f59e0b" }}>{r.score}/5</span>
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--faint)" }}>
                      {new Date(r.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--ink)", lineHeight: 1.55 }}>{r.comment ?? "Sin comentario."}</p>
                  <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>Trabajo: {r.job.title}</p>
                </div>
              ))}
            </div>
          )}
        </HtmlInCanvasPanel>

        {currentUser?.flags && currentUser.flags.length > 0 ? (
          <HtmlInCanvasPanel as="section" style={{ ...card, background: "rgba(245,158,11,.05)", borderColor: "rgba(245,158,11,.2)" }} canvasClassName="rounded-2xl" minHeight={80}>
            <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#f59e0b", marginBottom: "10px" }}>Flags de seguridad</h3>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {currentUser.flags.map((flag) => (
                <span key={flag} style={{ padding: "5px 10px", borderRadius: "999px", background: "rgba(245,158,11,.12)", color: "#f59e0b", fontSize: "12px", fontWeight: 700 }}>{flag}</span>
              ))}
            </div>
          </HtmlInCanvasPanel>
        ) : null}

        <HtmlInCanvasPanel as="section" style={{ ...card, background: "rgba(59,130,246,.05)", borderColor: "rgba(59,130,246,.2)" }} canvasClassName="rounded-2xl" minHeight={60}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <AlertTriangle size={16} color="#3b82f6" />
            <p style={{ fontSize: "12px", color: "var(--muted)" }}>
              Teléfono y foto de perfil requieren contrato canónico pendiente. Esta página muestra y edita solo lo estructurado hoy.
            </p>
          </div>
        </HtmlInCanvasPanel>
      </div>
    </div>
  );
}
