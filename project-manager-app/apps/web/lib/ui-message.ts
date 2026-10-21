/**
 * A user-facing message kept in React state. Translation keys are resolved
 * when rendering, so a later language switch also changes them; text that
 * came from the server is shown as received. Storing `t("…")` output in state
 * froze the message in the language active when it was set.
 */
export type UiMessage = { key: string; suffix?: string } | { text: string };

export function messageKey(key: string, suffix?: string): UiMessage {
  return suffix ? { key, suffix } : { key };
}

export function messageText(text: string): UiMessage {
  return { text };
}

/** Server-provided text when present, otherwise the translated fallback key. */
export function messageTextOr(text: string | null | undefined, fallbackKey: string): UiMessage {
  return text && text.trim() ? { text } : { key: fallbackKey };
}

/** An Error that carries a UiMessage, so a translation key survives throw/catch. */
export class UiMessageError extends Error {
  readonly uiMessage: UiMessage;

  constructor(uiMessage: UiMessage) {
    super("key" in uiMessage ? uiMessage.key : uiMessage.text);
    this.uiMessage = uiMessage;
  }
}

/** Anything caught, as a UiMessage: keys stay keys, server text stays text. */
export function messageFromError(error: unknown, fallbackKey: string): UiMessage {
  if (error instanceof UiMessageError) return error.uiMessage;
  return messageTextOr(error instanceof Error ? error.message : null, fallbackKey);
}

export function renderMessage(message: UiMessage | null, t: (key: string) => string): string | null {
  if (!message) return null;
  return "text" in message ? message.text : `${t(message.key)}${message.suffix ?? ""}`;
}
