const REDIRECT_BASE_URL = "https://semse.local";

export function normalizeSafeRedirectPath(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\u0000-\u001F\u007F]/.test(value) || value.includes("\\")) return null;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) return null;

  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || decoded.includes("\\")) return null;
  } catch {
    return null;
  }

  try {
    const url = new URL(value, REDIRECT_BASE_URL);
    if (url.origin !== REDIRECT_BASE_URL) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function resolveSafeRedirectPath(input: unknown, fallback: string): string {
  return normalizeSafeRedirectPath(input) ?? fallback;
}
