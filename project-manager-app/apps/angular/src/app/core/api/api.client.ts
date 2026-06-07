import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  constructor(private http: HttpClient) {}

  get<T>(path: string, params?: Record<string, string | undefined | null>): Observable<T> {
    const clean = params
      ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
      : undefined;
    const httpParams = clean && Object.keys(clean).length > 0
      ? new HttpParams({ fromObject: clean as Record<string, string> })
      : undefined;
    return this.http.get<{ data: T }>(`/v1${path}`, { params: httpParams }).pipe(map(r => r.data));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<{ data: T }>(`/v1${path}`, body).pipe(map(r => r.data));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<{ data: T }>(`/v1${path}`, body).pipe(map(r => r.data));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<{ data: T }>(`/v1${path}`).pipe(map(r => r.data));
  }
}
