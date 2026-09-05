import type { MetadataRoute } from "next";

// El layout raiz declara `dynamic = "force-dynamic"`; el manifest es estatico y
// no debe heredarlo.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SEMSE Project — Profesionales verificados y pagos seguros",
    short_name: "SEMSE",
    description:
      "Gestiona proyectos de construccion y mantenimiento: profesionales verificados, pagos por hitos y evidencia documentada.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Fondo del splash = superficie base del tema oscuro (--color-base).
    background_color: "#050810",
    // Coincide con `viewport.themeColor` del layout raiz (--color-brand).
    theme_color: "#3b82f6",
    lang: "es",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // A sangre completa: el SO le aplica su propio recorte (circulo, squircle...).
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
