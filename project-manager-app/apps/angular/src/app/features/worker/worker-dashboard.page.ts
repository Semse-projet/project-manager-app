import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { JobRecord, JobsApi } from '../../core/api/jobs.api';
import { jobBudgetLabel, jobStatusBg, jobStatusColor, jobStatusLabel } from '../client/data/job-presenters';

@Component({
  standalone: true,
  selector: 'app-worker-dashboard-page',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-shell">
      <section class="page-hero">
        <div>
          <span class="page-eyebrow">Professional Ops</span>
          <h1 class="page-title">Tus trabajos activos y pendientes de aceptar.</h1>
          <p class="page-copy">
            Vista operativa del profesional. Trabajos que requieren acción inmediata o están en ejecución activa.
          </p>
        </div>
      </section>

      <section class="metric-grid">
        <article class="metric-card">
          <span class="pill">En ejecución</span>
          <div class="metric-value">{{ inProgressJobs().length }}</div>
          <p>Trabajos con ejecución activa.</p>
        </article>
        <article class="metric-card">
          <span class="pill">Pendientes de inicio</span>
          <div class="metric-value">{{ acceptedJobs().length }}</div>
          <p>Aceptados, aún sin iniciar.</p>
        </article>
        <article class="metric-card">
          <span class="pill">Carga total</span>
          <div class="metric-value">{{ allActiveJobs().length }}</div>
          <p>Trabajos activos en el pipeline.</p>
        </article>
        <article class="metric-card">
          <span class="pill">Facturación estimada</span>
          <div class="metric-value">{{ totalBudgetLabel() }}</div>
          <p>Suma del rango mínimo de trabajos en ejecución.</p>
        </article>
      </section>

      <section class="section-card dashboard-list">
        <header class="dashboard-list__header">
          <div>
            <span class="pill">Pipeline activo</span>
            <h2>Trabajos asignados</h2>
          </div>
        </header>

        @if (loading()) {
          <div class="empty-state">Cargando trabajos...</div>
        } @else if (error()) {
          <div class="empty-state">{{ error() }}</div>
        } @else if (!allActiveJobs().length) {
          <div class="empty-state">No hay trabajos activos en este momento.</div>
        } @else {
          <div class="jobs-list">
            @for (job of allActiveJobs(); track job.id) {
              <a class="jobs-card section-card" [routerLink]="['/client/jobs', job.id]">
                <div class="jobs-card__top">
                  <div>
                    <strong>{{ job.title }}</strong>
                    <p>{{ job.scope }}</p>
                  </div>
                  <span class="status-pill"
                    [style.background]="statusBg(job.status)"
                    [style.color]="statusColor(job.status)">
                    {{ statusLabel(job.status) }}
                  </span>
                </div>
                <div class="jobs-card__meta">
                  <span>{{ job.city || 'Ubicación pendiente' }}</span>
                  <span>{{ job.locationType || 'on_site' }}</span>
                  <span>{{ budgetLabel(job) }}</span>
                </div>
              </a>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    .jobs-list {
      display: grid;
      gap: 12px;
    }

    .jobs-card {
      display: grid;
      gap: 12px;
      padding: 20px;
      border-radius: 20px;
      cursor: pointer;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s;
    }

    .jobs-card:hover {
      border-color: var(--accent);
    }

    .jobs-card__top {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
    }

    .jobs-card strong {
      display: block;
      font-size: 16px;
      margin-bottom: 6px;
    }

    .jobs-card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
      font-size: 14px;
    }

    .jobs-card__meta {
      display: flex;
      gap: 16px;
      font-size: 13px;
      padding-top: 8px;
      border-top: 1px solid var(--line);
      color: var(--muted);
    }
  `,
})
export class WorkerDashboardPageComponent implements OnInit {
  private readonly jobsApi = inject(JobsApi);

  private readonly _inProgress = signal<JobRecord[]>([]);
  private readonly _accepted = signal<JobRecord[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  protected readonly loading = computed(() => this._loading());
  protected readonly error = computed(() => this._error());
  protected readonly inProgressJobs = computed(() => this._inProgress());
  protected readonly acceptedJobs = computed(() => this._accepted());
  protected readonly allActiveJobs = computed(() => [...this._inProgress(), ...this._accepted()]);
  protected readonly totalBudgetLabel = computed(() => {
    const total = this._inProgress().reduce((sum, job) => sum + (job.budgetMin ?? 0), 0);
    return total > 0 ? `$${total.toLocaleString()}` : '—';
  });

  ngOnInit() {
    this._loading.set(true);
    this._error.set(null);

    this.jobsApi.list({ status: 'in_progress' })
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe({
        next: (jobs) => this._inProgress.set(jobs),
        error: () => this._error.set('No pudimos cargar los trabajos activos.'),
      });

    this.jobsApi.list({ status: 'accepted' })
      .subscribe({
        next: (jobs) => this._accepted.set(jobs),
        error: () => {},
      });
  }

  budgetLabel(job: Parameters<typeof jobBudgetLabel>[0]) {
    return jobBudgetLabel(job);
  }

  statusLabel(status: string) {
    return jobStatusLabel(status);
  }

  statusBg(status: string) {
    return jobStatusBg(status);
  }

  statusColor(status: string) {
    return jobStatusColor(status);
  }
}
