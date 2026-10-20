"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { invitationLink } from "../../../../lib/invitation-token";
import { useLanguage } from "../../../../lib/language-context";
import {
  cancelOrgInvitation,
  createOrgInvitation,
  fetchOrgInvitations,
  fetchActiveOrganization,
  resendOrgInvitation,
  SemseApiError,
  type OrgInvitationView
} from "../../../semse-api";

const COPY = {
  es: {
    title: "Equipo e invitaciones",
    intro: "Invita a un trabajador por correo. Su acceso solo se crea cuando él acepta con su propia cuenta.",
    email: "Correo del trabajador",
    invite: "Invitar",
    company: "Empresa",
    reason: "Motivo de cancelación",
    error: "No se pudo completar la operación. Verifica tu empresa e inténtalo de nuevo.",
    none: "No hay invitaciones todavía.",
    cancel: "Cancelar",
    resend: "Reenviar",
    unavailable: "Las invitaciones aún no están habilitadas para tu empresa.",
    noOrg: "No hay una empresa asociada a tu cuenta.",
    link: "Enlace de invitación (se muestra una sola vez)",
    status: { PENDING: "Pendiente", ACCEPTED: "Aceptada", CANCELED: "Cancelada", EXPIRED: "Vencida" } as Record<string, string>
  },
  en: {
    title: "Team and invitations",
    intro: "Invite a worker by email. Access is only created after they accept with their own account.",
    email: "Worker email",
    invite: "Invite",
    company: "Company",
    reason: "Cancellation reason",
    error: "The operation could not be completed. Check your company and try again.",
    none: "No invitations yet.",
    cancel: "Cancel",
    resend: "Resend",
    unavailable: "Invitations are not enabled for your company yet.",
    noOrg: "No company is associated with your account.",
    link: "Invitation link (shown only once)",
    status: { PENDING: "Pending", ACCEPTED: "Accepted", CANCELED: "Canceled", EXPIRED: "Expired" } as Record<string, string>
  }
} as const;

export default function TeamInvitationsPage() {
  const { language } = useLanguage();
  const c = COPY[language];
  const requestSeq = useRef(0);
  const activeOrgRef = useRef<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [rows, setRows] = useState<OrgInvitationView[]>([]);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inviteLink = (token: string) => invitationLink(window.location.origin, token);
  const describe = useCallback(
    (error: unknown) => (error instanceof SemseApiError && error.status === 404 ? c.unavailable : c.error),
    [c.unavailable, c.error]
  );

  const load = useCallback(
    async (id: string) => {
      const sequence = ++requestSeq.current;
      try {
        const rows = await fetchOrgInvitations(id);
        if (sequence !== requestSeq.current) return;
        setRows(rows);
        setMessage(null);
      } catch (error) {
        if (sequence === requestSeq.current) setMessage(describe(error));
      }
    },
    [describe]
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const org = await fetchActiveOrganization();
        if (!active) return;
        const id = org.id;
        if (activeOrgRef.current && activeOrgRef.current !== id) { setRows([]); setLink(null); setEmail(""); setCancelReason(""); }
        activeOrgRef.current = id;
        setOrgName(org.name);
        setOrgId(id);
        if (id) await load(id);
        else setMessage(c.noOrg);
      } catch (error) {
        if (active) { setOrgId(null); setRows([]); setLink(null); setMessage(describe(error)); }
      }
    })();
    return () => { active = false; requestSeq.current++; };
  }, [load, describe, c.noOrg]);

  async function run(action: () => Promise<void>) {
    if (!orgId) return;
    setBusy(true);
    try {
      const current = await fetchActiveOrganization();
      if (current.id !== orgId) { setRows([]); setLink(null); setOrgId(null); throw new Error("Organization changed"); }
      await action();
      await load(orgId);
    } catch (error) {
      setMessage(describe(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <h1>{c.title}</h1>
      <p>{c.intro}</p>
      <p>{c.company}: <strong>{orgName}</strong> <small>{orgId}</small></p>
      <label>{c.reason}<input name="cancelReason" value={cancelReason} maxLength={500} onChange={e => setCancelReason(e.target.value)} /></label>
      {message ? <p role="status">{message}</p> : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const created = await createOrgInvitation(orgId as string, email.trim());
            setLink(created.token ? inviteLink(created.token) : null);
            setEmail("");
          });
        }}
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={c.email}
          aria-label={c.email}
          style={{ flex: "1 1 240px", minHeight: 44, padding: "0 12px" }}
        />
        <button type="submit" disabled={busy || !orgId} style={{ minHeight: 44, padding: "0 16px" }}>
          {c.invite}
        </button>
      </form>
      {link ? (
        <p>
          <strong>{c.link}:</strong> <code style={{ wordBreak: "break-all" }}>{link}</code>
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p>{c.none}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
          {rows.map((row) => (
            <li key={row.invitationId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 200px" }}>{row.recipientMasked}</span>
              <span>{c.status[row.status] ?? row.status}</span>
              {row.status === "PENDING" ? (
                <>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const sent = await resendOrgInvitation(orgId as string, row.invitationId);
                        setLink(sent.token ? inviteLink(sent.token) : null);
                      })
                    }
                  >
                    {c.resend}
                  </button>
                  <button
                    disabled={busy || !cancelReason.trim()}
                    onClick={() => void run(async () => void (await cancelOrgInvitation(orgId as string, row.invitationId, cancelReason.trim())))}
                  >
                    {c.cancel}
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

