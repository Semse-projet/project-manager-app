import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { AssistantChatResponse, ProjectDraftSnapshot } from '../../../core/api/assistant.api';
import { JobBudgetType, JobIntakePrefill, JobLocationType } from '../job-intake.data';

export type JobBuilderDraftSource = 'empty' | 'route' | 'assistant' | 'local';
export type JobBuilderStep = 1 | 2 | 3 | 4;

export type JobBuilderDraft = JobIntakePrefill & {
  attachmentsExpected: boolean;
  assistantDraftId: string | null;
  budgetConfirmed: boolean;
  source: JobBuilderDraftSource;
  updatedAt: number;
};

type JobBuilderPersistedState = {
  draft: Partial<JobBuilderDraft>;
  step?: number;
};

const STORAGE_KEY = 'semse_job_builder_draft_v1';
const STEP_TITLES = [
  'Categoria y especialidad',
  'Contexto del proyecto',
  'Presupuesto',
  'Revision final',
] as const;

function baseDraft(): JobBuilderDraft {
  return {
    categoryId: '',
    subcategoryId: '',
    title: '',
    description: '',
    locationType: 'on_site',
    city: '',
    budgetType: 'range',
    budgetMin: 500,
    budgetMax: 2000,
    urgency: 'medium',
    attachmentsExpected: false,
    assistantDraftId: null,
    budgetConfirmed: false,
    source: 'empty',
    updatedAt: Date.now(),
  };
}

function normalizeBudgetType(value: string | null | undefined): JobBudgetType {
  if (value === 'fixed' || value === 'hourly') {
    return value;
  }
  return 'range';
}

function normalizeLocationType(value: string | null | undefined): JobLocationType {
  if (value === 'remote' || value === 'hybrid') {
    return value;
  }
  return 'on_site';
}

function normalizeBudgetNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeDraft(
  input: Partial<JobBuilderDraft>,
  source: JobBuilderDraftSource,
  fallback = baseDraft(),
): JobBuilderDraft {
  const budgetMin = normalizeBudgetNumber(input.budgetMin, fallback.budgetMin);
  const budgetMax = normalizeBudgetNumber(input.budgetMax, fallback.budgetMax);

  return {
    categoryId: input.categoryId?.trim() ?? fallback.categoryId,
    subcategoryId: input.subcategoryId?.trim() ?? fallback.subcategoryId,
    title: input.title?.trim() ?? fallback.title,
    description: input.description?.trim() ?? fallback.description,
    locationType: normalizeLocationType(input.locationType),
    city: input.city?.trim() ?? fallback.city,
    budgetType: normalizeBudgetType(input.budgetType),
    budgetMin,
    budgetMax: Math.max(budgetMax, budgetMin),
    urgency: input.urgency?.trim() || fallback.urgency,
    attachmentsExpected: typeof input.attachmentsExpected === 'boolean' ? input.attachmentsExpected : fallback.attachmentsExpected,
    assistantDraftId: input.assistantDraftId ?? fallback.assistantDraftId,
    budgetConfirmed: typeof input.budgetConfirmed === 'boolean' ? input.budgetConfirmed : fallback.budgetConfirmed,
    source,
    updatedAt: Date.now(),
  };
}

function hasValidBudgetRange(draft: Pick<JobBuilderDraft, 'budgetType' | 'budgetMin' | 'budgetMax'>): boolean {
  return draft.budgetMin > 0 && (draft.budgetType !== 'range' || draft.budgetMax >= draft.budgetMin);
}

function computeMaxAvailableStep(draft: JobBuilderDraft): JobBuilderStep {
  if (!draft.categoryId.trim() || !draft.subcategoryId.trim()) {
    return 1;
  }
  if (draft.title.trim().length < 5 || draft.description.trim().length < 20) {
    return 2;
  }
  if (!draft.budgetConfirmed || !hasValidBudgetRange(draft)) {
    return 3;
  }
  return 4;
}

function suggestedStepForDraft(draft: JobBuilderDraft): JobBuilderStep {
  return computeMaxAvailableStep(draft);
}

function normalizeStep(value: number | undefined, fallback: JobBuilderStep): JobBuilderStep {
  if (value === 2 || value === 3 || value === 4) {
    return value;
  }
  return fallback;
}

@Injectable({ providedIn: 'root' })
export class JobBuilderStore {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);
  private readonly initialState = this.loadState();
  private readonly _draft = signal<JobBuilderDraft>(this.initialState.draft);
  private readonly _step = signal<JobBuilderStep>(this.initialState.step);

  readonly draft = computed(() => this._draft());
  readonly step = computed(() => this._step());
  readonly stepTitle = computed(() => STEP_TITLES[this._step() - 1]);
  readonly maxAvailableStep = computed(() => computeMaxAvailableStep(this._draft()));
  readonly canProceed = computed(() => this._step() < this.maxAvailableStep() || this._step() === 4);
  readonly source = computed(() => this._draft().source);
  readonly hasMeaningfulDraft = computed(() => {
    const draft = this._draft();
    return Boolean(draft.categoryId || draft.subcategoryId || draft.title || draft.description || draft.city);
  });

  stageFromRoute(prefill: JobIntakePrefill, budgetConfirmed = false): JobBuilderDraft {
    return this.replaceDraft({ ...prefill, budgetConfirmed }, 'route', 'suggest');
  }

  stageFromAssistantDraft(
    draft: ProjectDraftSnapshot,
    budgetSuggestion?: AssistantChatResponse['budgetSuggestion'],
  ): JobBuilderDraft {
    const resolvedBudgetMin = draft.budgetMin ?? budgetSuggestion?.min ?? 500;
    const resolvedBudgetMax = draft.budgetMax ?? budgetSuggestion?.max ?? Math.max(2000, resolvedBudgetMin);
    const budgetType: JobBudgetType = resolvedBudgetMin > 0 && resolvedBudgetMax > 0 ? 'range' : 'fixed';
    return this.replaceDraft(
      {
        categoryId: draft.categoryId ?? '',
        subcategoryId: draft.subcategoryId ?? '',
        title: draft.title ?? '',
        description: draft.description ?? '',
        locationType: normalizeLocationType(draft.locationType),
        city: draft.city ?? '',
        budgetType,
        budgetMin: resolvedBudgetMin,
        budgetMax: resolvedBudgetMax,
        urgency: draft.urgency ?? 'medium',
        attachmentsExpected: draft.attachmentsExpected === true,
        assistantDraftId: draft.id,
        budgetConfirmed: draft.budgetMin != null || draft.budgetMax != null || Boolean(budgetSuggestion),
      },
      'assistant',
      'suggest',
    );
  }

  updateFromForm(value: JobIntakePrefill, meta?: Partial<Pick<JobBuilderDraft, 'budgetConfirmed' | 'attachmentsExpected' | 'assistantDraftId'>>) {
    const current = this._draft();
    const next = normalizeDraft(
      { ...value, ...meta },
      current.source === 'empty' ? 'local' : current.source,
      current,
    );
    this._draft.set(next);
    this.clampStep();
    this.persist();
  }

  clear() {
    const draft = baseDraft();
    this._draft.set(draft);
    this._step.set(1);
    this.persist();
  }

  jumpTo(step: JobBuilderStep) {
    if (step <= this.maxAvailableStep()) {
      this._step.set(step);
      this.persist();
    }
  }

  previousStep() {
    this._step.update((value) => (value > 1 ? ((value - 1) as JobBuilderStep) : 1));
    this.persist();
  }

  nextStep() {
    const current = this._step();
    const next = Math.min(current + 1, this.maxAvailableStep()) as JobBuilderStep;
    if (next !== current) {
      this._step.set(next);
      this.persist();
    }
  }

  private replaceDraft(
    value: Partial<JobBuilderDraft>,
    source: JobBuilderDraftSource,
    stepMode: 'preserve' | 'suggest' = 'preserve',
  ): JobBuilderDraft {
    const next = normalizeDraft(value, source);
    this._draft.set(next);
    if (stepMode === 'suggest') {
      this._step.set(suggestedStepForDraft(next));
    } else {
      this.clampStep();
    }
    this.persist();
    return next;
  }

  private loadState(): { draft: JobBuilderDraft; step: JobBuilderStep } {
    if (!this.browser) {
      const draft = baseDraft();
      return { draft, step: suggestedStepForDraft(draft) };
    }

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const draft = baseDraft();
        return { draft, step: suggestedStepForDraft(draft) };
      }

      const parsed = JSON.parse(raw) as JobBuilderPersistedState;
      const draft = normalizeDraft(parsed.draft ?? {}, parsed.draft?.source ?? 'local');
      const fallbackStep = suggestedStepForDraft(draft);
      const step = Math.min(normalizeStep(parsed.step, fallbackStep), computeMaxAvailableStep(draft)) as JobBuilderStep;
      return { draft, step };
    } catch {
      const draft = baseDraft();
      return { draft, step: suggestedStepForDraft(draft) };
    }
  }

  private clampStep() {
    const next = Math.min(this._step(), this.maxAvailableStep()) as JobBuilderStep;
    if (next !== this._step()) {
      this._step.set(next);
    }
  }

  private persist() {
    if (!this.browser) {
      return;
    }

    try {
      const state: JobBuilderPersistedState = {
        draft: this._draft(),
        step: this._step(),
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage write failures in private mode / quotas
    }
  }
}
