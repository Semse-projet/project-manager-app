import type { SemseClient } from "../client.js";

export type AnalyzeInput = {
  intakeId?: string;
  rawDescription: string;
  title?: string;
  category?: string;
  subcategory?: string;
  modality?: "on_site" | "remote" | "hybrid";
  city?: string;
  urgency?: "low" | "medium" | "high" | "urgent";
};

export type AnswerInput = {
  questionId: string;
  selectedValues?: string[];
  customText?: string;
  isNotSure?: boolean;
};

/**
 * Smart-intake para satélites (scope intake:write / intake:read).
 * Primer consumidor: SAT-002 Alexa. El canal se marca con x-semse-channel.
 */
export class IntakeResource {
  constructor(private readonly client: SemseClient) {}

  async analyze<T = unknown>(input: AnalyzeInput, channel?: string): Promise<T> {
    return this.client.post<T>("/v1/intake/analyze", input, channelHeader(channel));
  }

  async answer<T = unknown>(intakeId: string, input: AnswerInput, channel?: string): Promise<T> {
    return this.client.patch<T>(`/v1/intake/${intakeId}/answer`, input, channelHeader(channel));
  }

  async get<T = unknown>(intakeId: string): Promise<T> {
    return this.client.get<T>(`/v1/intake/${intakeId}`);
  }
}

function channelHeader(channel?: string): Record<string, string> | undefined {
  return channel ? { "x-semse-channel": channel } : undefined;
}
