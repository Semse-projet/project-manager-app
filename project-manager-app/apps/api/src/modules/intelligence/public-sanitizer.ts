/**
 * Sanitización de datos que salen por superficies públicas sin autenticación
 * (landing, /worker/apply, /pro/[slug]).
 *
 * Regla: un visitante anónimo nunca debe ver direcciones exactas, emails ni
 * teléfonos de un lead o usuario, aunque el dato original los contenga.
 */

const STREET_WORDS =
  "(?:street|st|avenue|ave|boulevard|blvd|circle|cir|road|rd|drive|dr|lane|ln|court|ct|way|place|pl|terrace|ter|calle|avenida|av|colonia|col|privada|cerrada|andador|callejon|callejón|carretera)";

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/gi;

// Teléfonos de 9+ dígitos con separadores (evita presupuestos tipo "3500 - 5000").
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}\b/g;

// "4064 Hal's circle" / "1200 Main Street"
const STREET_ADDR_RE = new RegExp(
  String.raw`\b\d{1,5}\s+(?:[A-Za-zÀ-ÿ'’.]+\s+){0,4}${STREET_WORDS}\b\.?`,
  "gi",
);

// "Calle Hidalgo #23" / "Av. Reforma 1200"
const STREET_ADDR_ES_RE = new RegExp(
  String.raw`\b${STREET_WORDS}\.?\s+(?:[A-Za-zÀ-ÿ'’.]+\s+){0,4}#?\d{1,5}\b`,
  "gi",
);

const STREET_WORD_TOKEN_RE = new RegExp(`^${STREET_WORDS}\\.?$`, "i");

function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > maxLength * 0.6 ? lastSpace : maxLength).trimEnd()}…`;
}

/**
 * Redacta emails, teléfonos y direcciones de calle en texto libre público
 * (scope de jobs, comentarios de testimonios) y acota su largo.
 */
export function redactPublicText(text: string | null | undefined, maxLength = 280): string {
  if (!text) return "";
  const redacted = text
    .replace(EMAIL_RE, "[contacto retirado]")
    .replace(STREET_ADDR_RE, "[dirección retirada]")
    .replace(STREET_ADDR_ES_RE, "[dirección retirada]")
    .replace(PHONE_RE, (match) => {
      const digits = match.replace(/\D/g, "");
      return digits.length >= 9 ? "[contacto retirado]" : match;
    })
    .replace(/\s+/g, " ")
    .trim();
  return truncateAtWord(redacted, maxLength);
}

/**
 * Generaliza una ubicación a nivel ciudad/región: si contiene números o
 * palabras de calle se descartan esos segmentos y se conserva solo la cola
 * (ciudad, estado). "Naucalpan, Mex." pasa intacto; "4064 Hal's circle
 * Tallahassee Florida" se convierte en "Tallahassee Florida".
 */
export function generalizePublicLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  const trimmed = location.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;

  const looksExact = /\d/.test(trimmed) || STREET_ADDR_RE.test(trimmed) || STREET_ADDR_ES_RE.test(trimmed);
  // Los regex globales mantienen lastIndex entre llamadas: reiniciar.
  STREET_ADDR_RE.lastIndex = 0;
  STREET_ADDR_ES_RE.lastIndex = 0;
  if (!looksExact) return truncateAtWord(trimmed, 80);

  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    const safeParts = parts.filter(
      (part) => !/\d/.test(part) && !part.split(" ").some((word) => STREET_WORD_TOKEN_RE.test(word)),
    );
    if (safeParts.length > 0) {
      return truncateAtWord(safeParts.slice(-2).join(", "), 80);
    }
  }

  const safeWords = trimmed
    .replace(/,/g, " ")
    .split(" ")
    .filter((word) => word && !/\d/.test(word) && !STREET_WORD_TOKEN_RE.test(word) && !/^#/.test(word));
  const tail = safeWords.slice(-2).join(" ").trim();
  return tail.length > 0 ? truncateAtWord(tail, 80) : null;
}

/**
 * Nombre público de un usuario en testimonios: nunca el email. Si no hay
 * displayName se usa una etiqueta genérica.
 */
export function publicDisplayName(
  displayName: string | null | undefined,
  fallbackLabel = "Usuario verificado",
): string {
  const trimmed = displayName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallbackLabel;
}
