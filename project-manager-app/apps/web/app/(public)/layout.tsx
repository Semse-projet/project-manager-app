import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LandingFooter } from "../../components/landing/landing-footer";
import { LandingNav } from "../../components/landing/landing-nav";

// Este grupo (landing, /como-funciona, privacidad, términos, módulos…) solo existe
// en español. El root layout pone <html lang> y la metadata según la cookie de
// idioma; aquí se fijan en español para que coincidan con el contenido (#1148).
export const metadata: Metadata = {
  title: {
    absolute: "SEMSE Project — Profesionales verificados y pagos seguros",
    template: "%s · SEMSE",
  },
  description: "Conecta con profesionales verificados para construcción, remodelación y mantenimiento. Gestiona proyectos con IA, protege pagos por hitos y documenta cada avance.",
  robots: { index: true, follow: true },
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div lang="es" className="public-theme" style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>
      <LandingNav />
      {children}
      <LandingFooter />
    </div>
  );
}
