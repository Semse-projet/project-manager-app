import { apiFetch } from "./client";

export type PrometeoChatRequest = { message?: string; threadId?: string; projectId?: string; agentId?: string; requestedAction?: string };
export type PrometeoChatResponse = { threadId: string; agentId: string; response: string; mode: string; timestamp: string; proposedActions?: Array<{ id: string; label: string; requiresApproval: boolean }> };

export function chatWithPrometeo(input: PrometeoChatRequest): Promise<PrometeoChatResponse> {
  return apiFetch<PrometeoChatResponse>("/v1/ai-models/prometeo/chat", { method: "POST", body: JSON.stringify({ ...input, attachments: [], selectedEntities: [] }) });
}
