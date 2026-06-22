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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="scroll-smooth">
      <body
        className="min-h-screen antialiased"
        style={{ fontFamily: "var(--font-sans, 'Geist', system-ui)" }}
      >
        {children}
      </body>
    </html>
  );
}
