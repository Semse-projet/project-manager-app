import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api.client';

export interface BudgetSuggestion {
  min: number;
  max: number;
  median: number;
  confidence: 'high' | 'medium' | 'low';
  aiNarrative: string;
}

@Injectable({ providedIn: 'root' })
export class IntelligenceApi {
  constructor(private api: ApiClient) {}

  suggestBudget(input: {
    title: string;
    scope: string;
    category?: string;
    location?: string;
  }): Observable<BudgetSuggestion> {
    return this.api.post<BudgetSuggestion>('/intelligence/budget/suggest', input);
  }
}
