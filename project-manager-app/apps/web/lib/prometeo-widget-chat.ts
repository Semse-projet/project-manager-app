/**
 * El widget flotante de Prometeo usa `POST /v1/prometeo/copilot/message`, que solo clasifica la intención por
 * palabras clave y devuelve un texto fijo ("Puedo ayudarte con presupuestos…") para toda pregunta general. Las
 * preguntas generales se responden ahora con el chat real de Prometeo (`/api/semse/cortex/chat`, que arma el
 * contexto operativo y llama al modelo). Estas funciones son puras para poder probarlas sin red.
 */

export type WidgetChatContext = {
  module: string;
  resource?: { id?: string | null; type?: string | null } | null;
} | null;

export type WidgetChatRequest = {
  message: string;
  threadId?: string;
  projectId?: string;
  pageContext: { route?: string; module?: string };
};

export type RuntimeChatData = {
  threadId?: string;
  response?: string;
  message?: string;
  mode?: string;
};

/** `projectId` solo si la pantalla es de un proyecto: un id de trabajo o de otro recurso no es un proyecto. */
export function buildWidgetChatRequest(input: {
  message: string;
  threadId?: string;
  context: WidgetChatContext;
  route?: string;
}): WidgetChatRequest {
  const { context } = input;
  const projectId =
    context?.resource?.type === "project" && context.resource.id ? context.resource.id : undefined;
  return {
    message: input.message,
    ...(input.threadId ? { threadId: input.threadId } : {}),
    ...(projectId ? { projectId } : {}),
    pageContext: {
      ...(input.route ? { route: input.route } : {}),
      ...(context?.module ? { module: context.module } : {}),
    },
  };
}

/**
 * Solo se usa la respuesta del chat real si viene del runtime: en modo demo el endpoint devuelve textos de
 * muestra que no reflejan datos del usuario, y mostrarlos como respuesta de Prometeo sería engañoso.
 */
export function pickRuntimeReply(data: RuntimeChatData | null | undefined): string | null {
  if (!data || data.mode !== "runtime") return null;
  const text = (data.response ?? data.message ?? "").trim();
  return text.length > 0 ? text : null;
}
