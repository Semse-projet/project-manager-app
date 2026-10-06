/**
 * Clasificador de acciones de chat (spec `prometeo.chat-actions`, D1).
 *
 * PURO y de vocabulario CERRADO: recibe texto y devuelve una de tres clases (`create_job`, `navigate`, `none`) y, para
 * `navigate`, el id de una ruta del catálogo. No hay I/O, no hay modelo, y el texto del usuario nunca elige una
 * herramienta, una ruta fuera del catálogo ni parámetros: lo único que se extrae es una clase y un id conocido.
 */

export const CHAT_ACTIONS_VOCABULARY_VERSION = 1;

export type ChatActionKind = "create_job" | "navigate" | "none";

export type ChatActionIntent = {
  kind: ChatActionKind;
  /** Solo en `navigate`: un id del catálogo de rutas (nunca una ruta escrita por el usuario). */
  routeId?: string;
  confidence: number;
};

/** Palabras que el normalizador puede separar cuando vienen pegadas ("quieroplanear"). Lista cerrada, sin heurística libre. */
const KNOWN_WORDS: ReadonlySet<string> = new Set([
  "quiero", "necesito", "deseo", "quisiera", "voy", "vamos",
  "planear", "planea", "crear", "crea", "publicar", "publica", "registrar", "registra", "armar", "arma",
  "guardar", "guarda", "guardes", "guardalo",
  "trabajo", "trabajos", "nuevo", "nueva",
  "llevame", "lleva", "abre", "abrir", "muestrame", "muestra", "mostrar",
  "dashboard", "inicio", "tablero", "disputa", "disputas", "evidencia", "evidencias", "pago", "pagos",
  "finanzas", "proyecto", "proyectos", "perfil", "cuenta", "hito", "hitos",
  "un", "una", "el", "la", "los", "las", "mi", "mis", "de", "a", "al", "es", "que", "lo", "para", "dar", "dame", "alta",
]);

const MIN_PREFIX = 4;

/** Parte `token` en palabras conocidas solo si TODO el token se explica con ellas; si no, devuelve `null`. */
function splitKnown(token: string): string[] | null {
  if (KNOWN_WORDS.has(token)) return [token];
  for (let len = token.length - 1; len >= MIN_PREFIX; len -= 1) {
    const prefix = token.slice(0, len);
    if (!KNOWN_WORDS.has(prefix)) continue;
    const rest = splitKnown(token.slice(len));
    if (rest) return [prefix, ...rest];
  }
  return null;
}

/** Minúsculas, sin acentos ni signos, espacios colapsados y palabras pegadas conocidas separadas. */
export function normalizeMessage(text: string): string {
  const base = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "";
  return base
    .split(" ")
    .flatMap((token) => {
      if (KNOWN_WORDS.has(token) || token.length < MIN_PREFIX * 2) return [token];
      const parts = splitKnown(token);
      return parts && parts.length > 1 ? parts : [token];
    })
    .join(" ");
}

const CREATE_VERBS: ReadonlySet<string> = new Set([
  "crear", "crea", "publicar", "publica", "planear", "planea", "registrar", "registra", "armar", "arma",
  "guardar", "guarda", "guardes", "guardalo", "alta",
]);
const INTENT_MARKERS: ReadonlySet<string> = new Set([
  "quiero", "necesito", "deseo", "quisiera", "voy", "vamos", "abre", "abrir", "es",
]);
const NEGATIONS: ReadonlySet<string> = new Set(["no", "nunca", "jamas", "tampoco", "sin"]);
const NAV_VERBS: ReadonlySet<string> = new Set(["llevame", "lleva", "ir", "ve", "vamos", "abre", "abrir", "muestrame", "muestra", "mostrar"]);

/** Alias de cada destino → id del catálogo de rutas. Debe coincidir con `route-catalog.ts` (lo cubre una prueba). */
const ROUTE_ALIASES: Readonly<Record<string, string>> = {
  dashboard: "dashboard", inicio: "dashboard", tablero: "dashboard",
  disputa: "disputes", disputas: "disputes",
  evidencia: "evidence", evidencias: "evidence",
  pago: "payments", pagos: "payments", finanzas: "payments",
  proyecto: "projects", proyectos: "projects", trabajos: "projects",
  perfil: "profile", cuenta: "profile",
  hito: "milestones", hitos: "milestones",
};

function isNegated(tokens: string[], verbIndex: number): boolean {
  return tokens.slice(Math.max(0, verbIndex - 3), verbIndex).some((t) => NEGATIONS.has(t));
}

function detectCreateJob(tokens: string[]): number {
  if (!tokens.includes("trabajo")) return 0;
  const verbIndex = tokens.findIndex((t) => CREATE_VERBS.has(t));
  if (verbIndex >= 0 && !isNegated(tokens, verbIndex)) return 0.9;

  const at = tokens.indexOf("trabajo");
  const newAdjacent = tokens[at + 1] === "nuevo" || tokens[at - 1] === "nuevo" || tokens[at + 1] === "nueva";
  const markerIndex = tokens.findIndex((t) => INTENT_MARKERS.has(t));
  if (newAdjacent && markerIndex >= 0 && !isNegated(tokens, markerIndex)) return 0.75;
  return 0;
}

function detectNavigation(tokens: string[]): string | undefined {
  let verbIndex = tokens.findIndex((t) => NAV_VERBS.has(t));
  if (verbIndex < 0) {
    const ver = tokens.indexOf("ver");
    if (ver > 0 && ["quiero", "necesito", "quisiera"].includes(tokens[ver - 1]!)) verbIndex = ver;
  }
  if (verbIndex < 0 || isNegated(tokens, verbIndex)) return undefined;
  for (const token of tokens.slice(verbIndex + 1)) {
    const routeId = ROUTE_ALIASES[token];
    if (routeId) return routeId;
  }
  return undefined;
}

export function classifyChatAction(message: string): ChatActionIntent {
  const tokens = normalizeMessage(message).split(" ").filter(Boolean);
  if (tokens.length === 0) return { kind: "none", confidence: 0 };

  const createConfidence = detectCreateJob(tokens);
  if (createConfidence > 0) return { kind: "create_job", confidence: createConfidence };

  const routeId = detectNavigation(tokens);
  if (routeId) return { kind: "navigate", routeId, confidence: 0.8 };

  return { kind: "none", confidence: 0 };
}

export const CHAT_ROUTE_ALIAS_IDS: readonly string[] = Array.from(new Set(Object.values(ROUTE_ALIASES)));
