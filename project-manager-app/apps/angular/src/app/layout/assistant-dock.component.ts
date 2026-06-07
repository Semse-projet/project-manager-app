import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AssistantStore } from '../core/assistant/assistant.store';
import { RouteContextService } from '../core/routing/route-context.service';
import { JobBuilderStore } from '../features/client/data/job-builder.store';
import { JobsStore } from '../features/client/data/jobs.store';
import { DraftPreviewCardComponent } from './draft-preview-card.component';

@Component({
  standalone: true,
  selector: 'app-assistant-dock',
  imports: [CommonModule, FormsModule, DraftPreviewCardComponent],
  template: `
    <button type="button" class="assistant-trigger" (click)="toggle()">
      <span class="assistant-trigger__orb"></span>
      <div>
        <strong>Prometeo</strong>
        <span>{{ assistantConfig().label }}</span>
      </div>
    </button>

    @if (open()) {
      <section class="assistant-panel section-card">
        <header class="assistant-panel__header">
          <div>
            <span class="page-eyebrow">SEMSE Assistant</span>
            <h3>{{ assistantConfig().title }}</h3>
          </div>
          <button type="button" class="assistant-panel__close" (click)="toggle()">Cerrar</button>
        </header>

        <div class="assistant-panel__chips">
          @for (prompt of quickPrompts(); track prompt) {
            <button type="button" class="pill assistant-panel__chip" (click)="send(prompt)">{{ prompt }}</button>
          }
        </div>

        <section class="assistant-panel__messages">
          @if (!messages().length) {
            <article class="assistant-panel__bubble is-assistant">
              {{ assistantConfig().subtitle }}
            </article>
          }

          @for (message of messages(); track $index) {
            <article class="assistant-panel__bubble" [class.is-user]="message.role === 'user'" [class.is-assistant]="message.role === 'assistant'">
              {{ message.content }}
            </article>
          }
        </section>

        @if (draft()) {
          <app-draft-preview-card
            [draft]="draft()!"
            [budgetSuggestion]="budgetSuggestion()"
            (confirmed)="confirmDraft()"
            (reviewed)="reviewDraft()"
            (published)="publishDraft()"
          />
        }

        @if (error()) {
          <div class="assistant-panel__error">{{ error() }}</div>
        }

        <footer class="assistant-panel__composer">
          <textarea
            class="textarea"
            rows="3"
            [ngModel]="composer()"
            (ngModelChange)="composer.set($event)"
            [placeholder]="assistantConfig().placeholder"
          ></textarea>
          <div class="assistant-panel__composer-actions">
            <button type="button" class="btn-ghost" (click)="resetConversation()">Limpiar</button>
            <button type="button" class="btn-primary" [disabled]="loading()" (click)="send()">
              {{ loading() ? 'Procesando...' : 'Enviar a Prometeo' }}
            </button>
          </div>
        </footer>
      </section>
    }
  `,
  styleUrl: './assistant-dock.component.scss',
})
export class AssistantDockComponent {
  protected readonly open = signal(false);
  protected readonly composer = signal('');

  private readonly router = inject(Router);
  private readonly routeContext = inject(RouteContextService);
  private readonly builderStore = inject(JobBuilderStore);
  private readonly jobsStore = inject(JobsStore);
  protected readonly assistantState = inject(AssistantStore);

  protected readonly assistantConfig = computed(() => this.routeContext.assistant());
  protected readonly quickPrompts = computed(() => this.assistantConfig().quickPrompts);
  protected readonly loading = this.assistantState.loading;
  protected readonly messages = this.assistantState.messages;
  protected readonly error = this.assistantState.error;
  protected readonly draft = this.assistantState.draft;
  protected readonly budgetSuggestion = this.assistantState.budgetSuggestion;
  protected readonly hasDraft = this.assistantState.hasDraft;

  toggle() {
    this.open.update((value) => !value);
  }

  send(forcedMessage?: string) {
    const message = (forcedMessage ?? this.composer()).trim();
    if (!message) {
      return;
    }

    this.open.set(true);
    if (this.assistantState.send(message, this.routeContext.routeKey())) {
      this.composer.set('');
    }
  }

  confirmDraft() {
    this.assistantState.confirmDraft();
  }

  publishDraft() {
    this.assistantState.publishDraft((jobUrl) => {
      this.open.set(false);
      this.jobsStore.refresh();
      void this.router.navigateByUrl(jobUrl);
    });
  }

  reviewDraft() {
    const draft = this.draft();
    if (draft) {
      this.builderStore.stageFromAssistantDraft(draft, this.budgetSuggestion());
      void this.router.navigate(['/client/jobs/new']);
    } else {
      void this.router.navigateByUrl(this.assistantState.prefillHref());
    }
    this.open.set(false);
  }

  resetConversation() {
    this.composer.set('');
    this.assistantState.resetConversation();
  }
}
