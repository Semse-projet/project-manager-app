import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AssistantChatResponse, ProjectDraftSnapshot } from '../core/api/assistant.api';
import { categoryName, subcategoryName } from '../features/client/job-intake.data';

@Component({
  standalone: true,
  selector: 'app-draft-preview-card',
  imports: [CommonModule],
  template: `
    <section class="draft-card">
      <header class="draft-card__header">
        <div>
          <span class="draft-card__eyebrow">Borrador vivo</span>
          <h3>Proyecto conversacional</h3>
        </div>
        <span class="draft-card__status" [class.is-confirmed]="draft.status !== 'in_progress'">
          {{ draft.status === 'published' ? 'Publicado' : draft.status === 'confirmed' ? 'Confirmado' : 'En progreso' }}
        </span>
      </header>

      <div class="draft-card__rows">
        <div class="draft-row">
          <span>Categoría</span>
          <strong>{{ formatCategory(draft.categoryId) || 'Pendiente' }}</strong>
        </div>
        <div class="draft-row">
          <span>Especialidad</span>
          <strong>{{ formatSubcategory(draft.subcategoryId) || 'Pendiente' }}</strong>
        </div>
        <div class="draft-row">
          <span>Título</span>
          <strong>{{ draft.title || 'Pendiente' }}</strong>
        </div>
        <div class="draft-row">
          <span>Ciudad</span>
          <strong>{{ draft.city || 'Pendiente' }}</strong>
        </div>
        <div class="draft-row">
          <span>Presupuesto</span>
          <strong>{{ budgetLabel() }}</strong>
        </div>
        @if (draft.attachmentsExpected) {
          <div class="draft-row">
            <span>Archivos</span>
            <strong>Esperados</strong>
          </div>
        }
      </div>

      @if (budgetSuggestion && !draft.budgetMin && !draft.budgetMax) {
        <section class="draft-card__budget">
          <span class="pill">IA · {{ confidenceLabel(budgetSuggestion.confidence) }}</span>
          <strong>\${{ budgetSuggestion.min | number:'1.0-0' }} - \${{ budgetSuggestion.max | number:'1.0-0' }}</strong>
          <p>{{ budgetSuggestion.aiNarrative }}</p>
        </section>
      }

      <section class="draft-card__progress">
        <div class="draft-card__progress-header">
          <span>Completado</span>
          <strong>{{ draft.completion }}%</strong>
        </div>
        <div class="draft-card__bar">
          <div class="draft-card__bar-fill" [style.width.%]="draft.completion"></div>
        </div>
      </section>

      <footer class="draft-card__actions">
        @if (draft.completion >= 70 && draft.status === 'in_progress') {
          <button type="button" class="btn-secondary" (click)="confirmed.emit()">Confirmar borrador</button>
        }
        @if (draft.completion >= 70) {
          <button type="button" class="btn-ghost" (click)="reviewed.emit()">Revisar formulario</button>
        }
        @if (draft.status === 'confirmed') {
          <button type="button" class="btn-primary" (click)="published.emit()">Publicar trabajo</button>
        }
      </footer>
    </section>
  `,
  styleUrl: './draft-preview-card.component.scss',
})
export class DraftPreviewCardComponent {
  @Input({ required: true }) draft!: ProjectDraftSnapshot;
  @Input() budgetSuggestion?: AssistantChatResponse['budgetSuggestion'];

  @Output() readonly confirmed = new EventEmitter<void>();
  @Output() readonly reviewed = new EventEmitter<void>();
  @Output() readonly published = new EventEmitter<void>();

  formatCategory(categoryId: string | null | undefined) {
    return categoryName(categoryId);
  }

  formatSubcategory(subcategoryId: string | null | undefined) {
    return subcategoryName(subcategoryId);
  }

  budgetLabel() {
    if (this.draft.budgetMin != null && this.draft.budgetMax != null) {
      return `$${this.draft.budgetMin.toLocaleString()} - $${this.draft.budgetMax.toLocaleString()}`;
    }
    if (this.draft.budgetMin != null) {
      return `Desde $${this.draft.budgetMin.toLocaleString()}`;
    }
    return 'Pendiente';
  }

  confidenceLabel(value: string) {
    if (value === 'high') {
      return 'Alta confianza';
    }
    if (value === 'medium') {
      return 'Media confianza';
    }
    return 'Baja confianza';
  }
}
