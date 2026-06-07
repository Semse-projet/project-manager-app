import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { IntelligenceApi, BudgetSuggestion } from '../../core/api/intelligence.api';
import {
  JOB_CATEGORIES,
  JOB_URGENCY_OPTIONS,
  JobBudgetType,
  JobLocationType,
  type JobIntakePrefill,
  parseJobIntakePrefill,
} from './job-intake.data';
import { deriveJobBuilderFlow } from './data/job-builder-flow';
import { JobBuilderStep, JobBuilderStore } from './data/job-builder.store';
import { JobsStore } from './data/jobs.store';

@Component({
  standalone: true,
  selector: 'app-client-job-builder-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-shell">
      <section class="page-hero">
        <div>
          <span class="page-eyebrow">Conversational Project Builder</span>
          <h1 class="page-title">Publica el trabajo sin perder contexto.</h1>
          <p class="page-copy">
            El chat flotante puede prellenar este flujo. Aquí terminas el expediente, validas el rango
            y publicas el job real en el marketplace operativo.
          </p>
        </div>
        <a routerLink="/client/jobs" class="btn-secondary">Ver trabajos</a>
      </section>

      @if (prefilled()) {
        <section class="section-card builder-banner">
          {{ builderBannerCopy() }}
        </section>
      }

      <div class="builder-grid">
        <section class="section-card builder-main" [formGroup]="form">
          <header class="builder-main__header">
            <div>
              <span class="pill">Paso {{ step() }} de 4</span>
              <h2>{{ stepTitle() }}</h2>
            </div>
            <div class="builder-main__steps">
              @for (index of [1, 2, 3, 4]; track index) {
                <button
                  type="button"
                  class="builder-step"
                  [class.is-active]="step() === index"
                  [class.is-open]="index <= maxAvailableStep()"
                  (click)="jumpTo(index)"
                >
                  {{ index }}
                </button>
              }
            </div>
          </header>

          @if (step() === 1) {
            <div class="builder-options">
              @for (category of categories; track category.id) {
                <button
                  type="button"
                  class="builder-option"
                  [class.is-selected]="categoryId() === category.id"
                  (click)="selectCategory(category.id)"
                >
                  <strong>{{ category.name }}</strong>
                  <span>{{ category.subcategories.length }} especialidades</span>
                </button>
              }
            </div>

            @if (selectedCategory()) {
              <div class="builder-subcategories">
                @for (subcategory of selectedCategory()!.subcategories; track subcategory.id) {
                  <button
                    type="button"
                    class="builder-subcategory"
                    [class.is-selected]="subcategoryId() === subcategory.id"
                    (click)="selectSubcategory(subcategory.id)"
                  >
                    <strong>{{ subcategory.name }}</strong>
                    <span>Referencia desde \${{ subcategory.basePrice | number:'1.0-0' }}</span>
                  </button>
                }
              </div>
            }
          }

          @if (step() === 2) {
            <div class="builder-form">
              <label>Title
                <input class="field" formControlName="title" />
                @if (showTitleError()) {
                  <small class="builder-hint is-error">Usa al menos 5 caracteres para que Prometeo pueda clasificarlo mejor.</small>
                }
              </label>
              <label>Ciudad
                <input class="field" formControlName="city" />
              </label>
              <label class="builder-form__wide">Descripcion
                <textarea class="textarea" formControlName="description"></textarea>
                @if (showDescriptionError()) {
                  <small class="builder-hint is-error">Describe más el alcance. Necesitamos al menos 20 caracteres.</small>
                }
              </label>
              <label>Modalidad
                <select class="select" formControlName="locationType">
                  <option value="on_site">On site</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="remote">Remote</option>
                </select>
              </label>
              <label>Urgencia
                <select class="select" formControlName="urgency">
                  @for (option of urgencyOptions; track option.value) {
                    <option [value]="option.value">{{ option.label }}</option>
                  }
                </select>
              </label>
              <label class="builder-form__wide">Archivos
                <input class="field" type="file" multiple (change)="onFilesSelected($event)" />
                @if (files().length) {
                  <small class="builder-hint">{{ files().length }} archivo(s) listos para adjuntar en la siguiente fase.</small>
                }
              </label>
            </div>
          }

          @if (step() === 3) {
            <div class="builder-budget">
              <div class="builder-options is-compact">
                @for (type of budgetTypes; track type.value) {
                  <button
                    type="button"
                    class="builder-option"
                    [class.is-selected]="budgetType() === type.value"
                    (click)="setBudgetType(type.value)"
                  >
                    <strong>{{ type.label }}</strong>
                    <span>{{ type.copy }}</span>
                  </button>
                }
              </div>

              <div class="builder-form">
                <label>Budget min
                  <input class="field" type="number" formControlName="budgetMin" />
                </label>
                <label>Budget max
                  <input class="field" type="number" [disabled]="budgetType() !== 'range'" formControlName="budgetMax" />
                </label>
              </div>

              @if (showBudgetError()) {
                <div class="builder-error">
                  El presupuesto debe ser mayor que cero y, si usas rango, el máximo no puede ser menor al mínimo.
                </div>
              }

              <div class="builder-budget__actions">
                <button type="button" class="btn-secondary" [disabled]="budgetLoading()" (click)="suggestBudget()">
                  {{ budgetLoading() ? 'Calculando...' : 'Sugerir rango con IA' }}
                </button>
              </div>

              @if (budgetSuggestion()) {
                <article class="builder-budget__suggestion">
                  <span class="pill">IA · {{ confidenceLabel(budgetSuggestion()!.confidence) }}</span>
                  <strong>\${{ budgetSuggestion()!.min | number:'1.0-0' }} - \${{ budgetSuggestion()!.max | number:'1.0-0' }}</strong>
                  <p>{{ budgetSuggestion()!.aiNarrative }}</p>
                </article>
              }
            </div>
          }

          @if (step() === 4) {
            <div class="builder-review">
              <div class="builder-review__row"><span>Categoría</span><strong>{{ selectedCategory()?.name || 'Pendiente' }}</strong></div>
              <div class="builder-review__row"><span>Especialidad</span><strong>{{ selectedSubcategory()?.name || 'Pendiente' }}</strong></div>
              <div class="builder-review__row"><span>Título</span><strong>{{ title() || 'Pendiente' }}</strong></div>
              <div class="builder-review__row"><span>Ciudad</span><strong>{{ city() || 'Pendiente' }}</strong></div>
              <div class="builder-review__row"><span>Presupuesto</span><strong>{{ budgetLabel() }}</strong></div>
              <div class="builder-review__row"><span>Archivos</span><strong>{{ files().length ? files().length + ' listos' : 'Sin archivos' }}</strong></div>
              <p class="builder-review__copy">{{ description() || 'Sin descripcion' }}</p>
            </div>
          }

          @if (error()) {
            <div class="builder-error">{{ error() }}</div>
          }

          <footer class="builder-main__footer">
            <button type="button" class="btn-ghost" [disabled]="step() === 1" (click)="previousStep()">Anterior</button>
            @if (step() < 4) {
              <button type="button" class="btn-primary" [disabled]="!canProceed()" (click)="nextStep()">Continuar</button>
            } @else {
              <button type="button" class="btn-primary" [disabled]="submitting()" (click)="publish()">
                {{ submitting() ? 'Publicando...' : 'Publicar trabajo' }}
              </button>
            }
          </footer>
        </section>

        <aside class="section-card builder-side">
          <span class="pill">Flow</span>
          <div class="builder-flow">
            <div class="builder-review__row"><span>Estado</span><strong>{{ flowSnapshot().stateLabel }}</strong></div>
            <div class="builder-review__row"><span>Progreso</span><strong>{{ flowSnapshot().completion }}%</strong></div>
            <div class="builder-side__note">{{ flowSnapshot().nextQuestion }}</div>
            @if (flowSnapshot().missingFields.length) {
              <div class="builder-flow__missing">
                <span>Faltantes</span>
                <p>{{ missingFieldsLabel() }}</p>
              </div>
            }
          </div>

          <span class="pill">Radar del proyecto</span>
          <h3>{{ title() || 'Titulo en construccion' }}</h3>
          <p>{{ description() || 'Describe el alcance y Prometeo te ayudara a convertirlo en job listo para propuestas.' }}</p>

          <dl>
            <div><dt>Categoria</dt><dd>{{ selectedCategory()?.name || 'Pendiente' }}</dd></div>
            <div><dt>Especialidad</dt><dd>{{ selectedSubcategory()?.name || 'Pendiente' }}</dd></div>
            <div><dt>Ciudad</dt><dd>{{ city() || 'Pendiente' }}</dd></div>
            <div><dt>Presupuesto</dt><dd>{{ budgetLabel() }}</dd></div>
            <div><dt>Urgencia</dt><dd>{{ urgency() }}</dd></div>
          </dl>

          <div class="builder-side__note">
            Si quieres volver a conversar, usa el panel flotante de Prometeo: el mismo borrador se puede confirmar y publicar desde ahí.
          </div>
        </aside>
      </div>
    </div>
  `,
  styles: `
    .builder-banner,
    .builder-main,
    .builder-side {
      padding: 20px;
    }

    .builder-banner {
      color: var(--brand-strong);
      background: rgba(59, 130, 246, 0.08);
    }

    .builder-grid {
      display: grid;
      gap: 18px;
      grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr);
      align-items: start;
    }

    .builder-main,
    .builder-side,
    .builder-budget,
    .builder-review {
      display: grid;
      gap: 18px;
    }

    .builder-main__header,
    .builder-main__footer,
    .builder-main__steps,
    .builder-budget__actions,
    .builder-review__row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    .builder-main__header h2,
    .builder-side h3 {
      margin: 12px 0 0;
      font-size: 1.5rem;
      letter-spacing: -0.05em;
    }

    .builder-step {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 1px solid var(--border);
      background: var(--surface-strong);
      font-weight: 800;
    }

    .builder-step.is-open {
      border-color: rgba(59, 130, 246, 0.16);
    }

    .builder-step.is-active {
      background: linear-gradient(135deg, var(--brand), var(--accent));
      color: white;
      border-color: transparent;
    }

    .builder-options,
    .builder-subcategories,
    .builder-form {
      display: grid;
      gap: 12px;
    }

    .builder-options {
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }

    .builder-options.is-compact {
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    }

    .builder-option,
    .builder-subcategory {
      padding: 16px;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: var(--surface-strong);
      text-align: left;
      display: grid;
      gap: 8px;
    }

    .builder-option.is-selected,
    .builder-subcategory.is-selected {
      border-color: rgba(59, 130, 246, 0.22);
      background: rgba(59, 130, 246, 0.08);
    }

    .builder-option span,
    .builder-subcategory span,
    .builder-side p,
    .builder-budget__suggestion p,
    .builder-review__copy,
    .builder-hint {
      color: var(--muted);
      line-height: 1.6;
      margin: 0;
      font-size: 13px;
    }

    .builder-hint.is-error {
      color: var(--danger);
    }

    .builder-form {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .builder-form label {
      display: grid;
      gap: 8px;
      font-size: 13px;
      font-weight: 700;
    }

    .builder-form__wide {
      grid-column: 1 / -1;
    }

    .builder-budget__suggestion {
      padding: 16px;
      border-radius: 18px;
      background: rgba(255, 106, 0, 0.1);
      border: 1px solid rgba(255, 106, 0, 0.18);
      display: grid;
      gap: 8px;
    }

    .builder-budget__suggestion strong {
      font-size: 1.2rem;
    }

    .builder-review {
      padding: 18px;
      border-radius: 20px;
      background: var(--raised);
      border: 1px solid var(--border);
    }

    .builder-review__row {
      padding-bottom: 10px;
      border-bottom: 1px solid var(--line);
    }

    .builder-review__copy {
      margin-top: 4px;
    }

    .builder-side {
      position: sticky;
      top: 96px;
    }

    .builder-side dl {
      margin: 0;
      display: grid;
      gap: 12px;
    }

    .builder-side dl div {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--line);
    }

    .builder-side dt,
    .builder-side__note,
    .builder-review__row span {
      color: var(--muted);
    }

    .builder-side dd,
    .builder-review__row strong {
      margin: 0;
      text-align: right;
      font-weight: 700;
    }

    .builder-side__note {
      padding: 14px;
      border-radius: 16px;
      background: rgba(59, 130, 246, 0.08);
      line-height: 1.6;
      font-size: 13px;
    }

    .builder-flow {
      display: grid;
      gap: 12px;
      padding: 16px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: var(--surface-strong);
    }

    .builder-flow__missing {
      display: grid;
      gap: 6px;
    }

    .builder-flow__missing span {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .builder-flow__missing p {
      margin: 0;
      color: var(--ink);
      font-size: 13px;
      line-height: 1.55;
    }

    .builder-error {
      padding: 14px;
      border-radius: 16px;
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.18);
      color: var(--danger);
      font-size: 13px;
    }

    @media (max-width: 980px) {
      .builder-grid {
        grid-template-columns: 1fr;
      }

      .builder-side {
        position: static;
      }
    }

    @media (max-width: 720px) {
      .builder-form {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ClientJobBuilderPageComponent implements OnInit {
  readonly categoryQuery = input<string | undefined>(undefined, { alias: 'category' });
  readonly subcategoryQuery = input<string | undefined>(undefined, { alias: 'subcategory' });
  readonly titleQuery = input<string | undefined>(undefined, { alias: 'title' });
  readonly descriptionQuery = input<string | undefined>(undefined, { alias: 'description' });
  readonly locationTypeQuery = input<string | undefined>(undefined, { alias: 'locationType' });
  readonly cityQuery = input<string | undefined>(undefined, { alias: 'city' });
  readonly budgetTypeQuery = input<string | undefined>(undefined, { alias: 'budgetType' });
  readonly budgetMinQuery = input<string | undefined>(undefined, { alias: 'budgetMin' });
  readonly budgetMaxQuery = input<string | undefined>(undefined, { alias: 'budgetMax' });
  readonly urgencyQuery = input<string | undefined>(undefined, { alias: 'urgency' });

  protected readonly categories = JOB_CATEGORIES;
  protected readonly urgencyOptions = JOB_URGENCY_OPTIONS;
  protected readonly budgetTypes = [
    { value: 'range' as JobBudgetType, label: 'Rango', copy: 'Cliente quiere horquilla' },
    { value: 'fixed' as JobBudgetType, label: 'Fijo', copy: 'Monto cerrado' },
    { value: 'hourly' as JobBudgetType, label: 'Hourly', copy: 'Cobro por hora' },
  ];

  protected readonly prefilled = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly budgetSuggestion = signal<BudgetSuggestion | null>(null);
  protected readonly budgetLoading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly files = signal<File[]>([]);

  private readonly published = signal(false);
  private readonly initialSnapshot = signal('');
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly builderStore = inject(JobBuilderStore);
  private readonly jobsStore = inject(JobsStore);
  private readonly intelligenceApi = inject(IntelligenceApi);
  protected readonly step = this.builderStore.step;
  protected readonly stepTitle = this.builderStore.stepTitle;
  protected readonly maxAvailableStep = this.builderStore.maxAvailableStep;
  protected readonly canProceed = this.builderStore.canProceed;

  protected readonly form = this.formBuilder.nonNullable.group({
    categoryId: ['', Validators.required],
    subcategoryId: ['', Validators.required],
    title: ['', [Validators.required, Validators.minLength(5)]],
    description: ['', [Validators.required, Validators.minLength(20)]],
    locationType: this.formBuilder.nonNullable.control<JobLocationType>('on_site'),
    city: [''],
    budgetType: this.formBuilder.nonNullable.control<JobBudgetType>('range'),
    budgetMin: [500, [Validators.required, Validators.min(1)]],
    budgetMax: [2000, [Validators.required, Validators.min(1)]],
    urgency: ['medium'],
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  protected readonly categoryId = computed(() => this.formValue().categoryId ?? '');
  protected readonly subcategoryId = computed(() => this.formValue().subcategoryId ?? '');
  protected readonly title = computed(() => this.formValue().title ?? '');
  protected readonly description = computed(() => this.formValue().description ?? '');
  protected readonly locationType = computed(() => (this.formValue().locationType as JobLocationType | undefined) ?? 'on_site');
  protected readonly city = computed(() => this.formValue().city ?? '');
  protected readonly budgetType = computed(() => (this.formValue().budgetType as JobBudgetType | undefined) ?? 'range');
  protected readonly budgetMin = computed(() => this.formValue().budgetMin ?? 0);
  protected readonly budgetMax = computed(() => this.formValue().budgetMax ?? 0);
  protected readonly urgency = computed(() => this.formValue().urgency ?? 'medium');
  protected readonly selectedCategory = computed(() => this.categories.find((item) => item.id === this.categoryId()) ?? null);
  protected readonly selectedSubcategory = computed(() =>
    this.selectedCategory()?.subcategories.find((item) => item.id === this.subcategoryId()) ?? null,
  );
  protected readonly hasUnsavedChanges = computed(() => this.serializeState() !== this.initialSnapshot());
  protected readonly flowSnapshot = computed(() =>
    deriveJobBuilderFlow({
      categoryId: this.categoryId(),
      subcategoryId: this.subcategoryId(),
      title: this.title(),
      description: this.description(),
      city: this.city(),
      budgetType: this.budgetType(),
      budgetMin: this.budgetMin(),
      budgetMax: this.budgetMax(),
      budgetConfirmed: this.builderStore.draft().budgetConfirmed,
      attachmentsExpected: this.builderStore.draft().attachmentsExpected,
      fileCount: this.files().length,
      published: this.published(),
    }),
  );
  protected readonly builderBannerCopy = computed(() => {
    const source = this.builderStore.source();
    if (source === 'assistant') {
      return 'Prometeo dejó este expediente prearmado desde la conversación. Revisa, ajusta y publica.';
    }
    if (source === 'local') {
      return 'Recuperamos tu borrador local para que continúes exactamente donde lo dejaste.';
    }
    return 'Este formulario ya trae datos del borrador conversacional de Prometeo. Revisa, ajusta y publica.';
  });

  ngOnInit() {
    const params = new URLSearchParams();
    const values = {
      category: this.categoryQuery(),
      subcategory: this.subcategoryQuery(),
      title: this.titleQuery(),
      description: this.descriptionQuery(),
      locationType: this.locationTypeQuery(),
      city: this.cityQuery(),
      budgetType: this.budgetTypeQuery(),
      budgetMin: this.budgetMinQuery(),
      budgetMax: this.budgetMaxQuery(),
      urgency: this.urgencyQuery(),
    };

    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'string' && value.trim()) {
        params.set(key, value);
      }
    }

    const routePrefill = parseJobIntakePrefill(params);
    const hasExplicitBudget = Boolean(values.budgetType || values.budgetMin || values.budgetMax);
    const hasRoutePrefill = Boolean(
      routePrefill.categoryId || routePrefill.subcategoryId || routePrefill.title || routePrefill.description || routePrefill.city,
    );

    const prefill = hasRoutePrefill
      ? this.builderStore.stageFromRoute(routePrefill, hasExplicitBudget)
      : this.builderStore.draft();

    this.prefilled.set(hasRoutePrefill || this.builderStore.hasMeaningfulDraft());
    this.form.patchValue({
      categoryId: prefill.categoryId,
      subcategoryId: prefill.subcategoryId,
      title: prefill.title,
      description: prefill.description,
      locationType: prefill.locationType,
      city: prefill.city,
      budgetType: prefill.budgetType,
      budgetMin: prefill.budgetMin,
      budgetMax: prefill.budgetMax,
      urgency: prefill.urgency,
    });

    this.initialSnapshot.set(this.serializeState());
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.builderStore.updateFromForm(this.toDraftValue()));
    this.form.controls.budgetMin.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.form.controls.budgetMin.dirty) {
          this.builderStore.updateFromForm(this.toDraftValue(), { budgetConfirmed: true });
        }
      });
    this.form.controls.budgetMax.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.form.controls.budgetMax.dirty) {
          this.builderStore.updateFromForm(this.toDraftValue(), { budgetConfirmed: true });
        }
      });
  }

  selectCategory(categoryId: string) {
    this.form.patchValue({ categoryId, subcategoryId: '' });
  }

  selectSubcategory(subcategoryId: string) {
    this.form.controls.subcategoryId.setValue(subcategoryId);
  }

  setBudgetType(type: JobBudgetType) {
    this.form.controls.budgetType.setValue(type);
    if (type !== 'range') {
      this.form.controls.budgetMax.setValue(this.budgetMin());
    }
    this.builderStore.updateFromForm(this.toDraftValue(), { budgetConfirmed: true });
  }

  jumpTo(stepNumber: number) {
    this.builderStore.jumpTo(stepNumber as JobBuilderStep);
  }

  previousStep() {
    this.builderStore.previousStep();
  }

  nextStep() {
    this.builderStore.nextStep();
  }

  showTitleError() {
    const control = this.form.controls.title;
    return control.touched && control.invalid;
  }

  showDescriptionError() {
    const control = this.form.controls.description;
    return control.touched && control.invalid;
  }

  showBudgetError() {
    return this.step() >= 3 && !this.hasValidBudget();
  }

  onFilesSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    this.files.set(Array.from(target.files ?? []));
  }

  suggestBudget() {
    if (!this.form.controls.title.valid || !this.form.controls.description.valid) {
      this.form.controls.title.markAsTouched();
      this.form.controls.description.markAsTouched();
      this.error.set('Necesitamos un titulo y una descripcion mas claros antes de sugerir presupuesto.');
      return;
    }

    this.budgetLoading.set(true);
    this.error.set(null);
    this.intelligenceApi
      .suggestBudget({
        title: this.title().trim(),
        scope: this.description().trim(),
        category: this.selectedSubcategory()?.name ?? this.selectedCategory()?.name ?? undefined,
        location: this.city().trim() || undefined,
      })
      .pipe(finalize(() => this.budgetLoading.set(false)))
      .subscribe({
        next: (suggestion) => {
          this.budgetSuggestion.set(suggestion);
          this.form.patchValue({
            budgetType: 'range',
            budgetMin: suggestion.min,
            budgetMax: suggestion.max,
          });
          this.builderStore.updateFromForm(this.toDraftValue(), { budgetConfirmed: true });
        },
        error: () => {
          this.error.set('No pudimos obtener el rango sugerido desde inteligencia.');
        },
      });
  }

  publish() {
    if (!this.canProceed()) {
      return;
    }

    const raw = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.jobsStore
      .create({
        title: raw.title.trim(),
        scope: raw.description.trim(),
        category: this.selectedSubcategory()?.name ?? this.selectedCategory()?.name ?? '',
        budgetType: raw.budgetType,
        budgetMin: raw.budgetMin,
        budgetMax: raw.budgetType === 'range' ? raw.budgetMax : raw.budgetMin,
        city: raw.city.trim() || undefined,
        locationType: raw.locationType,
        urgency: raw.urgency,
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (job) => {
          this.published.set(true);
          this.builderStore.clear();
          void this.router.navigate(['/client/jobs', job.id]);
        },
        error: () => {
          this.error.set('No pudimos publicar el trabajo.');
        },
      });
  }

  confidenceLabel(value: 'high' | 'medium' | 'low') {
    if (value === 'high') {
      return 'Alta confianza';
    }
    if (value === 'medium') {
      return 'Media confianza';
    }
    return 'Baja confianza';
  }

  budgetLabel() {
    if (this.budgetType() === 'range') {
      return `$${this.budgetMin().toLocaleString()} - $${this.budgetMax().toLocaleString()}`;
    }
    return `$${this.budgetMin().toLocaleString()}`;
  }

  canDeactivate() {
    if (this.published() || !this.hasUnsavedChanges()) {
      return true;
    }

    return window.confirm('Tienes cambios sin publicar en este proyecto. ¿Quieres salir de todos modos?');
  }

  private hasValidBudget() {
    return this.budgetMin() > 0 && (this.budgetType() !== 'range' || this.budgetMax() >= this.budgetMin());
  }

  missingFieldsLabel() {
    const labels: Record<string, string> = {
      category: 'Categoría',
      subcategory: 'Especialidad',
      title: 'Título',
      description: 'Descripción',
      city: 'Ciudad',
      budget: 'Presupuesto',
      files: 'Archivos',
    };

    return this.flowSnapshot().missingFields.map((field) => labels[field] ?? field).join(', ');
  }

  private serializeState() {
    return JSON.stringify({
      ...this.toDraftValue(),
      files: this.files().map((file) => `${file.name}:${file.size}:${file.lastModified}`),
    });
  }

  private toDraftValue(): JobIntakePrefill {
    const raw = this.form.getRawValue();
    return {
      categoryId: raw.categoryId,
      subcategoryId: raw.subcategoryId,
      title: raw.title.trim(),
      description: raw.description.trim(),
      locationType: raw.locationType,
      city: raw.city.trim(),
      budgetType: raw.budgetType,
      budgetMin: raw.budgetMin,
      budgetMax: raw.budgetType === 'range' ? raw.budgetMax : raw.budgetMin,
      urgency: raw.urgency ?? 'medium',
    };
  }
}
