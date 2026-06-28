import Link from "next/link";
import { ModuleShell } from "../../../../components/admin/module-shell";
import { getAdminModuleById } from "../../../../lib/admin/admin-navigation";

const VERTICALS = [
  {
    id: "agro",
    name: "Agro / FarmOps",
    description: "Full farm management OS: animals, tasks, inventory, health, feeding, costs, analytics, and reproduction.",
    href: "/admin/verticals/agro",
    status: "operational" as const,
    stats: [
      { label: "Módulos", value: "14" },
      { label: "Estado", value: "Live" },
    ],
    color: "#6ee7b7",
    bg: "rgba(16,185,129,.08)",
    emoji: "🌿",
  },
  {
    id: "construction",
    name: "Construction",
    description: "Field operations, crews, milestones, evidence, change orders, and QA for construction projects.",
    href: "/admin/verticals/construction",
    status: "operational" as const,
    stats: [
      { label: "Módulos", value: "7" },
      { label: "Estado", value: "Live" },
    ],
    color: "#93c5fd",
    bg: "rgba(59,130,246,.08)",
    emoji: "🏗️",
  },
  {
    id: "vision",
    name: "Vision AI",
    description: "Computer vision pipeline: material analysis, safety detection, space classification, portfolio scoring.",
    href: "/admin/verticals/vision",
    status: "operational" as const,
    stats: [
      { label: "Analyzers", value: "6" },
      { label: "Estado", value: "Live" },
    ],
    color: "#c4b5fd",
    bg: "rgba(139,92,246,.08)",
    emoji: "👁️",
  },
  {
    id: "travel",
    name: "Travel Ops",
    description: "Travel management and logistics coordination for field crews across projects.",
    href: "/admin/travel",
    status: "planned" as const,
    stats: [
      { label: "Módulos", value: "1" },
      { label: "Estado", value: "Beta" },
    ],
    color: "#fcd34d",
    bg: "rgba(245,158,11,.08)",
    emoji: "✈️",
  },
  {
    id: "cleaning",
    name: "Cleaning & Turnovers",
    description: "Property turnover workflows, cleaning checklists, and quality verification — coming soon.",
    href: "#",
    status: "planned" as const,
    stats: [
      { label: "Módulos", value: "—" },
      { label: "Estado", value: "Planned" },
    ],
    color: "#67e8f9",
    bg: "rgba(6,182,212,.08)",
    emoji: "🧹",
  },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  operational: { label: "Live", cls: "badge badge-green" },
  attention:   { label: "Attention", cls: "badge badge-amber" },
  planned:     { label: "Planned", cls: "badge badge-slate" },
  disabled:    { label: "Disabled", cls: "badge badge-red" },
};

export default function VerticalsHubPage() {
  const module = getAdminModuleById("verticals");
  if (!module) return null;

  return (
    <ModuleShell module={module} eyebrow="SEMSE Verticals">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {VERTICALS.map((v) => {
          const badge = STATUS_BADGE[v.status];
          const isExternal = !v.href.startsWith("/admin") && v.href !== "#";
          const CardWrapper = v.href === "#"
            ? ({ children }: { children: React.ReactNode }) => (
                <article
                  style={{ borderRadius: 12, border: "1px solid var(--border)", borderTop: `3px solid ${v.color}`, background: v.bg, padding: "20px 22px", opacity: 0.6 }}
                >
                  {children}
                </article>
              )
            : ({ children }: { children: React.ReactNode }) => (
                <Link href={v.href} style={{ display: "block", borderRadius: 12, border: "1px solid var(--border)", borderTop: `3px solid ${v.color}`, background: v.bg, padding: "20px 22px", textDecoration: "none", transition: "border-color 0.15s, background 0.15s" }}
                  className="card-lift"
                >
                  {children}
                </Link>
              );

          return (
            <CardWrapper key={v.id}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24, lineHeight: 1 }}>{v.emoji}</span>
                  <div>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>{v.name}</h2>
                    {isExternal && (
                      <span style={{ fontSize: 10, color: v.color, fontWeight: 600, letterSpacing: "0.05em" }}>
                        VERTICAL APP
                      </span>
                    )}
                  </div>
                </div>
                <span className={badge.cls}>{badge.label}</span>
              </div>

              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55, marginBottom: 14 }}>{v.description}</p>

              <div style={{ display: "flex", gap: 16 }}>
                {v.stats.map(s => (
                  <div key={s.label}>
                    <span style={{ fontSize: 10, color: "var(--faint)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.label}</span>
                    <p style={{ fontSize: 16, fontWeight: 800, color: v.color, lineHeight: 1, marginTop: 2 }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </CardWrapper>
          );
        })}
      </div>
    </ModuleShell>
  );
}
