import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { JOB_STATUS_OPTIONS, jobBudgetLabel, jobStatusBg, jobStatusColor, jobStatusLabel } from './data/job-presenters';
import { JobsStore } from './data/jobs.store';

@Component({
  standalone: true,
  selector: 'app-client-jobs-page',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-shell">
      <section class="page-hero">
        <div>
          <span class="page-eyebrow">Jobs Registry</span>
          <h1 class="page-title">Trabajos publicados y pipeline operativo.</h1>
          <p class="page-copy">
            Aquí aterriza lo que sale del builder conversacional y también cualquier trabajo creado por flujo manual.
          </p>
        </div>
        <a routerLink="/client/jobs/new" class="btn-primary">Nuevo trabajo</a>
      </section>

      <section class="section-card jobs-filters">
        <div class="jobs-filters__group">
          <span class="pill">Estado</span>
          <select class="select" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)">
            <option value="">Todos</option>
            @for (option of statusOptions; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </div>
      </section>

      <section class="jobs-list">
        @if (loading()) {
          <div class="empty-state section-card">Cargando trabajos...</div>
        } @else if (error()) {
          <div class="empty-state section-card">{{ error() }}</div>
        } @else if (!visibleJobs().length) {
          <div class="empty-state section-card">No hay trabajos para el filtro actual.</div>
        } @else {
          @for (job of visibleJobs(); track job.id) {
            <a class="jobs-card section-card" [routerLink]="['/client/jobs', job.id]">
              <div class="jobs-card__top">
                <div>
                  <strong>{{ job.title }}</strong>
                  <p>{{ job.scope }}</p>
                </div>
                <span class="status-pill" [style.background]="statusBg(job.status)" [style.color]="statusColor(job.status)">
                  {{ statusLabel(job.status) }}
                </span>
              </div>
              <div class="jobs-card__meta">
                <span>{{ job.city || 'Ubicacion pendiente' }}</span>
                <span>{{ job.locationType || 'on_site' }}</span>
                <span>{{ budgetLabel(job) }}</span>
              </div>
            </a>
          }
        }
      </section>
    </div>
  `,
  styles: `
    .jobs-filters,
    .jobs-card {
      padding: 20px;
    }

    .jobs-filters {
      display: flex;
      gap: 16px;
      align-items: end;
    }

    .jobs-filters__group {
      display: grid;
      gap: 10px;
      width: min(260px, 100%);
    }

    .jobs-list {
      display: grid;
      gap: 14px;
    }

    .jobs-card {
      text-decoration: none;
      display: grid;
      gap: 14px;
    }

    .jobs-card__top,
    .jobs-card__meta {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .jobs-card strong {
      display: block;
      font-size: 16px;
      margin-bottom: 8px;
    }

    .jobs-card p,
    .jobs-card__meta span {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
    }

    .jobs-card__meta {
      font-size: 13px;
      padding-top: 8px;
      border-top: 1px solid var(--line);
    }
  `,
})
export class ClientJobsPageComponent implements OnInit {
  private readonly jobsStore = inject(JobsStore);
  protected readonly jobs = this.jobsStore.jobs;
  protected readonly loading = this.jobsStore.loading;
  protected readonly error = this.jobsStore.error;
  protected readonly statusFilter = signal('');
  protected readonly visibleJobs = computed(() => {
    const status = this.statusFilter();
    return status ? this.jobs().filter((job) => job.status === status) : this.jobs();
  });

  protected readonly statusOptions = JOB_STATUS_OPTIONS;

  ngOnInit() {
    this.jobsStore.ensureLoaded();
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
