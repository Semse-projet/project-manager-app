"use client";

import { useEffect, useState } from "react";
import { Card, ErrorState, Spinner } from "../../../components/ui";
import { useLanguage } from "../../../lib/language-context";
import { fetchActiveContributorTerms, type ContributorTermsVersionView } from "../../semse-api";

// Terms content is plain-text Markdown-lite (## headers, blank-line
// paragraphs) stored server-side in ContributorTermsVersion — this renders
// it without pulling in a full Markdown dependency for one legal page.
function TermsBody({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.startsWith("## ")) {
          return (
            <h2 key={index} className="mt-6 text-sm font-bold text-ink">
              {block.replace(/^##\s+/, "")}
            </h2>
          );
        }
        if (block.startsWith("# ")) {
          return (
            <h1 key={index} className="text-lg font-black text-ink">
              {block.replace(/^#\s+/, "")}
            </h1>
          );
        }
        return (
          <p key={index} className="whitespace-pre-line text-sm leading-relaxed text-muted">
            {block.replace(/\*\*/g, "")}
          </p>
        );
      })}
    </div>
  );
}

export default function ContributorTermsPage() {
  const { t, language } = useLanguage();
  const [terms, setTerms] = useState<ContributorTermsVersionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-xl font-black text-ink sm:text-2xl">{t("contributors.terms.title")}</h1>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : error || !terms ? (
        <ErrorState message={error ?? "—"} />
      ) : (
        <Card className="mt-6">
          <div className="mb-4 flex flex-wrap gap-4 border-b border-white/[0.08] pb-4 text-xs text-muted">
            <span>
              {t("contributors.terms.version")}: <strong className="text-ink">{terms.version}</strong>
            </span>
            <span>
              {t("contributors.terms.effectiveDate")}:{" "}
              <strong className="text-ink">
                {new Date(terms.effectiveAt).toLocaleDateString(language === "es" ? "es-MX" : "en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </strong>
            </span>
          </div>
          <TermsBody content={language === "es" ? terms.contentEs : terms.contentEn} />
        </Card>
      )}
    </div>
  );
}
