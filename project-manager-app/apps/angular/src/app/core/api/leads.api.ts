import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api.client';

export interface ContractorLead {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  jobType?: string;
  description?: string;
  status: string;
  city?: string;
  state?: string;
  budgetRange?: string;
  urgency?: string;
  notes?: string;
  nextAction?: string;
  nextActionAt?: string;
  source?: string;
  createdAt: string;
}

export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  estimate_sent: number;
  estimate_approved: number;
  in_progress: number;
  completed: number;
  lost: number;
}

@Injectable({ providedIn: 'root' })
export class LeadsApi {
  constructor(private api: ApiClient) {}

  list(params?: { status?: string; search?: string }): Observable<ContractorLead[]> {
    return this.api.get<ContractorLead[]>('/contractor/leads', params);
  }

  stats(): Observable<LeadStats> {
    return this.api.get<LeadStats>('/contractor/leads/stats');
  }

  create(body: Partial<ContractorLead> & { name: string }): Observable<ContractorLead> {
    return this.api.post<ContractorLead>('/contractor/leads', body);
  }

  update(id: string, body: Partial<ContractorLead>): Observable<ContractorLead> {
    return this.api.patch<ContractorLead>(`/contractor/leads/${id}`, body);
  }
}
