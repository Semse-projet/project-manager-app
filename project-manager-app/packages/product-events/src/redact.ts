/**
 * Redacción en cliente (PI-02.2). Regla de la spec: ningún payload puede
 * salir del navegador con emails, teléfonos o direcciones, aunque el
 * instrumentador se equivoque y pase texto libre en una prop.
 */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/gi;

// Teléfonos con 9+ dígitos y separadores; no toca números sueltos cortos.
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}\b/g;

const STREET_WORDS =
  "(?:street|st|avenue|ave|boulevard|blvd|circle|cir|road|rd|drive|dr|lane|ln|court|ct|way|place|pl|terrace|ter|calle|avenida|av|colonia|col|privada|cerrada|andador|callejon|callejón|carretera)";

const STREET_ADDR_RE = new RegExp(
  String.raw`\b\d{1,5}\s+(?:[A-Za-zÀ-ÿ'’.]+\s+){0,4}${STREET_WORDS}\b\.?`,
  "gi",
);

const STREET_ADDR_ES_RE = new RegExp(
  String.raw`\b${STREET_WORDS}\.?\s+(?:[A-Za-zÀ-ÿ'’.]+\s+){0,4}#?\d{1,5}\b`,
  "gi",
);

export const REDACTED = "[redacted]";

export function redactValue(value: string): string {
  return value
    .replace(EMAIL_RE, REDACTED)
    .replace(STREET_ADDR_RE, REDACTED)
    .replace(STREET_ADDR_ES_RE, REDACTED)
    .replace(PHONE_RE, (match) => {
      const digits = match.replace(/\D/g, "");
      return digits.length >= 9 ? REDACTED : match;
    });
}

export type ScalarProp = string | number | boolean | null;

/** Redacta todos los valores string de un objeto de props. */
export function redactProps(props: Record<string, ScalarProp>): Record<string, ScalarProp> {
  const out: Record<string, ScalarProp> = {};
  for (const [key, value] of Object.entries(props)) {
    out[key] = typeof value === "string" ? redactValue(value) : value;
  }
  return out;
}

/** Quita query string y hash de una ruta antes de reportarla. */
export function sanitizeRoute(route: string): string {
  const cut = route.split(/[?#]/)[0] ?? route;
  return redactValue(cut).slice(0, 300);
}
