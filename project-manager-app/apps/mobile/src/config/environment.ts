type ApiEnvironment = { canonical?: string; legacy?: string; development?: boolean; appEnv?: string };

export const PRODUCTION_API_ORIGIN = "https://api.semseproject.com";

function normalizeOrigin(value: string, development: boolean): string {
  try {
    const url = new URL(value.trim());
    if (url.username || url.password || url.search || url.hash) throw new Error();
    if (url.protocol !== "https:" && !(development && url.protocol === "http:")) throw new Error();
    if (url.pathname.replace(/\/+$/, "") !== "" && url.pathname.replace(/\/+$/, "") !== "/v1") throw new Error();
    // "api.semseproject.com." (FQDN with a trailing dot) is the same DNS name as
    // "api.semseproject.com": strip the dot so equality checks cannot be bypassed.
    const host = url.hostname.replace(/\.+$/, "");
    if (!host) throw new Error();
    return `${url.protocol}//${host}${url.port ? `:${url.port}` : ""}`;
  } catch {
    // Never echo a potentially credential-bearing configuration value.
    throw new Error("La URL del API debe ser un origen HTTPS válido, sin credenciales ni parámetros.");
  }
}

export function resolveApiBaseUrl({ canonical, legacy, development = false, appEnv }: ApiEnvironment): string {
  const primary = canonical?.trim() ? normalizeOrigin(canonical, development) : undefined;
  const previous = legacy?.trim() ? normalizeOrigin(legacy, development) : undefined;
  if (primary && previous && primary !== previous) {
    throw new Error("Las dos variables de URL del API apuntan a direcciones distintas. Unifica su configuración.");
  }
  const resolved = primary ?? previous;
  // A pilot build must name its (staging) backend explicitly: it never falls
  // back to production and never accepts the production origin.
  if (appEnv?.trim() === "pilot") {
    if (!resolved) throw new Error("El build de piloto necesita una URL de API de staging explícita.");
    if (resolved === PRODUCTION_API_ORIGIN) throw new Error("El build de piloto no puede apuntar al API de producción.");
  }
  return resolved ?? PRODUCTION_API_ORIGIN;
}

// Expo inlines only direct process.env references in the JavaScript bundle.
export const API_BASE_URL = resolveApiBaseUrl({
  canonical: process.env.EXPO_PUBLIC_SEMSE_API_BASE_URL,
  legacy: process.env.EXPO_PUBLIC_SEMSE_API_URL,
  development: typeof __DEV__ !== "undefined" && __DEV__,
  appEnv: process.env.EXPO_PUBLIC_SEMSE_APP_ENV,
});
