import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { jobBudgetLabel, jobStatusBg, jobStatusColor, jobStatusLabel } from './data/job-presenters';
import { JobsStore } from './data/jobs.store';

@Component({
  standalone: true,
  selector: 'app-client-job-detail-page',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-shell">
      @if (loading()) {
        <div class="empty-state section-card">Cargando trabajo...</div>
      } @else if (error()) {
        <div class="empty-state section-card">{{ error() }}</div>
      } @else if (job()) {
        <section class="page-hero">
          <div>
            <span class="page-eyebrow">Job Detail</span>
            <h1 class="page-title">{{ job()!.title }}</h1>
            <p class="page-copy">{{ job()!.scope }}</p>
          </div>
          <div class="job-detail__cta">
            <span class="status-pill" [style.background]="statusBg(job()!.status)" [style.color]="statusColor(job()!.status)">
              {{ statusLabel(job()!.status) }}
            </span>
            <a routerLink="/client/jobs/new" class="btn-secondary">Duplicar idea</a>
          </div>
        </section>

        <section class="job-detail__grid">
          <article class="section-card job-detail__card">
            <span class="pill">Operacion</span>
            <dl>
              <div><dt>Ciudad</dt><dd>{{ job()!.city || 'No especificada' }}</dd></div>
              <div><dt>Modalidad</dt><dd>{{ job()!.locationType || 'on_site' }}</dd></div>
              <div><dt>Urgencia</dt><dd>{{ job()!.urgency || 'medium' }}</dd></div>
              <div><dt>Presupuesto</dt><dd>{{ budgetLabel(job()!) }}</dd></div>
            </dl>
          </article>

          <article class="section-card job-detail__card">
            <span class="pill">Contexto</span>
            <h2>Alcance</h2>
            <p>{{ job()!.scope }}</p>
          </article>
        </section>
      }
    </div>
  `,
  styles: `
    .job-detail__cta {
      display: grid;
      gap: 12px;
      justify-items: end;
    }

    .job-detail__grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .job-detail__card {
      padding: 24px;
      display: grid;
      gap: 14px;
    }

    .job-detail__card h2 {
      margin: 0;
      font-size: 1.3rem;
      letter-spacing: -0.04em;
    }

    .job-detail__card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.7;
    }

    dl {
      margin: 0;
      display: grid;
      gap: 14px;
    }

    dl div {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--line);
    }

    dt {
      color: var(--muted);
    }

    dd {
      margin: 0;
      text-align: right;
      font-weight: 700;
    }

    @media (max-width: 840px) {
      .job-detail__grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ClientJobDetailPageComponent implements OnInit {
  readonly jobId = input.required<string>();
  private readonly jobsStore = inject(JobsStore);
  protected readonly job = computed(() => this.jobsStore.jobById(this.jobId()));
  protected readonly loading = computed(() => this.jobsStore.detailLoading(this.jobId()));
  protected readonly error = computed(() => this.jobsStore.detailError(this.jobId()));

  ngOnInit() {
    const jobId = this.jobId();
    if (!jobId) {
      return;
    }

    this.jobsStore.ensureDetail(jobId);
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
