import {
  SemseApiError,
  SemseAuthError,
  SemseDisabledError,
  SemseNetworkError,
  SemseScopeError
} from "./errors.js";
import { IntakeResource } from "./resources/intake.js";
import { JobsResource } from "./resources/jobs.js";
import { MilestonesResource } from "./resources/milestones.js";
import { SatellitesResource } from "./resources/satellites.js";

export const SDK_VERSION = "0.1.0";

export type SemseClientOptions = {
  /** Base URL del API SEMSE, ej. https://api.semse.example */
  baseUrl: string;
  /**
   * Bearer principal. Para satélites de servicio (Alexa) es el satellite
   * token (sst_...). Para satélites que actúan en nombre de un usuario
   * (mobile, SAT-003) es la sesión de usuario (SEMSE Signed Token); en ese
   * caso combinar con `appToken`.
   */
  token: string;
  /**
   * Satellite token de la app (sst_...), enviado como `x-semse-app-token`
   * junto al `token` de sesión de usuario (SAT-003 — doble identidad:
   * autorización efectiva = permisos del usuario ∩ scopes de la app).
   */
  appToken?: string;
  /** Timeout por request en ms. Default 15000. */
  timeoutMs?: number;
  /** Reintentos para GET idempotentes. Default 2. */
  retries?: number;
  /** Inyectable para tests. Default: globalThis.fetch. */
  fetchFn?: typeof fetch;
};

export type ApiEnvelope<T> = { requestId: string; data: T };

export class SemseClient {
  readonly intake: IntakeResource;
  readonly jobs: JobsResource;
  readonly milestones: MilestonesResource;
  readonly satellites: SatellitesResource;

  private readonly baseUrl: string;
  private readonly token: string;
  private readonly appToken?: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: SemseClientOptions) {
    if (!options.baseUrl) throw new SemseNetworkError("baseUrl is required");
    if (!options.token) throw new SemseAuthError("token is required");

    let baseUrl = options.baseUrl;
    while (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, -1);
    }
    this.baseUrl = baseUrl;
    this.token = options.token;
    this.appToken = options.appToken;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.retries = options.retries ?? 2;
    this.fetchFn = options.fetchFn ?? fetch;

    this.intake = new IntakeResource(this);
    this.jobs = new JobsResource(this);
    this.milestones = new MilestonesResource(this);
    this.satellites = new SatellitesResource(this);
  }

  async get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>("GET", path, undefined, headers, this.retries);
  }

  async post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>("POST", path, body, headers, 0);
  }

  async patch<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>("PATCH", path, body, headers, 0);
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    headers: Record<string, string> | undefined,
    retriesLeft: number
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
          "x-semse-sdk-version": SDK_VERSION,
          ...(this.appToken ? { "x-semse-app-token": this.appToken } : {}),
          ...headers
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (cause) {
      if (retriesLeft > 0) {
        return this.request<T>(method, path, body, headers, retriesLeft - 1);
      }
      throw new SemseNetworkError(`Request to ${path} failed`, cause);
    } finally {
      clearTimeout(timer);
    }

    if (response.ok) {
      try {
        const envelope = (await response.json()) as ApiEnvelope<T>;
        return envelope.data;
      } catch (cause) {
        throw new SemseNetworkError(`Non-JSON response from ${path}`, cause);
      }
    }

    const errorBody = await response.json().catch(() => undefined) as
      | { message?: string; missing?: string[] }
      | undefined;
    const message = errorBody?.message ?? `HTTP ${response.status} from ${path}`;

    if (response.status === 401) throw new SemseAuthError(message);
    if (response.status === 403) throw new SemseScopeError(message, errorBody?.missing ?? []);
    if (response.status === 503) throw new SemseDisabledError(message);
    if (response.status >= 500 && retriesLeft > 0) {
      return this.request<T>(method, path, body, headers, retriesLeft - 1);
    }
    throw new SemseApiError(message, response.status, errorBody);
  }
}
