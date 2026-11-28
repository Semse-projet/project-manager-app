"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Briefcase, Inbox, ListChecks, Send, XCircle } from "lucide-react";
import { useLanguage } from "../../../../lib/language-context";
import {
  confirmOrgOffer,
  createOrgOffer,
  fetchOrgOffers,
  fetchOrganizationMembers,
  fetchOrganizations,
  revokeOrgOffer,
  SemseApiError,
  type BusinessOfferView
} from "../../../semse-api";
import {
  Banner,
  Button,
  ConsentCheck,
  Empty,
  Field,
  List,
  ListRow,
  PageHeader,
  PageStack,
  Panel,
  Pill,
  Stat,
  StatGrid,
  shortId,
  touchInputStyle,
  type Notice,
  type Tone
} from "../../../../components/module-surface/ui";

const STATUS_TONE: Record<string, Tone> = { SENT: "warn", ACCEPTED: "brand", DECLINED: "error", EXPIRED: "muted", REVOKED: "muted" };

const COPY = {
  es: {
    title: "Ofertas internas",
    intro:
      "Una oferta no es un contrato ni da acceso por sí sola. La persona la acepta y después tú confirmas el engagement. La relación laboral o contractual la defines fuera de SEMSE; confirma con tu asesor legal.",
    person: "Persona (trabajador activo)",
    position: "Cargo",
    compensation: "Nota de compensación (solo la ven ustedes dos)",
    send: "Enviar oferta",
    none: "No hay ofertas todavía.",
    revoke: "Revocar",
    confirm: "Confirmar engagement",
    legal: "Confirmo que revisé las obligaciones legales aplicables",
    unavailable: "Las ofertas aún no están habilitadas para tu empresa.",
    noOrg: "No hay una empresa asociada a tu cuenta.",
    newOffer: "Nueva oferta",
    sent: "Ofertas enviadas",
    pickPerson: "Elige una persona",
    statSent: "Esperando respuesta",
    statAccepted: "Por confirmar",
    noneHint: "Las ofertas que envíes aparecerán aquí con su estado.",
    legalHint: "Necesario para confirmar un engagement aceptado.",
    status: { SENT: "Enviada", ACCEPTED: "Aceptada", DECLINED: "Rechazada", EXPIRED: "Vencida", REVOKED: "Revocada" } as Record<string, string>
  },
  en: {
    title: "Internal offers",
    intro:
      "An offer is not a contract and grants no access by itself. The person accepts it and then you confirm the engagement. You define the employment or contractor relationship outside SEMSE; confirm it with your legal advisor.",
    person: "Person (active worker)",
    position: "Position",
    compensation: "Compensation note (only the two of you see it)",
    send: "Send offer",
    none: "No offers yet.",
    revoke: "Revoke",
    confirm: "Confirm engagement",
    legal: "I confirm I reviewed the applicable legal obligations",
    unavailable: "Offers are not enabled for your company yet.",
    noOrg: "No company is associated with your account.",
    newOffer: "New offer",
    sent: "Sent offers",
    pickPerson: "Pick a person",
    statSent: "Awaiting answer",
    statAccepted: "To confirm",
    noneHint: "The offers you send show up here with their status.",
    legalHint: "Required to confirm an accepted engagement.",
    status: { SENT: "Sent", ACCEPTED: "Accepted", DECLINED: "Declined", EXPIRED: "Expired", REVOKED: "Revoked" } as Record<string, string>
  }
} as const;

export default function OffersManagerPage() {
  const { language } = useLanguage();
  const c = COPY[language];
  const [orgId, setOrgId] = useState<string | null>(null);
  const [offers, setOffers] = useState<BusinessOfferView[]>([]);
  const [people, setPeople] = useState<string[]>([]);
  const [person, setPerson] = useState("");
  const [position, setPosition] = useState("");
  const [compensation, setCompensation] = useState("");
  const [legalOk, setLegalOk] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const describe = useCallback(
    (error: unknown) => (error instanceof SemseApiError && error.status === 404 ? c.unavailable : String((error as Error).message)),
    [c.unavailable]
  );

  const load = useCallback(
    async (id: string) => {
      try {
        setOffers(await fetchOrgOffers(id));
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
        if (!id) {
          setNotice({ tone: "warn", text: c.noOrg });
          return;
        }
        const members = await fetchOrganizationMembers(id).catch(() => []);
        setPeople(
          members
            .filter((m) => (m.status === undefined || m.status === "ACTIVE") && typeof m.userId === "string")
            .map((m) => m.userId as string)
        );
        await load(id);
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
    <PageStack maxWidth={900}>
      <PageHeader icon={Briefcase} title={c.title} description={c.intro} />
      {notice ? (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      ) : null}
      <StatGrid>
        <Stat label={c.statSent} value={offers.filter((offer) => offer.status === "SENT").length} tone="warn" />
        <Stat label={c.statAccepted} value={offers.filter((offer) => offer.status === "ACCEPTED").length} tone="brand" />
      </StatGrid>
      <Panel title={c.newOffer} icon={Send}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await createOrgOffer(orgId as string, {
                recipientUserId: person,
                positionTitle: position.trim(),
                ...(compensation.trim() ? { compensationNote: compensation.trim() } : {})
              });
              setPosition("");
              setCompensation("");
            });
          }}
          style={{ display: "grid", gap: 14 }}
        >
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <Field label={c.person}>
              <select required value={person} onChange={(e) => setPerson(e.target.value)} style={touchInputStyle}>
                <option value="">{c.pickPerson}</option>
                {people.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={c.position}>
              <input required minLength={2} value={position} onChange={(e) => setPosition(e.target.value)} style={touchInputStyle} />
            </Field>
          </div>
          <Field label={c.compensation}>
            <input value={compensation} onChange={(e) => setCompensation(e.target.value)} maxLength={500} style={touchInputStyle} />
          </Field>
          <div>
            <Button type="submit" variant="primary" size="touch" icon={Send} disabled={busy || !orgId}>
              {c.send}
            </Button>
          </div>
        </form>
      </Panel>
      <Panel title={c.sent} icon={ListChecks} padded={offers.length === 0}>
        {offers.length === 0 ? (
          <Empty icon={Inbox} title={c.none} description={c.noneHint} />
        ) : (
          <>
            <div style={{ padding: "14px 16px 0", display: "grid", gap: 4 }}>
              <ConsentCheck checked={legalOk} onChange={setLegalOk}>
                {c.legal}
              </ConsentCheck>
              <span style={{ fontSize: 11, color: "var(--faint)" }}>{c.legalHint}</span>
            </div>
            <List>
              {offers.map((offer, index) => (
                <ListRow key={offer.offerId} first={index === 0}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ flex: "1 1 220px", minWidth: 0 }}>
                      <strong style={{ display: "block", fontSize: 14, color: "var(--ink)" }}>{offer.positionTitle}</strong>
                      <span style={{ fontSize: 12, color: "var(--muted)" }} title={offer.recipientUserId}>
                        {shortId(offer.recipientUserId, 14)}
                      </span>
                    </span>
                    <Pill tone={STATUS_TONE[offer.status] ?? "muted"}>{c.status[offer.status] ?? offer.status}</Pill>
                    {offer.status === "SENT" ? (
                      <Button
                        variant="danger"
                        icon={XCircle}
                        disabled={busy}
                        onClick={() => void run(async () => void (await revokeOrgOffer(orgId as string, offer.offerId)))}
                      >
                        {c.revoke}
                      </Button>
                    ) : null}
                    {offer.status === "ACCEPTED" ? (
                      <Button
                        variant="primary"
                        icon={BadgeCheck}
                        disabled={busy || !legalOk}
                        onClick={() => void run(async () => void (await confirmOrgOffer(orgId as string, offer.offerId)))}
                      >
                        {c.confirm}
                      </Button>
                    ) : null}
                  </div>
                </ListRow>
              ))}
            </List>
          </>
        )}
      </Panel>
    </PageStack>
  );
}
