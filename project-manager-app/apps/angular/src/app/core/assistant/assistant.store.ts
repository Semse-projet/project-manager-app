import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { AssistantApi, AssistantChatResponse, ProjectDraftSnapshot } from '../api/assistant.api';

export type AssistantChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

@Injectable({ providedIn: 'root' })
export class AssistantStore {
  private readonly assistantApi = inject(AssistantApi);

  private readonly _loading = signal(false);
  private readonly _messages = signal<AssistantChatMessage[]>([]);
  private readonly _error = signal<string | null>(null);
  private readonly _draft = signal<ProjectDraftSnapshot | null>(null);
  private readonly _budgetSuggestion = signal<AssistantChatResponse['budgetSuggestion'] | undefined>(undefined);
  private readonly _sessionId = signal<string | undefined>(undefined);
  private readonly _prefillHref = signal('/client/jobs/new');

  readonly loading = computed(() => this._loading());
  readonly messages = computed(() => this._messages());
  readonly error = computed(() => this._error());
  readonly draft = computed(() => this._draft());
  readonly budgetSuggestion = computed(() => this._budgetSuggestion());
  readonly prefillHref = computed(() => this._prefillHref());
  readonly hasDraft = computed(() => this._draft() !== null);

  send(message: string, pageRoute: string): boolean {
    const content = message.trim();
    if (!content || this._loading()) {
      return false;
    }

    this._loading.set(true);
    this._error.set(null);
    this._messages.update((items) => [...items, { role: 'user', content }]);

    this.assistantApi
      .chat(content, this._draft()?.id, this._sessionId(), pageRoute)
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe({
        next: (response) => {
          this._messages.update((items) => [...items, { role: 'assistant', content: response.reply }]);
          this._draft.set(response.draft);
          this._sessionId.set(response.sessionId);
          this._prefillHref.set(response.prefillHref);
          this._budgetSuggestion.set(response.budgetSuggestion);
        },
        error: (err: { error?: { error?: { message?: string } } }) => {
          this._error.set(err.error?.error?.message ?? 'No pudimos procesar la conversacion con el asistente.');
        },
      });

    return true;
  }

  confirmDraft() {
    const draft = this._draft();
    if (!draft || this._loading()) {
      return;
    }

    this._loading.set(true);
    this._error.set(null);
    this.assistantApi
      .confirmDraft(draft.id)
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe({
        next: (response) => {
          this._draft.set(response.draft);
          this._prefillHref.set(response.prefillHref);
        },
        error: () => {
          this._error.set('No pudimos confirmar el borrador.');
        },
      });
  }

  publishDraft(onPublished?: (jobUrl: string) => void) {
    const draft = this._draft();
    if (!draft || this._loading()) {
      return;
    }

    this._loading.set(true);
    this._error.set(null);
    this.assistantApi
      .publishFromDraft(draft.id)
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe({
        next: (response) => {
          this._draft.set(response.draft);
          onPublished?.(response.jobUrl);
        },
        error: () => {
          this._error.set('No pudimos publicar el trabajo desde el borrador.');
        },
      });
  }

  resetConversation() {
    this._messages.set([]);
    this._error.set(null);
    this._draft.set(null);
    this._sessionId.set(undefined);
    this._budgetSuggestion.set(undefined);
    this._prefillHref.set('/client/jobs/new');
  }
}
