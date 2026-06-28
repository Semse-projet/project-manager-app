"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Camera, ScanSearch, ShieldCheck, Layers, Brain, TrendingUp, Activity, FlaskConical } from "lucide-react";

interface VisionStats {
  totalAnalyses?: number;
  avgQualityScore?: number;
  highQuality?: number;
  needsReview?: number;
  safetyIssues?: number;
}

export default function AdminVisionVerticalPage() {
  const [stats, setStats] = useState<VisionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res  = await fetch("/api/semse/vision");
        const json = await res.json();
        if (res.ok) {
          const d = (json.data as any) ?? {};
          setStats({
            totalAnalyses:  d.total ?? d.totalAnalyses,
            avgQualityScore: d.avgQuality ?? d.avgQualityScore,
            highQuality:    d.highQuality,
            needsReview:    d.needsReview ?? d.lowQuality,
            safetyIssues:   d.safetyIssues,
          });
        }
      } catch { /* best-effort */ }
      finally { setLoading(false); }
    })();
  }, []);

  const kpis = [
    { label: "Análisis",       value: stats?.totalAnalyses     ?? "—", color: "#c4b5fd" },
    { label: "Score prom.",    value: stats?.avgQualityScore   != null ? `${Math.round(stats.avgQualityScore * 100)}%` : "—", color: "#6ee7b7" },
    { label: "Alta calidad",   value: stats?.highQuality       ?? "—", color: "#6ee7b7" },
    { label: "Revisar",        value: stats?.needsReview       ?? "—", color: "#fcd34d" },
    { label: "Safety issues",  value: stats?.safetyIssues      ?? "—", color: "#fca5a5" },
  ];

  const ANALYZERS = [
    { icon: Camera,      label: "Material Analyzer",   desc: "Clasifica materiales de construcción en fotos de obra con OpenCV", href: "/admin/vision" },
    { icon: Layers,      label: "Space Analyzer",      desc: "Detecta tipo de espacio (cocina, baño, sala…) y calidad del ángulo", href: "/admin/vision" },
    { icon: ShieldCheck, label: "Safety Checker",      desc: "Detecta ausencia de EPP, riesgos y condiciones de seguridad", href: "/admin/vision" },
    { icon: ScanSearch,  label: "Portfolio Analyzer",  desc: "Evalúa galería profesional por consistencia y calidad", href: "/admin/vision" },
    { icon: Brain,       label: "Photo Classifier",    desc: "Pipeline multi-label: tipo, calidad, relevancia, duplicados", href: "/admin/vision" },
    { icon: FlaskConical,label: "Analyzers Lab",       desc: "Sandbox para pruebas de analizadores con imágenes propias", href: "/admin/analyzers-lab" },
  ];

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin/verticals" style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <ArrowLeft size={12} /> Verticals
        </Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 24 }}>👁️</span>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.03em" }}>Vision AI</h1>
              <span className="badge badge-green" style={{ fontSize: 10 }}>Live</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Pipeline de análisis visual con OpenCV + Ollama — calidad, materiales, seguridad, espacios y portfolio</p>
          </div>
          <Link href="/admin/vision" className="btn-accent" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Eye size={12} /> Vision Console
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <section style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", marginBottom: 24 }}>
        {loading
          ? [1,2,3,4,5].map(i => <div key={i} className="skel" style={{ height: 74, borderRadius: 12 }} />)
          : kpis.map(kpi => (
            <div key={kpi.label} style={{
              borderRadius: 12, border: "1px solid var(--border)", borderTop: `3px solid ${kpi.color}`,
              background: "var(--surface)", padding: "14px 16px",
            }}>
              <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                {kpi.label}
              </p>
              <p style={{ fontSize: 26, fontWeight: 900, color: kpi.color, lineHeight: 1 }}>{kpi.value}</p>
            </div>
          ))
        }
      </section>

      {/* Analyzers grid */}
      <section style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>
          Analizadores
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
          {ANALYZERS.map(a => {
            const Icon = a.icon;
            return (
              <Link key={a.label} href={a.href} className="card-lift" style={{
                borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)",
                padding: "14px 16px", textDecoration: "none", display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(196,181,253,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={15} color="#c4b5fd" />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{a.label}</p>
                  <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>{a.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Pipeline flow */}
      <section style={{
        borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)",
        padding: "16px 18px", marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Activity size={13} color="var(--brand)" />
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)" }}>Flujo E2E</p>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--ink)" }}>Worker sube foto</strong>{" → "}
          <strong style={{ color: "var(--ink)" }}>Evidence guardada</strong>{" → "}
          <strong style={{ color: "var(--ink)" }}>QA Agent detecta</strong>{" → "}
          <strong style={{ color: "#c4b5fd)" }}>Vision Service analiza</strong>{" → "}
          <strong style={{ color: "var(--ink)" }}>Score + tags</strong>{" → "}
          <strong style={{ color: "var(--ink)" }}>Admin Review</strong>
        </p>
      </section>

      {/* Vertical Engine config */}
      <section>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>
          Vertical Engine — Config
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {[
            { label: "Evidence Rules",  desc: "Tipos de foto requeridos por trade: antes/durante/después, EPP, materiales" },
            { label: "Score Thresholds", desc: "Umbral de calidad mínima por milestone y tipo de trabajo" },
            { label: "Auto-approval",   desc: "Criterios para aprobación automática vs revisión manual" },
            { label: "Model Config",    desc: "Selección de modelo por analyzer: OpenCV, Ollama, Anthropic Vision" },
            { label: "Alert Rules",     desc: "Alertas de safety crítica al supervisor en tiempo real" },
          ].map(item => (
            <div key={item.label} style={{
              borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)",
              padding: "12px 14px", opacity: 0.65,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <TrendingUp size={11} color="var(--faint)" />
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{item.label}</p>
                <span className="badge badge-slate" style={{ fontSize: 9 }}>planned</span>
              </div>
              <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
