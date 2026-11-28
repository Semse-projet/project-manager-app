"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, Check, Inbox, X } from "lucide-react";
import { useLanguage } from "../../../../lib/language-context";
import { fetchMyOffers, respondToOffer, SemseApiError, type BusinessOfferView } from "../../../semse-api";
import { Banner, Button, Empty, PageHeader, PageStack, Panel, Pill, type Notice, type Tone } from "../../../../components/module-surface/ui";

const STATUS_TONE: Record<string, Tone> = { SENT: "warn", ACCEPTED: "ok", DECLINED: "error", EXPIRED: "muted", REVOKED: "muted" };

const COPY = {
  es: {
    title: "Mis ofertas",
    intro: "Aceptar una oferta no es un contrato ni te da acceso: la empresa debe confirmarla después.",
    none: "No tienes ofertas.",
    accept: "Aceptar",
    decline: "Rechazar",
    unavailable: "Las ofertas aún no están habilitadas.",
    noneHint: "Cuando una empresa te envíe una oferta, podrás aceptarla o rechazarla aquí.",
    compensation: "Compensación",
    status: { SENT: "Pendiente de tu respuesta", ACCEPTED: "Aceptada", DECLINED: "Rechazada", EXPIRED: "Vencida", REVOKED: "Revocada" } as Record<string, string>
  },
  en: {
    title: "My offers",
    intro: "Accepting an offer is not a contract and gives no access: the company must confirm it afterwards.",
    none: "You have no offers.",
    accept: "Accept",
    decline: "Decline",
    unavailable: "Offers are not enabled yet.",
    noneHint: "When a company sends you an offer, you can accept or decline it here.",
    compensation: "Compensation",
    status: { SENT: "Waiting for your answer", ACCEPTED: "Accepted", DECLINED: "Declined", EXPIRED: "Expired", REVOKED: "Revoked" } as Record<string, string>
  }
} as const;

export default function MyOffersPage() {
  const { language } = useLanguage();
  const c = COPY[language];
  const [offers, setOffers] = useState<BusinessOfferView[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const describe = useCallback(
    (error: unknown) => (error instanceof SemseApiError && error.status === 404 ? c.unavailable : String((error as Error).message)),
    [c.unavailable]
  );

  const load = useCallback(async () => {
    try {
      setOffers(await fetchMyOffers());
      setNotice(null);
    } catch (error) {
      setNotice({ tone: "error", text: describe(error) });
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
      setNotice({ tone: "error", text: describe(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageStack maxWidth={760}>
      <PageHeader icon={Briefcase} title={c.title} description={c.intro} />
      {notice ? (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      ) : null}
      {offers.length === 0 ? (
        <Panel>
          <Empty icon={Inbox} title={c.none} description={c.noneHint} />
        </Panel>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {offers.map((offer) => (
            <Panel key={offer.offerId}>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ flex: "1 1 200px", fontSize: 15, color: "var(--ink)" }}>{offer.positionTitle}</strong>
                  <Pill tone={STATUS_TONE[offer.status] ?? "muted"}>{c.status[offer.status] ?? offer.status}</Pill>
                </div>
                {offer.compensationNote ? (
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>
                    <span style={{ fontWeight: 700 }}>{c.compensation}:</span> {offer.compensationNote}
                  </div>
                ) : null}
                {offer.status === "SENT" ? (
                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                    <Button variant="primary" size="touch" icon={Check} disabled={busy} onClick={() => void answer(offer.offerId, "ACCEPT")}>
                      {c.accept}
                    </Button>
                    <Button variant="danger" size="touch" icon={X} disabled={busy} onClick={() => void answer(offer.offerId, "DECLINE")}>
                      {c.decline}
                    </Button>
                  </div>
                ) : null}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </PageStack>
  );
}
