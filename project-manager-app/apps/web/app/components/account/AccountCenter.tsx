"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { CheckCircle2, KeyRound, LogOut, ShieldCheck, UserRound } from "lucide-react";
import {
  changeMyPassword,
  fetchCurrentUser,
  fetchMyProfile,
  updateMyProfile,
  type UserProfileView,
  type UserView,
} from "../../semse-api";

type ProfileDraft = {
  displayName: string;
  bio: string;
  location: string;
  availability: boolean;
};

const emptyProfile: ProfileDraft = {
  displayName: "",
  bio: "",
  location: "",
  availability: true,
};

const cardStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 16,
  background: "var(--surface)",
  padding: 22,
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 700,
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--panel)",
  color: "var(--ink)",
  padding: "10px 12px",
  font: "inherit",
  fontWeight: 500,
};

const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 10,
  background: "var(--brand)",
  color: "#07140e",
  cursor: "pointer",
  fontWeight: 800,
  padding: "10px 16px",
};

function profileToDraft(profile: UserProfileView | null): ProfileDraft {
  return {
    displayName: profile?.displayName ?? "",
    bio: profile?.bio ?? "",
    location: profile?.location ?? "",
    availability: profile?.availability ?? true,
  };
}

function messageFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function AccountCenter() {
  const [user, setUser] = useState<UserView | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([fetchCurrentUser(), fetchMyProfile()])
      .then(([userData, profileData]) => {
        if (cancelled) return;
        setUser(userData);
        setProfileDraft(profileToDraft(profileData));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(messageFromError(error, "No se pudo cargar tu cuenta."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileBusy(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const updated = await updateMyProfile({
        displayName: profileDraft.displayName.trim() || undefined,
        bio: profileDraft.bio.trim(),
        location: profileDraft.location.trim(),
        availability: profileDraft.availability,
      });
      setProfileDraft(profileToDraft(updated));
      setProfileSuccess("Tu perfil quedó actualizado.");
    } catch (error) {
      setProfileError(messageFromError(error, "No se pudo guardar el perfil."));
    } finally {
      setProfileBusy(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("La confirmación no coincide con la contraseña nueva.");
      return;
    }

    if (newPassword.length < 15 || newPassword.length > 128) {
      setPasswordError("La contraseña nueva debe tener entre 15 y 128 caracteres.");
      return;
    }

    setPasswordBusy(true);
    try {
      const result = await changeMyPassword({ currentPassword, newPassword });
      const revokedLabel =
        result.revokedOtherSessions === 1
          ? "Se cerró 1 sesión secundaria."
          : `Se cerraron ${result.revokedOtherSessions} sesiones secundarias.`;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(`Contraseña actualizada. ${revokedLabel} Esta sesión continúa activa.`);
    } catch (error) {
      setPasswordError(messageFromError(error, "No se pudo cambiar la contraseña."));
    } finally {
      setPasswordBusy(false);
    }
  }

  if (loading) {
    return (
      <main aria-busy="true" aria-live="polite" style={{ maxWidth: 920, margin: "0 auto" }}>
        <p style={{ color: "var(--muted)" }}>Cargando tu cuenta…</p>
      </main>
    );
  }

  if (loadError || !user) {
    return (
      <main style={{ maxWidth: 920, margin: "0 auto" }}>
        <div role="alert" style={{ ...cardStyle, borderColor: "rgba(248,113,113,.45)", color: "#fca5a5" }}>
          {loadError ?? "No se encontró la identidad de esta sesión."}
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", display: "grid", gap: 18 }}>
      <header>
        <p style={{ color: "var(--brand)", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
          Identidad y seguridad
        </p>
        <h1 style={{ color: "var(--ink)", fontSize: 28, margin: "6px 0" }}>Cuenta y seguridad</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Administra la información que solo tú puedes completar y protege el acceso a SEMSE.
        </p>
      </header>

      <section aria-labelledby="account-identity-heading" style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <UserRound aria-hidden="true" size={22} color="var(--brand)" />
          <div>
            <h2 id="account-identity-heading" style={{ color: "var(--ink)", fontSize: 18, margin: 0 }}>
              Identidad de la cuenta
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 12, margin: "3px 0 0" }}>
              El correo identifica tu cuenta y no se cambia desde este formulario.
            </p>
          </div>
        </div>

        <label htmlFor="account-email" style={labelStyle}>
          Correo
          <input
            id="account-email"
            type="email"
            value={user.email}
            readOnly
            aria-readonly="true"
            style={{ ...inputStyle, opacity: 0.72 }}
          />
        </label>
        <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 0 }}>
          Estado: {user.status} · Verificación: {user.verificationStatus}
        </p>
      </section>

      <section aria-labelledby="account-profile-heading" style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <CheckCircle2 aria-hidden="true" size={22} color="#34d399" />
          <div>
            <h2 id="account-profile-heading" style={{ color: "var(--ink)", fontSize: 18, margin: 0 }}>
              Perfil personal
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 12, margin: "3px 0 0" }}>
              Estos datos se guardan únicamente en tu perfil.
            </p>
          </div>
        </div>

        <form onSubmit={handleProfileSubmit} aria-busy={profileBusy} style={{ display: "grid", gap: 15 }}>
          <label htmlFor="account-display-name" style={labelStyle}>
            Nombre visible
            <input
              id="account-display-name"
              value={profileDraft.displayName}
              maxLength={80}
              autoComplete="name"
              onChange={(event) => setProfileDraft((current) => ({ ...current, displayName: event.target.value }))}
              style={inputStyle}
            />
          </label>

          <label htmlFor="account-location" style={labelStyle}>
            Ubicación
            <input
              id="account-location"
              value={profileDraft.location}
              maxLength={100}
              autoComplete="address-level2"
              onChange={(event) => setProfileDraft((current) => ({ ...current, location: event.target.value }))}
              style={inputStyle}
            />
          </label>

          <label htmlFor="account-bio" style={labelStyle}>
            Biografía
            <textarea
              id="account-bio"
              value={profileDraft.bio}
              maxLength={500}
              rows={4}
              onChange={(event) => setProfileDraft((current) => ({ ...current, bio: event.target.value }))}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink)", fontSize: 13, fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={profileDraft.availability}
              onChange={(event) => setProfileDraft((current) => ({ ...current, availability: event.target.checked }))}
            />
            Disponible para nuevas oportunidades
          </label>

          {profileError ? <p role="alert" style={{ color: "#fca5a5", margin: 0 }}>{profileError}</p> : null}
          {profileSuccess ? <p role="status" style={{ color: "#34d399", margin: 0 }}>{profileSuccess}</p> : null}

          <div>
            <button type="submit" disabled={profileBusy} style={{ ...primaryButtonStyle, opacity: profileBusy ? 0.65 : 1 }}>
              {profileBusy ? "Guardando…" : "Guardar perfil"}
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="account-security-heading" style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <KeyRound aria-hidden="true" size={22} color="#fbbf24" />
          <div>
            <h2 id="account-security-heading" style={{ color: "var(--ink)", fontSize: 18, margin: 0 }}>
              Cambiar contraseña
            </h2>
            <p id="password-session-effect" style={{ color: "var(--muted)", fontSize: 12, margin: "3px 0 0" }}>
              Verificaremos tu contraseña actual y cerraremos las demás sesiones renovables.
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordSubmit} aria-busy={passwordBusy} style={{ display: "grid", gap: 15 }}>
          <label htmlFor="current-password" style={labelStyle}>
            Contraseña actual
            <input
              id="current-password"
              name="currentPassword"
              type="password"
              value={currentPassword}
              required
              maxLength={128}
              autoComplete="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              style={inputStyle}
            />
          </label>

          <label htmlFor="new-password" style={labelStyle}>
            Contraseña nueva
            <input
              id="new-password"
              name="newPassword"
              type="password"
              value={newPassword}
              required
              minLength={15}
              maxLength={128}
              autoComplete="new-password"
              aria-describedby="password-session-effect password-length-help"
              onChange={(event) => setNewPassword(event.target.value)}
              style={inputStyle}
            />
          </label>
          <p id="password-length-help" style={{ color: "var(--muted)", fontSize: 12, margin: "-8px 0 0" }}>
            Usa entre 15 y 128 caracteres. Se permiten frases y espacios.
          </p>

          <label htmlFor="confirm-password" style={labelStyle}>
            Confirmar contraseña nueva
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              required
              minLength={15}
              maxLength={128}
              autoComplete="new-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              style={inputStyle}
            />
          </label>

          {passwordError ? <p role="alert" style={{ color: "#fca5a5", margin: 0 }}>{passwordError}</p> : null}
          {passwordSuccess ? <p role="status" style={{ color: "#34d399", margin: 0 }}>{passwordSuccess}</p> : null}

          <div>
            <button type="submit" disabled={passwordBusy} style={{ ...primaryButtonStyle, opacity: passwordBusy ? 0.65 : 1 }}>
              {passwordBusy ? "Actualizando…" : "Actualizar contraseña"}
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="account-session-heading" style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ShieldCheck aria-hidden="true" size={22} color="#8ab4f8" />
          <div>
            <h2 id="account-session-heading" style={{ color: "var(--ink)", fontSize: 16, margin: 0 }}>Sesión actual</h2>
            <p style={{ color: "var(--muted)", fontSize: 12, margin: "3px 0 0" }}>
              Puedes cerrar de inmediato esta sesión en el dispositivo.
            </p>
          </div>
        </div>
        <Link
          href="/logout"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#fca5a5", fontWeight: 800, textDecoration: "none" }}
        >
          <LogOut aria-hidden="true" size={16} />
          Cerrar sesión
        </Link>
      </section>
    </main>
  );
}
