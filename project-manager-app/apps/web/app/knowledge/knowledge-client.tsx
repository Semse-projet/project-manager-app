"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HtmlInCanvasPanel } from "@semse/ui";
import type { KnowledgeOverview } from "@semse/schemas";
import { Card } from "../../components/ui/card";

const badgeTone = {
  online: "bg-emerald-500/15 text-emerald-200",
  degraded: "bg-amber-500/15 text-amber-200",
  offline: "bg-rose-500/15 text-rose-200",
  unknown: "bg-white/[0.08] text-muted"
} as const;

export function KnowledgeClient() {
  const [overview, setOverview] = useState<KnowledgeOverview | null>(null);

  useEffect(() => {
    void fetch("/api/semse/knowledge/overview")
      .then((response) => response.json())
      .then((payload) => setOverview(payload.data as KnowledgeOverview));
  }, []);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="grid gap-1">
          <span className="text-xs uppercase tracking-widest text-muted">Domains</span>
          <strong className="text-3xl text-ink">{overview?.totals.domains ?? "--"}</strong>
        </Card>
        <Card className="grid gap-1">
          <span className="text-xs uppercase tracking-widest text-muted">Services</span>
          <strong className="text-3xl text-ink">{overview?.totals.services ?? "--"}</strong>
        </Card>
        <Card className="grid gap-1">
          <span className="text-xs uppercase tracking-widest text-muted">Online</span>
          <strong className="text-3xl text-emerald-200">{overview?.totals.onlineServices ?? "--"}</strong>
        </Card>
        <Card className="grid gap-1">
          <span className="text-xs uppercase tracking-widest text-muted">Offline</span>
          <strong className="text-3xl text-rose-200">{overview?.totals.offlineServices ?? "--"}</strong>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
        <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={440}>
        <Card className="grid gap-4">
          <div>
            <p className="text-[0.68rem] font-semibold tracking-widest uppercase text-muted">Master Domains</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">Unified Domain Catalog</h2>
          </div>
          <div className="grid gap-3">
            {overview?.domains.map((domain) => (
              <Link
                key={domain.id}
                href={domain.uiPath}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="grid gap-1">
                    <strong className="text-base text-ink">{domain.title}</strong>
                    <p className="text-sm text-muted">{domain.description}</p>
                  </div>
                  <span className="rounded-full bg-brand/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-brand">
                    {domain.id}
                  </span>
                </div>
                <p className="mt-3 text-xs text-muted">API: {domain.apiBasePath} · UI: {domain.uiPath}</p>
              </Link>
            ))}
          </div>
        </Card>
        </HtmlInCanvasPanel>

        <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={440}>
        <Card className="grid gap-4">
          <div>
            <p className="text-[0.68rem] font-semibold tracking-widest uppercase text-muted">Live Runtime</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">Operational Loop</h2>
          </div>
          <div className="grid gap-3">
            {overview?.runtimeStatuses.map((service) => (
              <div key={service.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-4">
                  <strong className="text-sm text-ink">{service.name}</strong>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${badgeTone[service.status]}`}>
                    {service.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">{service.detail}</p>
                {service.target ? <p className="mt-1 text-xs text-muted">Target: {service.target}</p> : null}
              </div>
            ))}
          </div>
        </Card>
        </HtmlInCanvasPanel>
      </div>
    </div>
  );
}
