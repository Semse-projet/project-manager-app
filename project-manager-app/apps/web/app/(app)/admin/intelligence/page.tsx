"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart2, BookOpen, Bot, Brain, Eye, GitBranch, Layers, Package, Zap } from "lucide-react";
import { ModuleShell } from "../../../../components/admin/module-shell";
import { getAdminModuleById } from "../../../../lib/admin/admin-navigation";

interface ConsciousnessState {
  maturityScore?: number;
  autonomyLevel?: number;
  signalCount?: number;
  openSignals?: number;
}

interface EcosystemMetrics {
  activeAgents?: number;
  ragChunks?: number;
  avgConfidence?: number;
}

const MODULES = [
  { href: "/admin/ai-mission-control", icon: Zap,       label: "AI Mission Control", desc: "Centro de mando IA: agentes activos, alertas y decisiones" },
  { href: "/admin/agents",             icon: Bot,       label: "Agents",              desc: "Estado, logs y control de agentes autónomos" },
  { href: "/admin/prometeo",           icon: BookOpen,  label: "Prometeo",            desc: "RAG conversacional con citas de documentos técnicos" },
  { href: "/admin/algorithm-engine",   icon: Layers,    label: "Algorithm Engine",    desc: "Motor de matching, scoring y replay de algoritmos" },
  { href: "/admin/autonomy",           icon: GitBranch, label: "Autonomy",            desc: "Nivel de autonomía estratificada y gobernanza de decisiones" },
  { href: "/admin/llm-metrics",        icon: BarChart2, label: "LLM Metrics",         desc: "Latencia, tokens, costos y calidad de respuestas" },
  { href: "/admin/memory",             icon: Brain,     label: "Memory",              desc: "Base de conocimiento y memoria contextual de agentes" },
  { href: "/admin/intelligence-rooms", icon: Layers,    label: "Intelligence Rooms",  desc: "Salas de análisis colaborativo multi-agente" },
  { href: "/admin/browser-agent",      icon: Eye,       label: "Browser Agent",       desc: "Agente de navegación y extracción web autónomo" },
  { href: "/admin/consciousness",      icon: Package,   label: "Consciousness",       desc: "Espejo interno — madurez, autonomía y señales del sistema" },
];

export default function IntelligenceHubPage() {
  const module = getAdminModuleById("intelligence");
  const [cs, setCs] = useState<ConsciousnessState | null>(null);
  const [em, setEm] = useState<EcosystemMetrics | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [cr, er] = await Promise.all([
          fetch("/api/semse/ops/ecosystem-metrics"),
          fetch("/api/semse/agents/status"),
        ]);
        if (cr.ok) {
          const cj = await cr.json();
          const d = cj?.data ?? {};
          setCs({
            maturityScore: d.maturityScore ?? d.consciousness?.maturityScore,
            autonomyLevel: d.autonomyLevel ?? d.consciousness?.autonomyLevel,
            openSignals:   d.openSignalCount ?? d.openSignals,
            signalCount:   d.signalCount,
          });
          setEm({
            activeAgents:  d.activeAgents ?? d.agents?.active,
            ragChunks:     d.ragChunks ?? d.rag?.chunks,
            avgConfidence: d.avgConfidence ?? d.rag?.avgScore,
          });
        }
        if (er.ok) {
          const ej = await er.json();
          const d = ej?.data ?? ej;
          if (!em?.activeAgents && d.active != null) {
            setEm(prev => ({ ...prev, activeAgents: d.active }));
          }
        }
      } catch { /* best-effort */ }
    })();
  }, []);

  if (!module) return null;

  const kpis = [
    { label: "Madurez",       value: cs?.maturityScore != null ? `${cs.maturityScore}/100` : "—", color: "#c4b5fd" },
    { label: "Autonomía",     value: cs?.autonomyLevel != null ? `L${cs.autonomyLevel}`          : "—", color: "#6ee7b7" },
    { label: "Agentes",       value: em?.activeAgents  != null ? em.activeAgents                 : "—", color: "#93c5fd" },
    { label: "RAG chunks",    value: em?.ragChunks     != null ? em.ragChunks                    : "—", color: "#fcd34d" },
  ];

  return (
    <ModuleShell module={module} eyebrow="SEMSE Intelligence">
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* KPI strip */}
        <section style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          {kpis.map(kpi => (
            <div key={kpi.label} style={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              borderTop: `3px solid ${kpi.color}`,
              background: "var(--surface)",
              padding: "14px 18px",
            }}>
              <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                {kpi.label}
              </p>
              <p style={{ fontSize: 28, fontWeight: 900, color: kpi.color, lineHeight: 1 }}>{kpi.value}</p>
            </div>
          ))}
        </section>

        {/* Module grid */}
        <section>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
            Sub-módulos
          </p>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {MODULES.map(m => {
              const Icon = m.icon;
              return (
                <Link key={m.href} href={m.href} style={{
                  borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)",
                  padding: "14px 16px", textDecoration: "none", display: "flex", gap: 12, alignItems: "flex-start",
                  transition: "border-color 0.15s",
                }} className="card-lift">
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(196,181,253,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={14} color="#c4b5fd" />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{m.label}</p>
                    <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>{m.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </ModuleShell>
  );
}
