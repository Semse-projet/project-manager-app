export interface LoginRequest { email: string; password: string; }

export interface AuthTokenResponse {
  token: string;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  accessExpiresAt: string;
}

export interface AuthUser {
  userId: string;
  tenantId: string;
  orgId: string;
  roles: string[];
  email?: string;
}

export type UserRole = 'CLIENT' | 'PRO' | 'OPS_ADMIN' | 'unknown';
