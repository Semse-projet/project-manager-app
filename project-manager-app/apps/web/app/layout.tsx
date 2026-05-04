import type { Metadata, Viewport } from "next";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "SEMSEproject",
    template: "%s · SEMSE",
  },
  description: "Encuentra profesionales verificados, gestiona proyectos con IA y paga con seguridad.",
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
