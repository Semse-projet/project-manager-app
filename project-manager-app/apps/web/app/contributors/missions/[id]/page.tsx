"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, ErrorState, Spinner } from "../../../../components/ui";
import { useLanguage } from "../../../../lib/language-context";
import { ConsentGate } from "../../dashboard/ConsentGate";
import {
  acceptContributorMission,
  fetchPublicContributorMission,
  SemseApiError,
  type KnowledgeMissionView,
} from "../../../semse-api";

const CONSENT_REQUIRED_CODE = "CONTRIBUTOR_PROGRAM_CONSENT_REQUIRED";

function formatCompensation(cents: number, currency: string, locale: "es" | "en"): string {
  return new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-faint">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2 text-sm text-muted">
            <span className="text-brand">·</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ContributorMissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, language } = useLanguage();
  const router = useRouter();
  const [mission, setMission] = useState<KnowledgeMissionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPublicContributorMission(id)
      .then((data) => {
        if (active) setMission(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function handleAccept() {
    setAccepting(true);
    setAcceptError(null);
    try {
      const acceptance = await acceptContributorMission(id);
      setNeedsConsent(false);
      router.push(`/contributors/dashboard/submissions/${acceptance.id}`);
    } catch (err) {
      if (err instanceof SemseApiError && err.status === 401) {
        router.push(`/login?from=${encodeURIComponent(`/contributors/missions/${id}`)}`);
        return;
      }
      if (err instanceof SemseApiError && err.code === CONSENT_REQUIRED_CODE) {
        // First-time contributor: show terms/consent inline, then retry the
        // same acceptance — never bounce to a generic dashboard mid-flow.
        setNeedsConsent(true);
        return;
      }
      setAcceptError(err instanceof Error ? err.message : "error");
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ErrorState message={error ?? "—"} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-black text-ink sm:text-2xl">{mission.title}</h1>
        {mission.isDemo ? <Badge variant="warn">{t("contributors.missions.demo")}</Badge> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge variant="brand">{mission.trade}</Badge>
        <Badge>{mission.difficulty}</Badge>
      </div>
      <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted">{mission.description}</p>

      <Card className="mt-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-faint">
              {t("contributors.missions.compensation")}
            </p>
            <p className="text-lg font-bold text-brand">
              {mission.isDemo
                ? t("contributors.missions.demoCompensation")
                : formatCompensation(mission.baseCompensationCents, mission.currency, language)}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-faint">
              {t("contributors.missions.deadline")}
            </p>
            <p className="text-sm font-semibold text-ink">
              {mission.deadlineAt
                ? new Date(mission.deadlineAt).toLocaleDateString(language === "es" ? "es-MX" : "en-US")
                : t("contributors.missions.noDeadline")}
            </p>
          </div>
        </div>

        <ListSection title={t("contributors.missions.requirements")} items={mission.requirements} />
        <ListSection title={t("contributors.missions.evidenceRequested")} items={mission.evidenceRequested} />
        <ListSection title={t("contributors.missions.acceptanceCriteria")} items={mission.acceptanceCriteria} />
      </Card>

      {acceptError ? (
        <div className="mt-4">
          <ErrorState message={acceptError} />
        </div>
      ) : null}

      {needsConsent ? (
        <div className="mt-6">
          <ConsentGate onAccepted={() => void handleAccept()} />
        </div>
      ) : (
        <div className="mt-6">
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={handleAccept}
            loading={accepting}
            disabled={mission.isDemo || mission.status !== "PUBLISHED"}
          >
            {mission.isDemo ? t("contributors.missions.demoNotAcceptable") : t("contributors.missions.accept")}
          </Button>
        </div>
      )}
    </div>
  );
}
