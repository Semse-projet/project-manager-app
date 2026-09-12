type ApiEnvironment = { canonical?: string; legacy?: string; development?: boolean };

function normalizeOrigin(value: string, development: boolean): string {
  try {
    const url = new URL(value.trim());
    if (url.username || url.password || url.search || url.hash) throw new Error();
    if (url.protocol !== "https:" && !(development && url.protocol === "http:")) throw new Error();
    if (url.pathname.replace(/\/+$/, "") !== "" && url.pathname.replace(/\/+$/, "") !== "/v1") throw new Error();
    return url.origin;
  } catch {
    // Never echo a potentially credential-bearing configuration value.
    throw new Error("La URL del API debe ser un origen HTTPS válido, sin credenciales ni parámetros.");
  }
}

export function resolveApiBaseUrl({ canonical, legacy, development = false }: ApiEnvironment): string {
  const primary = canonical?.trim() ? normalizeOrigin(canonical, development) : undefined;
  const previous = legacy?.trim() ? normalizeOrigin(legacy, development) : undefined;
  if (primary && previous && primary !== previous) {
    throw new Error("Las dos variables de URL del API apuntan a direcciones distintas. Unifica su configuración.");
  }
  return primary ?? previous ?? "https://api.semseproject.com";
}

// Expo inlines only direct process.env references in the JavaScript bundle.
export const API_BASE_URL = resolveApiBaseUrl({
  canonical: process.env.EXPO_PUBLIC_SEMSE_API_BASE_URL,
  legacy: process.env.EXPO_PUBLIC_SEMSE_API_URL,
  development: typeof __DEV__ !== "undefined" && __DEV__,
});
