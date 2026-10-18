"use client";

import { useCallback, useEffect, useState } from "react";
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

const COPY = {
  es: {
    title: "Ofertas internas",
    intro:
      "Una oferta no es un contrato ni da acceso por sí sola. La persona la acepta y después tú confirmas el engagement. La clasificación la declaras tú; confirma con tu asesor legal.",
    person: "Persona (trabajador activo)",
    position: "Cargo",
    classification: "Clasificación declarada",
    compensation: "Nota de compensación (solo la ven ustedes dos)",
    send: "Enviar oferta",
    none: "No hay ofertas todavía.",
    revoke: "Revocar",
    confirm: "Confirmar engagement",
    legal: "Confirmo que revisé la clasificación y las obligaciones legales aplicables",
    unavailable: "Las ofertas aún no están habilitadas para tu empresa.",
    noOrg: "No hay una empresa asociada a tu cuenta.",
    status: { SENT: "Enviada", ACCEPTED: "Aceptada", DECLINED: "Rechazada", EXPIRED: "Vencida", REVOKED: "Revocada" } as Record<string, string>
  },
  en: {
    title: "Internal offers",
    intro:
      "An offer is not a contract and grants no access by itself. The person accepts it and then you confirm the engagement. You declare the classification; confirm it with your legal advisor.",
    person: "Person (active worker)",
    position: "Position",
    classification: "Declared classification",
    compensation: "Compensation note (only the two of you see it)",
    send: "Send offer",
    none: "No offers yet.",
    revoke: "Revoke",
    confirm: "Confirm engagement",
    legal: "I confirm I reviewed the classification and applicable legal obligations",
    unavailable: "Offers are not enabled for your company yet.",
    noOrg: "No company is associated with your account.",
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
  const [classification, setClassification] = useState<"W2" | "1099" | "OTHER">("OTHER");
  const [compensation, setCompensation] = useState("");
  const [legalOk, setLegalOk] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const describe = useCallback(
    (error: unknown) => (error instanceof SemseApiError && error.status === 404 ? c.unavailable : String((error as Error).message)),
    [c.unavailable]
  );

  const load = useCallback(
    async (id: string) => {
      try {
        setOffers(await fetchOrgOffers(id));
        setMessage(null);
      } catch (error) {
        setMessage(describe(error));
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
          setMessage(c.noOrg);
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
        setMessage(describe(error));
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
      setMessage(describe(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <h1>{c.title}</h1>
      <p>{c.intro}</p>
      {message ? <p role="status">{message}</p> : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await createOrgOffer(orgId as string, {
              recipientUserId: person,
              positionTitle: position.trim(),
              classification,
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
          {c.classification}
          <select value={classification} onChange={(e) => setClassification(e.target.value as "W2" | "1099" | "OTHER")} style={{ width: "100%", minHeight: 44 }}>
            <option value="W2">W-2</option>
            <option value="1099">1099</option>
            <option value="OTHER">OTHER</option>
          </select>
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
                {offer.positionTitle} · {offer.classification} · {offer.recipientUserId}
              </span>
              <span>{c.status[offer.status] ?? offer.status}</span>
              {offer.status === "SENT" ? (
                <button disabled={busy} onClick={() => void run(async () => void (await revokeOrgOffer(orgId as string, offer.offerId)))}>
                  {c.revoke}
                </button>
              ) : null}
              {offer.status === "ACCEPTED" ? (
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
