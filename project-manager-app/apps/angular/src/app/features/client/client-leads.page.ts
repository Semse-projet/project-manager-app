import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { buildLeadCreatePayload, EMPTY_LEAD_FORM, type LeadFormDraft } from './data/lead-form';
import { LEAD_STATUS_OPTIONS, leadStatusBg, leadStatusColor, leadStatusLabel } from './data/lead-presenters';
import { LeadsStore } from './data/leads.store';

@Component({
  standalone: true,
  selector: 'app-client-leads-page',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-shell">
      <section class="page-hero">
        <div>
          <span class="page-eyebrow">Contractor CRM</span>
          <h1 class="page-title">Leads, clientes y oportunidades vivas.</h1>
          <p class="page-copy">
            Este modulo ya consume el CRM real de contractor. Aquí controlas pipeline comercial,
            contexto de cada contacto y el siguiente movimiento operativo.
          </p>
        </div>
        <button type="button" class="btn-primary" (click)="showForm.set(true)">Nuevo lead</button>
      </section>

      @if (stats()) {
        <section class="metric-grid">
          <article class="metric-card">
            <span class="pill">Total</span>
            <div class="metric-value">{{ stats()!.total }}</div>
            <p>Contactos cargados en el tenant actual.</p>
          </article>
          <article class="metric-card">
            <span class="pill">Nuevos</span>
            <div class="metric-value">{{ stats()!.new }}</div>
            <p>Leads que todavía no entran a contacto activo.</p>
          </article>
          <article class="metric-card">
            <span class="pill">Estimado enviado</span>
            <div class="metric-value">{{ stats()!.estimate_sent }}</div>
            <p>Ya pasaron al tramo de propuesta comercial.</p>
          </article>
          <article class="metric-card">
            <span class="pill">En progreso</span>
            <div class="metric-value">{{ stats()!.in_progress }}</div>
            <p>Trabajos ganados y actualmente en ejecución.</p>
          </article>
        </section>
      }

      <section class="section-card leads-toolbar">
        <input class="field" placeholder="Buscar por nombre, telefono o trabajo" [ngModel]="search()" (ngModelChange)="search.set($event)" />
        <select class="select" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)">
          <option value="">Todos los estados</option>
          @for (option of statusOptions; track option.value) {
            <option [value]="option.value">{{ option.label }}</option>
          }
        </select>
        <button type="button" class="btn-secondary" (click)="load()">Buscar</button>
      </section>

      <section class="leads-list">
        @if (loading()) {
          <div class="empty-state section-card">Cargando leads...</div>
        } @else if (error()) {
          <div class="empty-state section-card">{{ error() }}</div>
        } @else if (!leads().length) {
          <div class="empty-state section-card">No hay leads con el filtro actual.</div>
        } @else {
          @for (lead of leads(); track lead.id) {
            <article class="section-card lead-card">
              <div class="lead-card__header">
                <div>
                  <span class="status-pill" [style.background]="statusBg(lead.status)" [style.color]="statusColor(lead.status)">
                    {{ statusLabel(lead.status) }}
                  </span>
                  <h2>{{ lead.name }}</h2>
                  <p>{{ lead.jobType || 'Trabajo no clasificado' }} · {{ lead.city || 'Ciudad pendiente' }}</p>
                </div>
                <select
                  class="select lead-card__status-select"
                  [disabled]="isUpdatingLead(lead.id)"
                  [ngModel]="lead.status"
                  (ngModelChange)="changeStatus(lead.id, $event)"
                >
                  @for (option of statusOptions; track option.value) {
                    <option [value]="option.value">{{ option.label }}</option>
                  }
                </select>
              </div>

              <div class="lead-card__grid">
                <div>
                  <span class="pill">Contacto</span>
                  <ul>
                    <li>{{ lead.phone || 'Telefono pendiente' }}</li>
                    <li>{{ lead.email || 'Email pendiente' }}</li>
                    <li>{{ lead.address || 'Direccion pendiente' }}</li>
                  </ul>
                </div>
                <div>
                  <span class="pill">Comercial</span>
                  <ul>
                    <li>{{ lead.budgetRange || 'Sin rango' }}</li>
                    <li>{{ lead.urgency || 'Urgencia pendiente' }}</li>
                    <li>{{ lead.source || 'Fuente pendiente' }}</li>
                  </ul>
                </div>
                <div>
                  <span class="pill">Siguiente paso</span>
                  <p>{{ lead.nextAction || 'Sin accion definida' }}</p>
                  @if (lead.notes) {
                    <small>{{ lead.notes }}</small>
                  }
                </div>
              </div>
            </article>
          }
        }
      </section>

      @if (showForm()) {
        <div class="lead-modal">
          <div class="lead-modal__panel section-card">
            <header class="lead-modal__header">
              <div>
                <span class="page-eyebrow">Nuevo lead</span>
                <h2>Cargar contacto al pipeline</h2>
              </div>
              <button type="button" class="btn-ghost" (click)="closeForm()">Cerrar</button>
            </header>

            <div class="lead-modal__grid">
              <label class="lead-label">Nombre
                <input class="field" [ngModel]="form.name" (ngModelChange)="form.name = $event" />
              </label>
              <label class="lead-label">Telefono
                <input class="field" [ngModel]="form.phone" (ngModelChange)="form.phone = $event" />
              </label>
              <label class="lead-label">Email
                <input class="field" [ngModel]="form.email" (ngModelChange)="form.email = $event" />
              </label>
              <label class="lead-label">Ciudad
                <input class="field" [ngModel]="form.city" (ngModelChange)="form.city = $event" />
              </label>
              <label class="lead-label">Tipo de trabajo
                <input class="field" [ngModel]="form.jobType" (ngModelChange)="form.jobType = $event" />
              </label>
              <label class="lead-label">Presupuesto
                <input class="field" [ngModel]="form.budgetRange" (ngModelChange)="form.budgetRange = $event" />
              </label>
            </div>

            <label class="lead-label">Descripcion
              <textarea class="textarea" [ngModel]="form.description" (ngModelChange)="form.description = $event"></textarea>
            </label>

            <label class="lead-label">Siguiente accion
              <input class="field" [ngModel]="form.nextAction" (ngModelChange)="form.nextAction = $event" />
            </label>

            <div class="lead-modal__actions">
              <button type="button" class="btn-secondary" (click)="closeForm()">Cancelar</button>
              <button type="button" class="btn-primary" [disabled]="saving()" (click)="createLead()">
                {{ saving() ? 'Guardando...' : 'Guardar lead' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .leads-toolbar,
    .lead-card,
    .lead-modal__panel {
      padding: 20px;
    }

    .leads-toolbar {
      display: grid;
      gap: 12px;
      grid-template-columns: 1fr 220px auto;
      align-items: end;
    }

    .leads-list {
      display: grid;
      gap: 14px;
    }

    .lead-card {
      display: grid;
      gap: 16px;
    }

    .lead-card__header,
    .lead-modal__header,
    .lead-modal__actions {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .lead-card__header h2,
    .lead-modal__header h2 {
      margin: 12px 0 6px;
      font-size: 1.3rem;
      letter-spacing: -0.05em;
    }

    .lead-card__header p {
      margin: 0;
      color: var(--muted);
    }

    .lead-card__status-select {
      width: 220px;
    }

    .lead-card__grid,
    .lead-modal__grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .lead-card ul {
      margin: 12px 0 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.7;
    }

    .lead-card p,
    .lead-card small {
      margin: 12px 0 0;
      color: var(--muted);
      line-height: 1.65;
    }

    .lead-label {
      display: grid;
      gap: 8px;
      color: var(--ink);
      font-size: 13px;
      font-weight: 700;
    }

    .lead-modal {
      position: fixed;
      inset: 0;
      z-index: 35;
      background: rgba(23, 32, 51, 0.38);
      display: grid;
      place-items: center;
      padding: 18px;
    }

    .lead-modal__panel {
      width: min(840px, 100%);
      display: grid;
      gap: 18px;
    }

    @media (max-width: 880px) {
      .leads-toolbar,
      .lead-card__grid,
      .lead-modal__grid {
        grid-template-columns: 1fr;
      }

      .lead-card__status-select {
        width: 100%;
      }
    }
  `,
})
export class ClientLeadsPageComponent implements OnInit {
  private readonly leadsStore = inject(LeadsStore);
  protected readonly leads = this.leadsStore.leads;
  protected readonly stats = this.leadsStore.stats;
  protected readonly loading = this.leadsStore.loading;
  protected readonly saving = this.leadsStore.saving;
  protected readonly error = this.leadsStore.error;
  protected readonly search = this.leadsStore.search;
  protected readonly statusFilter = this.leadsStore.statusFilter;
  protected readonly showForm = signal(false);
  protected form: LeadFormDraft = { ...EMPTY_LEAD_FORM };

  protected readonly statusOptions = LEAD_STATUS_OPTIONS;

  ngOnInit() {
    this.leadsStore.load();
  }

  load() {
    this.leadsStore.load();
  }

  createLead() {
    if (!this.form.name.trim()) {
      return;
    }

    this.leadsStore.createLead(buildLeadCreatePayload(this.form), () => this.closeForm());
  }

  changeStatus(leadId: string, status: string) {
    this.leadsStore.updateLeadStatus(leadId, status);
  }

  closeForm() {
    this.showForm.set(false);
    this.form = { ...EMPTY_LEAD_FORM };
    this.leadsStore.clearError();
  }

  isUpdatingLead(leadId: string) {
    return this.leadsStore.isUpdatingLead(leadId);
  }

  statusLabel(status: string) {
    return leadStatusLabel(status);
  }

  statusBg(status: string) {
    return leadStatusBg(status);
  }

  statusColor(status: string) {
    return leadStatusColor(status);
  }
}
