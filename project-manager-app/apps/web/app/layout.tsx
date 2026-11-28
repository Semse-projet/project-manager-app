import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { cookies } from "next/headers";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { InitialLanguageProvider } from "@/lib/language-context";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, parseLanguagePreference } from "@/lib/language-preference";
import "./globals.css";

export const dynamic = "force-dynamic";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.semseproject.com";

// Título y descripción por defecto en el idioma con el que se sirve la página
// (#1148). Las páginas solo en español (grupo (public)) fijan los suyos.
const DEFAULT_COPY = {
  es: {
    title: "SEMSE Project — Profesionales verificados y pagos seguros",
    description: "Conecta con profesionales verificados para construcción, remodelación y mantenimiento. Gestiona proyectos con IA, protege pagos por hitos y documenta cada avance.",
  },
  en: {
    title: "SEMSE Project — Verified professionals and secure payments",
    description: "Connect with verified professionals for construction, remodeling and maintenance. Manage projects with AI, protect milestone payments and document every step.",
  },
} as const;

async function requestLanguage() {
  return parseLanguagePreference((await cookies()).get(LANGUAGE_STORAGE_KEY)?.value) ?? DEFAULT_LANGUAGE;
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = DEFAULT_COPY[await requestLanguage()];
  return { ...baseMetadata, title: { default: copy.title, template: "%s · SEMSE" }, description: copy.description };
}

const baseMetadata: Metadata = {
  metadataBase: new URL(appUrl),
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Already force-dynamic, so reading the cookie costs no static rendering.
  const language = await requestLanguage();
  return (
    <html lang={language} className={`scroll-smooth ${GeistSans.variable} ${GeistMono.variable}`}>
      <body
        className="min-h-screen antialiased"
        style={{ fontFamily: "var(--font-sans, system-ui)" }}
      >
        <InitialLanguageProvider value={language}>{children}</InitialLanguageProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
