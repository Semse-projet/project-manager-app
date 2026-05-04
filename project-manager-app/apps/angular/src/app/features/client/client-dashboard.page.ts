import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { jobBudgetLabel, jobStatusBg, jobStatusColor, jobStatusLabel } from './data/job-presenters';
import { JobsStore } from './data/jobs.store';

@Component({
  standalone: true,
  selector: 'app-client-dashboard-page',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-shell">
      <section class="page-hero">
        <div>
          <span class="page-eyebrow">Client Command Deck</span>
          <h1 class="page-title">Tus trabajos, leads y publicaciones ya viven en Angular.</h1>
          <p class="page-copy">
            Esta capa ya conversa con el backend real de SEMSE. Desde aqui puedes ver pipeline, entrar
            al constructor conversacional y seguir el estado operativo de cada trabajo.
          </p>
        </div>
        <a routerLink="/client/jobs/new" class="btn-primary">Publicar trabajo</a>
      </section>

      <section class="metric-grid">
        <article class="metric-card">
          <span class="pill">Trabajos activos</span>
          <div class="metric-value">{{ activeJobs().length }}</div>
          <p>{{ statusSentence('in_progress') }}</p>
        </article>
        <article class="metric-card">
          <span class="pill">Esperando propuestas</span>
          <div class="metric-value">{{ postedJobs().length }}</div>
          <p>{{ statusSentence('posted') }}</p>
        </article>
        <article class="metric-card">
          <span class="pill">Cierre operativo</span>
          <div class="metric-value">{{ completedJobs().length }}</div>
          <p>Trabajos completados con historial ya visible en el tablero.</p>
        </article>
        <article class="metric-card">
          <span class="pill">Volumen presupuestado</span>
          <div class="metric-value">{{ totalBudgetLabel() }}</div>
          <p>Suma aproximada del rango mínimo cargado en trabajos activos.</p>
        </article>
      </section>

      <section class="section-card dashboard-list">
        <header class="dashboard-list__header">
          <div>
            <span class="pill">Pipeline reciente</span>
            <h2>Trabajos recientes</h2>
          </div>
          <a routerLink="/client/jobs" class="btn-secondary">Ver todos</a>
        </header>

        @if (loading()) {
          <div class="empty-state">Cargando trabajos...</div>
        } @else if (error()) {
          <div class="empty-state">{{ error() }}</div>
        } @else if (!jobs().length) {
          <div class="empty-state">Todavia no tienes trabajos publicados.</div>
        } @else {
          <div class="dashboard-list__items">
            @for (job of jobs().slice(0, 6); track job.id) {
              <a class="dashboard-job" [routerLink]="['/client/jobs', job.id]">
                <div>
                  <strong>{{ job.title }}</strong>
                  <p>{{ job.scope }}</p>
                </div>
                <div class="dashboard-job__meta">
                  <span class="status-pill" [style.background]="statusBg(job.status)" [style.color]="statusColor(job.status)">
                    {{ statusLabel(job.status) }}
                  </span>
                  <small>{{ budgetLabel(job) }}</small>
                </div>
              </a>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    .dashboard-list {
      padding: 24px;
    }

    .dashboard-list__header,
    .dashboard-job,
    .dashboard-job__meta {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
    }

    .dashboard-list__header {
      margin-bottom: 18px;
      flex-wrap: wrap;
    }

    .dashboard-list__header h2 {
      margin: 12px 0 0;
      font-size: 1.4rem;
      letter-spacing: -0.05em;
    }

    .dashboard-list__items {
      display: grid;
      gap: 12px;
    }

    .dashboard-job {
      padding: 18px;
      border-radius: 22px;
      border: 1px solid var(--border);
      background: var(--raised);
      text-decoration: none;
      transition: transform 0.16s ease, border-color 0.16s ease;
    }

    .dashboard-job:hover {
      transform: translateY(-1px);
      border-color: rgba(59, 130, 246, 0.18);
    }

    .dashboard-job strong {
      display: block;
      font-size: 15px;
      margin-bottom: 6px;
    }

    .dashboard-job p,
    .dashboard-job small {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
    }

    .dashboard-job__meta {
      flex-direction: column;
      align-items: flex-end;
      min-width: 180px;
    }

    @media (max-width: 720px) {
      .dashboard-list {
        padding: 18px;
      }

      .dashboard-job {
        flex-direction: column;
        align-items: flex-start;
      }

      .dashboard-job__meta {
        align-items: flex-start;
        min-width: 0;
      }
    }
  `,
})
export class ClientDashboardPageComponent implements OnInit {
  private readonly jobsStore = inject(JobsStore);
  protected readonly jobs = this.jobsStore.jobs;
  protected readonly loading = this.jobsStore.loading;
  protected readonly error = this.jobsStore.error;
  protected readonly activeJobs = this.jobsStore.activeJobs;
  protected readonly postedJobs = this.jobsStore.postedJobs;
  protected readonly completedJobs = this.jobsStore.completedJobs;

  ngOnInit() {
    this.jobsStore.ensureLoaded();
  }

  totalBudgetLabel() {
    const total = this.activeJobs().reduce((acc, job) => acc + (job.budgetMin ?? 0), 0);
    return total > 0 ? `$${total.toLocaleString()}` : 'Sin data';
  }

  budgetLabel(job: Parameters<typeof jobBudgetLabel>[0]) {
    return jobBudgetLabel(job);
  }

  statusSentence(status: string) {
    const count = this.jobsStore.statusCount(status);
    return `${count} item${count === 1 ? '' : 's'} en ese estado exacto.`;
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
