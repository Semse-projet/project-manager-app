import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import type { LoginRequest, AuthTokenResponse, AuthUser, UserRole } from './auth.models';

const TOKEN_KEY = 'semse_access_token';
const USER_KEY = 'semse_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _token = signal<string | null>(this.loadToken());
  private readonly _user = signal<AuthUser | null>(this.loadUser());

  readonly isAuthenticated = computed(() => !!this._token());
  readonly currentUser = computed(() => this._user());
  readonly token = computed(() => this._token());

  get role(): UserRole {
    const roles = this._user()?.roles ?? [];
    if (roles.includes('OPS_ADMIN')) return 'OPS_ADMIN';
    if (roles.includes('CLIENT')) return 'CLIENT';
    if (roles.includes('PRO')) return 'PRO';
    return 'unknown';
  }

  get defaultRoute(): string {
    switch (this.role) {
      case 'CLIENT': return '/client/dashboard';
      case 'PRO': return '/worker/dashboard';
      case 'OPS_ADMIN': return '/admin/dashboard';
      default: return '/login';
    }
  }

  constructor(private http: HttpClient, private router: Router) {}

  login(req: LoginRequest) {
    return this.http.post<{ data: AuthTokenResponse }>('/v1/auth/login', req).pipe(
      tap(res => {
        const tokenData = res.data;
        this.persistToken(tokenData.accessToken ?? tokenData.token);
        // Decode roles from JWT payload
        const user = this.decodeUser(tokenData.accessToken ?? tokenData.token, req.email);
        this.persistUser(user);
      })
    );
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
    void this.router.navigate(['/login']);
  }

  private persistToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    this._token.set(token);
  }

  private persistUser(user: AuthUser) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this._user.set(user);
  }

  private loadToken(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  }

  private loadUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      const stored = raw ? JSON.parse(raw) as AuthUser : null;
      const token = localStorage.getItem(TOKEN_KEY);

      if (stored?.userId && stored.roles.length > 0) {
        return stored;
      }

      if (token) {
        const decoded = this.decodeUser(token, stored?.email ?? '');
        if (decoded.userId && decoded.roles.length > 0) {
          localStorage.setItem(USER_KEY, JSON.stringify(decoded));
          return decoded;
        }
      }

      return stored;
    } catch { return null; }
  }

  private decodeUser(token: string, email: string): AuthUser {
    try {
      const parts = token.split('.');
      const encodedPayload = parts.length === 2 ? parts[0] : (parts[1] ?? '');
      const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
      const payload = JSON.parse(atob(padded)) as Record<string, unknown>;
      return {
        userId: String(payload['userId'] ?? ''),
        tenantId: String(payload['tenantId'] ?? ''),
        orgId: String(payload['orgId'] ?? ''),
        roles: Array.isArray(payload['roles']) ? (payload['roles'] as string[]) : [],
        email,
      };
    } catch {
      return { userId: '', tenantId: '', orgId: '', roles: [], email };
    }
  }
}
