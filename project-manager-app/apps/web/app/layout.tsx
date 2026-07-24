import type { Metadata, Viewport } from "next";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "SEMSE Project — Profesionales verificados y pagos seguros",
    template: "%s · SEMSE",
  },
  description: "Conecta con profesionales verificados para construcción, remodelación y mantenimiento. Gestiona proyectos con IA, protege pagos por hitos y documenta cada avance.",
  keywords: ["construcción", "remodelación", "mantenimiento", "profesionales verificados", "pagos seguros", "SEMSE"],
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "https://semse-web-production.up.railway.app",
    siteName: "SEMSE Project",
    title: "SEMSE Project — Profesionales verificados y pagos seguros",
    description: "Conecta con profesionales verificados. Pagos seguros con escrow. Gestión con IA.",
    images: [{ url: "/icon-1024.png", width: 1024, height: 1024, alt: "SEMSE Project" }],
  },
  twitter: {
    card: "summary",
    title: "SEMSE Project",
    description: "Profesionales verificados. Pagos seguros. IA operativa.",
    images: ["/icon-1024.png"],
  },
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
};

// Applies the persisted theme to <html data-theme> synchronously, before
// hydration/paint — avoids a flash of the wrong theme on a hard refresh or
// direct URL load, and is the real fix for 1.9 ("tema no sobrevive un
// refresh"): the app-shell layout (apps/web/app/(app)/layout.tsx) only
// restores the preference client-side, after mount, which is too late to
// prevent the flash. This script never touches anything React renders on
// <html> (only `lang`/`className` are JSX-managed there), so it cannot
// cause a hydration mismatch.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var saved = window.localStorage.getItem("semse-theme");
    if (saved === "dark" || saved === "light") {
      document.documentElement.dataset.theme = saved;
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="scroll-smooth">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className="min-h-screen antialiased"
        style={{ fontFamily: "var(--font-sans, 'Geist', system-ui)" }}
      >
        {children}
      </body>
    </html>
  );
}
