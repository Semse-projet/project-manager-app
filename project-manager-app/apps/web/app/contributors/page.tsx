"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, FileSearch, HandCoins, PlayCircle, ShieldCheck, Video } from "lucide-react";
import { Badge, Button, Card, EmptyState, Spinner } from "../../components/ui";
import { useLanguage } from "../../lib/language-context";
import { fetchPublicContributorMissions, type KnowledgeMissionView } from "../semse-api";

const STEP_ICONS = [ClipboardCheck, FileSearch, ShieldCheck, Video, PlayCircle, HandCoins];

function formatCompensation(cents: number, currency: string, locale: "es" | "en"): string {
  return new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function MissionCard({ mission }: { mission: KnowledgeMissionView }) {
  const { t, language } = useLanguage();
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">{mission.title}</h3>
        {mission.isDemo ? <Badge variant="warn">{t("contributors.missions.demo")}</Badge> : null}
      </div>
      <p className="line-clamp-3 text-xs text-muted">{mission.description}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge variant="brand">{mission.trade}</Badge>
        <Badge>{mission.difficulty}</Badge>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-faint">
            {t("contributors.missions.compensation")}
          </p>
          <p className="text-sm font-bold text-brand">
            {mission.isDemo
              ? t("contributors.missions.demoCompensation")
              : formatCompensation(mission.baseCompensationCents, mission.currency, language)}
          </p>
        </div>
        <Link href={`/contributors/missions/${mission.id}`}>
          <Button size="sm" variant="ghost">
            {mission.isDemo ? t("contributors.missions.viewExample") : t("contributors.missions.viewDetail")}
          </Button>
        </Link>
      </div>
    </Card>
  );
}

export default function ContributorsHomePage() {
  const { t } = useLanguage();
  const [missions, setMissions] = useState<KnowledgeMissionView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchPublicContributorMissions()
      .then((data) => {
        if (active) setMissions(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Hero — mission-first, plain-language entry point */}
      <section className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-faint">{t("contributors.hero.eyebrow")}</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-4xl">
          {t("contributors.hero.heading")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          {t("contributors.intro")}
        </p>
        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a href="#missions" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto">
              {t("contributors.cta.viewMissions")}
            </Button>
          </a>
          <a href="#how-it-works" className="w-full sm:w-auto">
            <Button size="lg" variant="ghost" className="w-full sm:w-auto">
              {t("contributors.cta.howItWorks")}
            </Button>
          </a>
          <Link href="/contributors/terms" className="w-full sm:w-auto">
            <Button size="lg" variant="ghost" className="w-full sm:w-auto">
              {t("contributors.cta.readTerms")}
            </Button>
          </Link>
        </div>
        <p className="mt-5 text-xs text-muted">
          {t("contributors.cta.participateHint")}{" "}
          <Link href="/login?from=%2Fcontributors%2Fdashboard" className="font-semibold underline hover:text-ink">
            {t("contributors.cta.participate")}
          </Link>
        </p>
      </section>

      {/* How it works — four steps */}
      <section id="how-it-works" className="mt-16 scroll-mt-20">
        <h2 className="text-center text-lg font-bold text-ink sm:text-xl">{t("contributors.howItWorks.title")}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((step) => {
            const Icon = STEP_ICONS[step - 1];
            return (
              <Card key={step} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Icon size={18} aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-bold text-ink">
                    {step}. {t(`contributors.howItWorks.step${step}.title`)}
                  </p>
                  <p className="mt-1 text-xs text-muted">{t(`contributors.howItWorks.step${step}.body`)}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Available missions */}
      <section id="missions" className="mt-16 scroll-mt-20">
        <h2 className="text-center text-lg font-bold text-ink sm:text-xl">{t("contributors.missions.title")}</h2>
        <div className="mt-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : missions.length === 0 ? (
            <EmptyState title={t("contributors.missions.empty")} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {missions.map((mission) => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
