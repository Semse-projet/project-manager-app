"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, ErrorState, Spinner, statusVariant } from "../../../components/ui";
import { useLanguage } from "../../../lib/language-context";
import { fetchContributorDashboard, type ContributorDashboardView } from "../../semse-api";
import { ConsentGate } from "./ConsentGate";

function formatCents(cents: number, currency: string, locale: "es" | "en"): string {
  return new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function ContributorsDashboardPage() {
  const { t, language } = useLanguage();
  const [dashboard, setDashboard] = useState<ContributorDashboardView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchContributorDashboard()
      .then((data) => setDashboard(data))
      .catch((err) => setError(err instanceof Error ? err.message : "error"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ErrorState message={error ?? "—"} onRetry={load} />
      </div>
    );
  }

  if (!dashboard.hasAcceptedActiveTerms) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <ConsentGate onAccepted={load} />
      </div>
    );
  }

  const hasAnything = dashboard.acceptances.length > 0 || dashboard.submissions.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-xl font-black text-ink sm:text-2xl">{t("contributors.dashboard.title")}</h1>

      <Card className="mt-6">
        <p className="text-xs font-bold uppercase tracking-widest text-faint">
          {t("contributors.dashboard.totalPaid")}
        </p>
        <p className="mt-1 text-2xl font-bold text-brand">
          {formatCents(dashboard.totalPaidCents, dashboard.currency, language)}
        </p>
      </Card>

      {!hasAnything ? (
        <div className="mt-8">
          <EmptyState
            title={t("contributors.dashboard.empty")}
            action={
              <Link href="/contributors">
                <Button>{t("contributors.dashboard.browseMissions")}</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {dashboard.acceptances.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-sm font-bold text-ink">{t("contributors.dashboard.accepted")}</h2>
              <div className="mt-3 space-y-3">
                {dashboard.acceptances.map((acceptance) => {
                  const relatedSubmission = dashboard.submissions.find(
                    (submission) => submission.missionId === acceptance.missionId
                  );
                  return (
                    <Card key={acceptance.id} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{acceptance.missionTitle}</p>
                        <p className="text-xs text-muted">
                          {formatCents(acceptance.compensationCentsSnapshot, acceptance.currencySnapshot, language)}
                        </p>
                      </div>
                      <Link href={`/contributors/dashboard/submissions/${acceptance.id}`}>
                        <Button size="sm">
                          {relatedSubmission ? t("contributors.submission.title") : t("contributors.dashboard.documentNow")}
                        </Button>
                      </Link>
                    </Card>
                  );
                })}
              </div>
            </section>
          ) : null}

          {dashboard.submissions.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-sm font-bold text-ink">{t("contributors.submission.title")}</h2>
              <div className="mt-3 space-y-3">
                {dashboard.submissions.map((submission) => (
                  <Card key={submission.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{submission.missionTitle}</p>
                      <p className="text-xs text-muted">
                        {formatCents(submission.compensationCentsSnapshot, submission.currencySnapshot, language)}
                        {submission.reward ? ` · ${submission.reward.status}` : ""}
                      </p>
                    </div>
                    <Badge variant={statusVariant(submission.status)}>{submission.status}</Badge>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
