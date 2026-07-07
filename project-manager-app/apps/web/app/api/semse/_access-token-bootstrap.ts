// Bootstraps + caches short-lived access tokens for the BFF→API proxy.
//
// Deliberately framework-agnostic (no next/server import) so it can run
// under a plain `node --test` runner, same as trackerLocalStore.ts.
//
// Concurrent callers for the same identity share one in-flight bootstrap
// promise instead of each firing their own POST /v1/auth/token — without
// this, any page that mounts a handful of components in parallel (each
// needing the same token) bursts past the endpoint's rate limit and the
// losing requests silently proceed with no Authorization header.

export type CachedAccessToken = {
  value: string;
  expiresAt: number;
};

export type BootstrapTokenParams = {
  apiBaseUrl: string;
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
  bootstrapHeaders: Record<string, string>;
};

type AuthTokenEnvelope = {
  data?: {
    accessToken?: string;
    token?: string;
    accessExpiresAt?: string;
  };
};

const CACHE_EXPIRY_SKEW_MS = 30_000;
const DEFAULT_TOKEN_TTL_MS = 55 * 60 * 1000;
const BOOTSTRAP_TIMEOUT_MS = 4_000;
const RATE_LIMIT_RETRY_MAX_MS = 5_000;
const RATE_LIMIT_RETRY_DEFAULT_MS = 1_500;
const MAX_ATTEMPTS = 2;

export class AccessTokenBootstrapper {
  private readonly cache = new Map<string, CachedAccessToken>();
  private readonly inFlight = new Map<string, Promise<string | undefined>>();
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (ms: number) => Promise<void>;

  constructor(
    fetchImpl: typeof fetch = fetch,
    sleepImpl: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {
    this.fetchImpl = fetchImpl;
    this.sleepImpl = sleepImpl;
  }

  getCachedToken(cacheKey: string, now = Date.now()): string | undefined {
    const cached = this.cache.get(cacheKey);
    return cached && cached.expiresAt > now + CACHE_EXPIRY_SKEW_MS ? cached.value : undefined;
  }

  async getToken(cacheKey: string, params: BootstrapTokenParams): Promise<string | undefined> {
    const cached = this.getCachedToken(cacheKey);
    if (cached) return cached;

    const existing = this.inFlight.get(cacheKey);
    if (existing) return existing;

    const promise = this.fetchAndCache(cacheKey, params).finally(() => {
      this.inFlight.delete(cacheKey);
    });
    this.inFlight.set(cacheKey, promise);
    return promise;
  }

  private async fetchAndCache(cacheKey: string, params: BootstrapTokenParams): Promise<string | undefined> {
    const body = JSON.stringify({
      tenantId: params.tenantId,
      orgId: params.orgId,
      userId: params.userId,
      roles: params.roles,
    });

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const response = await this.requestToken(params, body);
      if (!response) return undefined;

      if (response.status === 429) {
        if (attempt < MAX_ATTEMPTS - 1) {
          await this.sleepImpl(this.resolveRetryDelayMs(response));
          continue;
        }
        return undefined;
      }

      if (!response.ok) return undefined;

      return this.extractToken(response, cacheKey);
    }

    return undefined;
  }

  private resolveRetryDelayMs(response: Response): number {
    const seconds = Number(response.headers.get("retry-after"));
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, RATE_LIMIT_RETRY_MAX_MS);
    }
    return RATE_LIMIT_RETRY_DEFAULT_MS;
  }

  private async requestToken(params: BootstrapTokenParams, body: string): Promise<Response | undefined> {
    try {
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), BOOTSTRAP_TIMEOUT_MS);
      return await this.fetchImpl(`${params.apiBaseUrl}/v1/auth/token`, {
        method: "POST",
        cache: "no-store",
        signal: abort.signal,
        headers: { ...params.bootstrapHeaders, "content-type": "application/json" },
        body,
      }).finally(() => clearTimeout(timeout));
    } catch {
      return undefined;
    }
  }

  private async extractToken(response: Response, cacheKey: string): Promise<string | undefined> {
    try {
      const envelope = (await response.json()) as AuthTokenEnvelope;
      const accessToken = envelope.data?.accessToken ?? envelope.data?.token;
      if (typeof accessToken !== "string" || accessToken.trim().length === 0) return undefined;

      const expiresAtRaw = envelope.data?.accessExpiresAt;
      const parsedExpiry = typeof expiresAtRaw === "string" ? Date.parse(expiresAtRaw) : NaN;
      this.cache.set(cacheKey, {
        value: accessToken.trim(),
        expiresAt: Number.isFinite(parsedExpiry) ? parsedExpiry : Date.now() + DEFAULT_TOKEN_TTL_MS,
      });
      return accessToken.trim();
    } catch {
      return undefined;
    }
  }
}
