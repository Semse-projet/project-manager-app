// Language preference shared by the server (root layout) and the client
// (LanguageProvider). No "use client": the root layout calls these on the server.

export type LanguagePreference = "es" | "en";

export const DEFAULT_LANGUAGE: LanguagePreference = "es";

// Same name as the localStorage key that held the preference before the cookie existed.
export const LANGUAGE_STORAGE_KEY = "semse-language";

export function parseLanguagePreference(value: string | null | undefined): LanguagePreference | null {
  return value === "es" || value === "en" ? value : null;
}

/**
 * Cookie that lets the server render the page in the visitor's language, so the
 * first paint is not Spanish for someone who chose English. Not a credential:
 * readable by the page, one year, whole site.
 */
export function languageCookie(lang: LanguagePreference, secure: boolean): string {
  return `${LANGUAGE_STORAGE_KEY}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? "; Secure" : ""}`;
}
