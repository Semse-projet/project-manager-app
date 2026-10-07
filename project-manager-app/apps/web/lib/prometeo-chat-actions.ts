/**
 * Acciones de chat de Prometeo (spec `prometeo.chat-actions`): lo que el servidor propone en `proposedActions` con
 * `namespace: "chat"` y cómo lo muestran el widget y el panel del orquestador. Funciones puras para poder probarlas.
 *
 * Nada se ejecuta solo: cada acción es un botón. Aun así el cliente NO confía en la ruta que llega del servidor: solo
 * navega a rutas relativas de los espacios conocidos (segunda barrera además del catálogo cerrado del servidor).
 */

export type ChatActionKind = "create_job_draft" | "navigate" | "analyze_evidence";

export type ChatActionView = {
  id: string;
  kind: ChatActionKind;
  label: string;
  /** Ruta relativa ya validada; `null` si la acción no tiene una (p. ej. crear trabajo para un rol sin asistente propio). */
  route: string | null;
  /** Solo en `analyze_evidence`: id de la evidencia (forma segura ya validada). */
  evidenceId?: string;
};

type RawAction = {
  id?: unknown;
  namespace?: unknown;
  tool?: unknown;
  label?: unknown;
  input?: unknown;
};

const SAFE_ROUTE = /^\/(client|worker|admin)\/[a-z0-9][a-z0-9/-]*$/;
const SAFE_EVIDENCE_ID = /^[A-Za-z0-9_.:-]{1,64}$/;

/** Solo rutas relativas de los espacios de la app, sin esquema, host, parámetros, fragmentos ni `..`. */
export function safeChatRoute(route: unknown): string | null {
  if (typeof route !== "string") return null;
  if (route.includes("//") || route.includes("..")) return null;
  return SAFE_ROUTE.test(route) ? route : null;
}

export function isChatAction(action: RawAction | null | undefined): boolean {
  return Boolean(action) && action!.namespace === "chat" && (action!.tool === "create_job_draft" || action!.tool === "navigate" || action!.tool === "analyze_evidence");
}

/** Acciones de chat del envelope, en una forma lista para pintar. Las desconocidas o con ruta insegura se descartan. */
export function toChatActionViews(actions: ReadonlyArray<RawAction> | null | undefined): ChatActionView[] {
  const views: ChatActionView[] = [];
  for (const action of actions ?? []) {
    if (!isChatAction(action)) continue;
    const kind = action.tool as ChatActionKind;
    const input = action.input && typeof action.input === "object" ? (action.input as { route?: unknown; evidenceId?: unknown }) : {};
    const route = safeChatRoute(input.route);
    // Evidencias en el chat (spec prometeo.chat-evidence): el botón solo existe con un id de evidencia de forma segura.
    const evidenceId = typeof input.evidenceId === "string" && SAFE_EVIDENCE_ID.test(input.evidenceId) ? input.evidenceId : null;
    if (kind === "analyze_evidence" && !evidenceId) continue;
    if (kind === "navigate" && !route) continue; // navegar sin un destino válido no es una acción
    const label = typeof action.label === "string" && action.label.trim() ? action.label.trim().slice(0, 80) : kind === "navigate" ? "Ir allí" : kind === "analyze_evidence" ? "Analizar con visión" : "Crear el trabajo";
    const id = typeof action.id === "string" && action.id ? action.id : `chat-${kind}`;
    if (views.some((v) => v.id === id)) continue;
    views.push({ id, kind, label, route, ...(kind === "analyze_evidence" && evidenceId ? { evidenceId } : {}) });
  }
  return views;
}
