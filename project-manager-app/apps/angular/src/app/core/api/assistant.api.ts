import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api.client';

export interface ProjectDraftSnapshot {
  id: string;
  status: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  title?: string | null;
  description?: string | null;
  city?: string | null;
  locationType?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  urgency?: string | null;
  attachmentsExpected?: boolean;
  publishedJobId?: string | null;
  completion: number;
}

export interface AssistantChatResponse {
  reply: string;
  draftId: string;
  draft: ProjectDraftSnapshot;
  prefillHref: string;
  completion: number;
  sessionId: string;
  readyToFill: boolean;
  budgetSuggestion?: { min: number; max: number; median: number; confidence: string; aiNarrative: string };
}

export interface AssistantConfirmResponse { draft: ProjectDraftSnapshot; prefillHref: string; }
export interface AssistantPublishResponse { jobId: string; draft: ProjectDraftSnapshot; jobUrl: string; }

@Injectable({ providedIn: 'root' })
export class AssistantApi {
  constructor(private api: ApiClient) {}

  chat(msg: string, draftId?: string, sessionId?: string, pageRoute?: string): Observable<AssistantChatResponse> {
    return this.api.post<AssistantChatResponse>('/assistant/publish-job', { message: msg, draftId, sessionId, pageRoute });
  }

  confirmDraft(draftId: string): Observable<AssistantConfirmResponse> {
    return this.api.post<AssistantConfirmResponse>('/assistant/confirm-draft', { draftId });
  }

  publishFromDraft(draftId: string): Observable<AssistantPublishResponse> {
    return this.api.post<AssistantPublishResponse>('/assistant/publish-from-draft', { draftId });
  }
}
