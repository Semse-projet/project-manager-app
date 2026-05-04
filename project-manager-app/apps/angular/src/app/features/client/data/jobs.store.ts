import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CreateJobRequest, JobRecord, JobsApi } from '../../../core/api/jobs.api';

const ACTIVE_STATUSES = new Set(['accepted', 'reserved', 'in_progress', 'review']);
const POSTED_STATUSES = new Set(['posted', 'published', 'review']);

@Injectable({ providedIn: 'root' })
export class JobsStore {
  private readonly jobsApi = inject(JobsApi);

  private readonly _jobs = signal<JobRecord[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _detailMap = signal<Record<string, JobRecord>>({});
  private readonly _detailLoading = signal<Record<string, boolean>>({});
  private readonly _detailError = signal<Record<string, string | null>>({});

  readonly jobs = computed(() => this._jobs());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());
  readonly activeJobs = computed(() => this.jobs().filter((job) => ACTIVE_STATUSES.has(job.status)));
  readonly postedJobs = computed(() => this.jobs().filter((job) => POSTED_STATUSES.has(job.status)));
  readonly completedJobs = computed(() => this.jobs().filter((job) => job.status === 'completed'));

  ensureLoaded(force = false) {
    if (this._loading() || (!force && this._loaded())) {
      return;
    }

    this._loading.set(true);
    this._error.set(null);

    this.jobsApi.list().subscribe({
      next: (jobs) => {
        this._jobs.set(jobs);
        this._loaded.set(true);
        this._loading.set(false);
        this.hydrateDetailMap(jobs);
      },
      error: () => {
        this._error.set('No pudimos cargar el pipeline de trabajos.');
        this._loading.set(false);
      },
    });
  }

  refresh() {
    this.ensureLoaded(true);
  }

  create(body: CreateJobRequest): Observable<JobRecord> {
    return this.jobsApi.create(body).pipe(tap((job) => this.remember(job)));
  }

  remember(job: JobRecord) {
    this._jobs.update((jobs) => {
      const index = jobs.findIndex((item) => item.id === job.id);
      if (index === -1) {
        return [job, ...jobs];
      }
      const next = [...jobs];
      next[index] = job;
      return next;
    });

    this._loaded.set(true);
    this._detailMap.update((map) => ({ ...map, [job.id]: job }));
    this._detailLoading.update((state) => ({ ...state, [job.id]: false }));
    this._detailError.update((state) => ({ ...state, [job.id]: null }));
  }

  ensureDetail(jobId: string) {
    const id = jobId.trim();
    if (!id) {
      return;
    }

    const existing = this.jobById(id);
    if (existing) {
      if (!this._detailMap()[id]) {
        this._detailMap.update((map) => ({ ...map, [id]: existing }));
      }
      this._detailLoading.update((state) => ({ ...state, [id]: false }));
      this._detailError.update((state) => ({ ...state, [id]: null }));
      return;
    }

    if (this._detailLoading()[id]) {
      return;
    }

    this._detailLoading.update((state) => ({ ...state, [id]: true }));
    this._detailError.update((state) => ({ ...state, [id]: null }));

    this.jobsApi.get(id).subscribe({
      next: (job) => {
        this.remember(job);
      },
      error: () => {
        this._detailLoading.update((state) => ({ ...state, [id]: false }));
        this._detailError.update((state) => ({ ...state, [id]: 'No pudimos cargar el detalle del trabajo.' }));
      },
    });
  }

  jobById(jobId: string | null | undefined): JobRecord | null {
    const id = jobId?.trim();
    if (!id) {
      return null;
    }

    return this._detailMap()[id] ?? this._jobs().find((job) => job.id === id) ?? null;
  }

  detailLoading(jobId: string | null | undefined): boolean {
    const id = jobId?.trim();
    if (!id) {
      return false;
    }

    return Boolean(this._detailLoading()[id]) && !this.jobById(id);
  }

  detailError(jobId: string | null | undefined): string | null {
    const id = jobId?.trim();
    if (!id) {
      return 'No encontramos el identificador del trabajo.';
    }

    return this._detailError()[id] ?? null;
  }

  statusCount(status: string): number {
    return this.jobs().filter((job) => job.status === status).length;
  }

  private hydrateDetailMap(jobs: JobRecord[]) {
    this._detailMap.update((map) => {
      const next = { ...map };
      for (const job of jobs) {
        next[job.id] = job;
      }
      return next;
    });
  }
}
