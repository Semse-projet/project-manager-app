"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import { fetchMyOffers, respondToOffer, SemseApiError, type BusinessOfferView } from "../../../semse-api";

const COPY = {
  es: {
    title: "Mis ofertas",
    intro: "Aceptar una oferta no es un contrato ni te da acceso: la empresa debe confirmarla después.",
    none: "No tienes ofertas.",
    accept: "Aceptar",
    decline: "Rechazar",
    unavailable: "Las ofertas aún no están habilitadas.",
    status: { SENT: "Pendiente de tu respuesta", ACCEPTED: "Aceptada", DECLINED: "Rechazada", EXPIRED: "Vencida", REVOKED: "Revocada" } as Record<string, string>
  },
  en: {
    title: "My offers",
    intro: "Accepting an offer is not a contract and gives no access: the company must confirm it afterwards.",
    none: "You have no offers.",
    accept: "Accept",
    decline: "Decline",
    unavailable: "Offers are not enabled yet.",
    status: { SENT: "Waiting for your answer", ACCEPTED: "Accepted", DECLINED: "Declined", EXPIRED: "Expired", REVOKED: "Revoked" } as Record<string, string>
  }
} as const;

export default function MyOffersPage() {
  const { language } = useLanguage();
  const c = COPY[language];
  const [offers, setOffers] = useState<BusinessOfferView[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const describe = useCallback(
    (error: unknown) => (error instanceof SemseApiError && error.status === 404 ? c.unavailable : String((error as Error).message)),
    [c.unavailable]
  );

  const load = useCallback(async () => {
    try {
      setOffers(await fetchMyOffers());
      setMessage(null);
    } catch (error) {
      setMessage(describe(error));
    }
  }, [describe]);

  useEffect(() => {
    void load();
  }, [load]);

  async function answer(offerId: string, decision: "ACCEPT" | "DECLINE") {
    setBusy(true);
    try {
      await respondToOffer(offerId, decision);
      await load();
    } catch (error) {
      setMessage(describe(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <h1>{c.title}</h1>
      <p>{c.intro}</p>
      {message ? <p role="status">{message}</p> : null}
      {offers.length === 0 ? (
        <p>{c.none}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
          {offers.map((offer) => (
            <li key={offer.offerId} style={{ display: "grid", gap: 4 }}>
              <strong>{offer.positionTitle}</strong>
              {offer.compensationNote ? <span>{offer.compensationNote}</span> : null}
              <span>{c.status[offer.status] ?? offer.status}</span>
              {offer.status === "SENT" ? (
                <span style={{ display: "flex", gap: 8 }}>
                  <button disabled={busy} style={{ minHeight: 44 }} onClick={() => void answer(offer.offerId, "ACCEPT")}>
                    {c.accept}
                  </button>
                  <button disabled={busy} style={{ minHeight: 44 }} onClick={() => void answer(offer.offerId, "DECLINE")}>
                    {c.decline}
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
