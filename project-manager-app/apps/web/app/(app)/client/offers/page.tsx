"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import {
  confirmOrgOffer,
  createOrgOffer,
  fetchOrgOffers,
  fetchOrganizationMembers,
  fetchActiveOrganization,
  endOrgEngagement,
  revokeOrgOffer,
  SemseApiError,
  type BusinessOfferView
} from "../../../semse-api";

const COPY = {
  es: {
    title: "Ofertas internas",
    intro:
      "Una oferta no es un contrato ni da acceso por sí sola. La persona la acepta y después tú confirmas el engagement. La relación laboral o contractual la defines fuera de SEMSE; confirma con tu asesor legal.",
    person: "Persona (trabajador activo)",
    position: "Cargo",
    compensation: "Nota de compensación (solo gestores autorizados y destinatario)",
    send: "Enviar oferta",
    company: "Empresa",
    end: "Terminar engagement",
    reason: "Motivo de terminación",
    error: "No se pudo completar la operación. Verifica tu empresa e inténtalo de nuevo.",
    none: "No hay ofertas todavía.",
    revoke: "Revocar",
    confirm: "Confirmar engagement",
    legal: "Confirmo que revisé las obligaciones legales aplicables",
    unavailable: "Las ofertas aún no están habilitadas para tu empresa.",
    noOrg: "No hay una empresa asociada a tu cuenta.",
    status: { SENT: "Enviada", ACCEPTED: "Aceptada", DECLINED: "Rechazada", EXPIRED: "Vencida", REVOKED: "Revocada" } as Record<string, string>
  },
  en: {
    title: "Internal offers",
    intro:
      "An offer is not a contract and grants no access by itself. The person accepts it and then you confirm the engagement. You define the employment or contractor relationship outside SEMSE; confirm it with your legal advisor.",
    person: "Person (active worker)",
    position: "Position",
    compensation: "Compensation note (authorized managers and recipient only)",
    send: "Send offer",
    company: "Company",
    end: "End engagement",
    reason: "Reason for ending",
    error: "The operation could not be completed. Check your company and try again.",
    none: "No offers yet.",
    revoke: "Revoke",
    confirm: "Confirm engagement",
    legal: "I confirm I reviewed the applicable legal obligations",
    unavailable: "Offers are not enabled for your company yet.",
    noOrg: "No company is associated with your account.",
    status: { SENT: "Sent", ACCEPTED: "Accepted", DECLINED: "Declined", EXPIRED: "Expired", REVOKED: "Revoked" } as Record<string, string>
  }
} as const;

export default function OffersManagerPage() {
  const { language } = useLanguage();
  const c = COPY[language];
  const requestSeq = useRef(0);
  const activeOrgRef = useRef<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [endReason, setEndReason] = useState("");
  const [offers, setOffers] = useState<BusinessOfferView[]>([]);
  const [people, setPeople] = useState<string[]>([]);
  const [person, setPerson] = useState("");
  const [position, setPosition] = useState("");
  const [compensation, setCompensation] = useState("");
  const [legalOk, setLegalOk] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const describe = useCallback(
    (error: unknown) => (error instanceof SemseApiError && error.status === 404 ? c.unavailable : c.error),
    [c.unavailable, c.error]
  );

  const load = useCallback(
    async (id: string) => {
      const sequence = ++requestSeq.current;
      try {
        const rows = await fetchOrgOffers(id);
        if (sequence !== requestSeq.current) return;
        setOffers(rows);
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
        if (activeOrgRef.current && activeOrgRef.current !== id) { setOffers([]); setPeople([]); setPerson(""); setPosition(""); setCompensation(""); setEndReason(""); setLegalOk(false); }
        activeOrgRef.current = id;
        setOrgName(org.name);
        setOrgId(id);
        if (!id) {
          setMessage(c.noOrg);
          return;
        }
        const members = await fetchOrganizationMembers(id).catch(() => []);
        if (!active) return;
        setPeople(
          members
            .filter((m) => m.status === "ACTIVE" && m.roleKey === "WORKER" && typeof m.userId === "string")
            .map((m) => m.userId as string)
        );
        await load(id);
      } catch (error) {
        if (active) { setOrgId(null); setOffers([]); setPeople([]); setMessage(describe(error)); }
      }
    })();
    return () => { active = false; requestSeq.current++; };
  }, [load, describe, c.noOrg]);

  async function run(action: () => Promise<void>) {
    if (!orgId) return;
    setBusy(true);
    try {
      const current = await fetchActiveOrganization();
      if (current.id !== orgId) { setOffers([]); setPeople([]); setPerson(""); setPosition(""); setCompensation(""); setEndReason(""); setLegalOk(false); setOrgId(null); throw new Error("Organization changed"); }
      await action();
      await load(orgId);
    } catch (error) {
      setMessage(describe(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <h1>{c.title}</h1>
      <p>{c.intro}</p>
      <p>{c.company}: <strong>{orgName}</strong> <small>{orgId}</small></p>
      <label>{c.reason}<input name="endReason" value={endReason} maxLength={500} onChange={e => setEndReason(e.target.value)} /></label>
      {message ? <p role="status">{message}</p> : null}
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
        style={{ display: "grid", gap: 8 }}
      >
        <label>
          {c.person}
          <select required value={person} onChange={(e) => setPerson(e.target.value)} style={{ width: "100%", minHeight: 44 }}>
            <option value="" />
            {people.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label>
          {c.position}
          <input required minLength={2} value={position} onChange={(e) => setPosition(e.target.value)} style={{ width: "100%", minHeight: 44 }} />
        </label>
        <label>
          {c.compensation}
          <input value={compensation} onChange={(e) => setCompensation(e.target.value)} maxLength={500} style={{ width: "100%", minHeight: 44 }} />
        </label>
        <button type="submit" disabled={busy || !orgId} style={{ minHeight: 44 }}>
          {c.send}
        </button>
      </form>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={legalOk} onChange={(e) => setLegalOk(e.target.checked)} />
        {c.legal}
      </label>
      {offers.length === 0 ? (
        <p>{c.none}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
          {offers.map((offer) => (
            <li key={offer.offerId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 220px" }}>
                {offer.positionTitle} · {offer.recipientUserId}
              </span>
              <span>{c.status[offer.status] ?? offer.status}</span>
              {offer.engagementId && ["PENDING_CONFIRMATION", "ACTIVE"].includes(offer.engagementStatus ?? "") ? (
                <button disabled={busy || !endReason.trim()} onClick={() => void run(async () => { await endOrgEngagement(orgId as string, offer.engagementId as string, endReason.trim()); setEndReason(""); })}>{c.end}</button>
              ) : null}
              {offer.status === "SENT" ? (
                <button disabled={busy} onClick={() => void run(async () => void (await revokeOrgOffer(orgId as string, offer.offerId)))}>
                  {c.revoke}
                </button>
              ) : null}
              {offer.status === "ACCEPTED" && offer.engagementStatus === "PENDING_CONFIRMATION" ? (
                <button
                  disabled={busy || !legalOk}
                  onClick={() => void run(async () => void (await confirmOrgOffer(orgId as string, offer.offerId)))}
                >
                  {c.confirm}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

