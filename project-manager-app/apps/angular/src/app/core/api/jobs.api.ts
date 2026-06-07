import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api.client';

export interface JobRecord {
  id: string;
  title: string;
  category?: string;
  scope: string;
  status: string;
  budgetMin?: number;
  budgetMax?: number;
  city?: string;
  locationType?: string;
  urgency?: string;
  createdAt: string;
}

export interface CreateJobRequest {
  title: string;
  scope: string;
  category?: string;
  budgetType?: string;
  budgetMin?: number;
  budgetMax?: number;
  city?: string;
  locationType?: string;
  urgency?: string;
}

@Injectable({ providedIn: 'root' })
export class JobsApi {
  constructor(private api: ApiClient) {}

  list(params?: { status?: string; search?: string }): Observable<JobRecord[]> {
    return this.api.get<JobRecord[]>('/jobs', params);
  }

  get(jobId: string): Observable<JobRecord> {
    return this.api.get<JobRecord>(`/jobs/${jobId}`);
  }

  create(body: CreateJobRequest): Observable<JobRecord> {
    return this.api.post<JobRecord>('/jobs', body);
  }
}
