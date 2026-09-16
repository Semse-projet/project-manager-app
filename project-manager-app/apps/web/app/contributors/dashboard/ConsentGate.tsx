"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, ErrorState, Spinner } from "../../../components/ui";
import { useLanguage } from "../../../lib/language-context";
import { acceptContributorTerms, fetchActiveContributorTerms, type ContributorTermsVersionView } from "../../semse-api";

const CHECKBOX_KEYS = [
  "isAdult",
  "acceptedTerms",
  "authorizedToRecord",
  "understandsSafetyPriority",
  "understandsDataUse",
] as const;

type CheckboxKey = (typeof CHECKBOX_KEYS)[number];

export function ConsentGate({ onAccepted }: { onAccepted: () => void }) {
  const { t, language } = useLanguage();
  const [terms, setTerms] = useState<ContributorTermsVersionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checked, setChecked] = useState<Record<CheckboxKey, boolean>>({
    isAdult: false,
    acceptedTerms: false,
    authorizedToRecord: false,
    understandsSafetyPriority: false,
    understandsDataUse: false,
  });

  useEffect(() => {
    let active = true;
    fetchActiveContributorTerms()
      .then((data) => {
        if (active) setTerms(data);
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
  }, []);

  const allChecked = CHECKBOX_KEYS.every((key) => checked[key]);

  async function handleSubmit() {
    if (!terms || !allChecked) return;
    setSubmitting(true);
    setError(null);
    try {
      await acceptContributorTerms({
        termsVersionId: terms.id,
        termsContentHash: terms.contentHash,
        locale: language,
        checkboxes: {
          isAdult: true,
          acceptedTerms: true,
          authorizedToRecord: true,
          understandsSafetyPriority: true,
          understandsDataUse: true,
        },
      });
      onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!terms) {
    return <ErrorState message={error ?? "—"} />;
  }

  return (
    <Card className="mx-auto max-w-xl">
      <h2 className="text-lg font-bold text-ink">{t("contributors.consent.title")}</h2>
      <p className="mt-1 text-xs text-muted">
        {t("contributors.terms.version")} {terms.version} ·{" "}
        <Link href="/contributors/terms" target="_blank" className="underline hover:text-ink">
          {t("contributors.cta.readTerms")}
        </Link>
      </p>

      <div className="mt-5 space-y-3">
        {CHECKBOX_KEYS.map((key) => (
          <label key={key} className="flex cursor-pointer items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={checked[key]}
              onChange={(event) => setChecked((prev) => ({ ...prev, [key]: event.target.checked }))}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-[#131328] accent-[var(--brand,#7c5cff)]"
            />
            <span>{t(`contributors.consent.checkbox.${key}`)}</span>
          </label>
        ))}
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      <div className="mt-6">
        <Button className="w-full" disabled={!allChecked} loading={submitting} onClick={handleSubmit}>
          {t("contributors.consent.submit")}
        </Button>
      </div>
    </Card>
  );
}
