import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import "./globals.css";

export const dynamic = "force-dynamic";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.semseproject.com";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "SEMSE Project — Profesionales verificados y pagos seguros",
    template: "%s · SEMSE",
  },
  description: "Conecta con profesionales verificados para construcción, remodelación y mantenimiento. Gestiona proyectos con IA, protege pagos por hitos y documenta cada avance.",
  keywords: ["construcción", "remodelación", "mantenimiento", "profesionales verificados", "pagos seguros", "SEMSE"],
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: appUrl,
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
  applicationName: "SEMSE",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // iOS ignora el manifest para el icono de inicio y no respeta el alfa:
    // este va aplanado sobre el degradado de marca.
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "SEMSE",
    // "default" y no "black-translucent": este ultimo mete el contenido debajo
    // de la barra de estado, y la app solo compensa `safe-area-inset-bottom`
    // (nav inferior en app/(app)/layout.tsx), no el inset superior.
    statusBarStyle: "default",
  },
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
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
