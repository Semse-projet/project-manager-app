import { computed, inject, Injectable, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import { ContractorLead, LeadStats, LeadsApi } from '../../../core/api/leads.api';

type LeadSnapshot = {
  leads: ContractorLead[];
  stats: LeadStats;
};

@Injectable({ providedIn: 'root' })
export class LeadsStore {
  readonly search = signal('');
  readonly statusFilter = signal('');

  private readonly leadsApi = inject(LeadsApi);
  private readonly _leads = signal<ContractorLead[]>([]);
  private readonly _stats = signal<LeadStats | null>(null);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _updatingMap = signal<Record<string, boolean>>({});

  readonly leads = computed(() => this._leads());
  readonly stats = computed(() => this._stats());
  readonly loading = computed(() => this._loading());
  readonly saving = computed(() => this._saving());
  readonly error = computed(() => this._error());

  load() {
    if (this._loading()) {
      return;
    }

    this._loading.set(true);
    this._error.set(null);

    this.fetchSnapshot()
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe({
        next: (snapshot) => this.applySnapshot(snapshot),
        error: () => {
          this._error.set('No pudimos leer el CRM de leads desde el API.');
        },
      });
  }

  createLead(body: Partial<ContractorLead> & { name: string }, onSuccess?: () => void) {
    if (!body.name.trim() || this._saving()) {
      return;
    }

    this._saving.set(true);
    this._error.set(null);

    this.leadsApi.create(body)
      .pipe(
        switchMap(() => this.fetchSnapshot()),
        finalize(() => this._saving.set(false)),
      )
      .subscribe({
        next: (snapshot) => {
          this.applySnapshot(snapshot);
          onSuccess?.();
        },
        error: () => {
          this._error.set('No pudimos crear el lead.');
        },
      });
  }

  updateLeadStatus(leadId: string, status: string) {
    if (!leadId.trim() || this.isUpdatingLead(leadId)) {
      return;
    }

    this.setLeadUpdating(leadId, true);
    this._error.set(null);

    this.leadsApi.update(leadId, { status })
      .pipe(
        switchMap(() => this.fetchSnapshot()),
        finalize(() => this.setLeadUpdating(leadId, false)),
      )
      .subscribe({
        next: (snapshot) => this.applySnapshot(snapshot),
        error: () => {
          this._error.set('No pudimos actualizar el estado del lead.');
        },
      });
  }

  isUpdatingLead(leadId: string): boolean {
    return Boolean(this._updatingMap()[leadId]);
  }

  clearError() {
    this._error.set(null);
  }

  private fetchSnapshot() {
    return forkJoin({
      leads: this.leadsApi.list({
        search: this.search().trim() || undefined,
        status: this.statusFilter().trim() || undefined,
      }),
      stats: this.leadsApi.stats(),
    });
  }

  private applySnapshot(snapshot: LeadSnapshot) {
    this._leads.set(snapshot.leads);
    this._stats.set(snapshot.stats);
  }

  private setLeadUpdating(leadId: string, value: boolean) {
    this._updatingMap.update((state) => {
      const next = { ...state };
      if (value) {
        next[leadId] = true;
      } else {
        delete next[leadId];
      }
      return next;
    });
  }
}
