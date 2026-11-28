"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox, Mail, RotateCw, Send, Users, X } from "lucide-react";
import { useLanguage } from "../../../../lib/language-context";
import {
  cancelOrgInvitation,
  createOrgInvitation,
  fetchOrgInvitations,
  fetchOrganizations,
  resendOrgInvitation,
  SemseApiError,
  type OrgInvitationView
} from "../../../semse-api";
import {
  Banner,
  Button,
  Empty,
  List,
  ListRow,
  PageHeader,
  PageStack,
  Panel,
  Pill,
  SecretValue,
  touchInputStyle,
  type Notice,
  type Tone
} from "../../../../components/module-surface/ui";

const STATUS_TONE: Record<string, Tone> = { PENDING: "warn", ACCEPTED: "ok", CANCELED: "muted", EXPIRED: "muted" };

const COPY = {
  es: {
    title: "Equipo e invitaciones",
    intro: "Invita a un trabajador por correo. Su acceso solo se crea cuando él acepta con su propia cuenta.",
    email: "Correo del trabajador",
    invite: "Invitar",
    none: "No hay invitaciones todavía.",
    cancel: "Cancelar",
    resend: "Reenviar",
    unavailable: "Las invitaciones aún no están habilitadas para tu empresa.",
    noOrg: "No hay una empresa asociada a tu cuenta.",
    link: "Enlace de invitación (se muestra una sola vez)",
    linkHelp: "Cópialo y envíalo a la persona si no recibe el correo.",
    newInvite: "Invitar a un trabajador",
    list: "Invitaciones",
    noneHint: "Cuando invites a alguien, verás aquí si aceptó.",
    status: { PENDING: "Pendiente", ACCEPTED: "Aceptada", CANCELED: "Cancelada", EXPIRED: "Vencida" } as Record<string, string>
  },
  en: {
    title: "Team and invitations",
    intro: "Invite a worker by email. Access is only created after they accept with their own account.",
    email: "Worker email",
    invite: "Invite",
    none: "No invitations yet.",
    cancel: "Cancel",
    resend: "Resend",
    unavailable: "Invitations are not enabled for your company yet.",
    noOrg: "No company is associated with your account.",
    link: "Invitation link (shown only once)",
    linkHelp: "Copy it and send it to the person if the email does not arrive.",
    newInvite: "Invite a worker",
    list: "Invitations",
    noneHint: "When you invite someone, you will see here whether they accepted.",
    status: { PENDING: "Pending", ACCEPTED: "Accepted", CANCELED: "Canceled", EXPIRED: "Expired" } as Record<string, string>
  }
} as const;

export default function TeamInvitationsPage() {
  const { language } = useLanguage();
  const c = COPY[language];
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<OrgInvitationView[]>([]);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const inviteLink = (token: string) => `${window.location.origin}/invitations/accept?token=${encodeURIComponent(token)}`;
  const describe = useCallback(
    (error: unknown) => (error instanceof SemseApiError && error.status === 404 ? c.unavailable : String((error as Error).message)),
    [c.unavailable]
  );

  const load = useCallback(
    async (id: string) => {
      try {
        setRows(await fetchOrgInvitations(id));
        setNotice(null);
      } catch (error) {
        setNotice({ tone: "error", text: describe(error) });
      }
    },
    [describe]
  );

  useEffect(() => {
    void (async () => {
      try {
        const orgs = await fetchOrganizations();
        const id = typeof orgs[0]?.id === "string" ? (orgs[0].id as string) : null;
        setOrgId(id);
        if (id) await load(id);
        else setNotice({ tone: "warn", text: c.noOrg });
      } catch (error) {
        setNotice({ tone: "error", text: describe(error) });
      }
    })();
  }, [load, describe, c.noOrg]);

  async function run(action: () => Promise<void>) {
    if (!orgId) return;
    setBusy(true);
    try {
      await action();
      await load(orgId);
    } catch (error) {
      setNotice({ tone: "error", text: describe(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageStack maxWidth={820}>
      <PageHeader icon={Users} title={c.title} description={c.intro} />
      {notice ? (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      ) : null}
      <Panel title={c.newInvite} icon={Mail}>
        <div style={{ display: "grid", gap: 14 }}>
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
              style={{ ...touchInputStyle, flex: "1 1 240px", width: "auto" }}
            />
            <Button type="submit" variant="primary" size="touch" icon={Send} disabled={busy || !orgId}>
              {c.invite}
            </Button>
          </form>
          {link ? <SecretValue label={c.link} value={link} help={c.linkHelp} /> : null}
        </div>
      </Panel>
      <Panel title={c.list} icon={Users} padded={rows.length === 0}>
        {rows.length === 0 ? (
          <Empty icon={Inbox} title={c.none} description={c.noneHint} />
        ) : (
          <List>
            {rows.map((row, index) => (
              <ListRow key={row.invitationId} first={index === 0}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ flex: "1 1 200px", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{row.recipientMasked}</span>
                  <Pill tone={STATUS_TONE[row.status] ?? "muted"}>{c.status[row.status] ?? row.status}</Pill>
                  {row.status === "PENDING" ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button
                        icon={RotateCw}
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const sent = await resendOrgInvitation(orgId as string, row.invitationId);
                            setLink(sent.token ? inviteLink(sent.token) : null);
                          })
                        }
                      >
                        {c.resend}
                      </Button>
                      <Button
                        variant="danger"
                        icon={X}
                        disabled={busy}
                        onClick={() => void run(async () => void (await cancelOrgInvitation(orgId as string, row.invitationId)))}
                      >
                        {c.cancel}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </ListRow>
            ))}
          </List>
        )}
      </Panel>
    </PageStack>
  );
}
