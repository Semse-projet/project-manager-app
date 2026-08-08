import { MOBILE_ENV } from "@/lib/config/env";
import { getAuthHeaders } from "@/lib/auth/mobile-auth";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpRequest = {
  path: string;
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  useBff?: boolean;
};

export class MobileApiError extends Error {
  public readonly status: number;
  public readonly path: string;

  constructor(
    status: number,
    path: string,
    message: string,
  ) {
    super(message);
    this.status = status;
    this.path = path;
  }
}

function baseUrl(useBff: boolean): string {
  return useBff ? MOBILE_ENV.bffBaseUrl : MOBILE_ENV.apiBaseUrl;
}

export async function mobileFetch<T>(request: HttpRequest): Promise<T> {
  const response = await fetch(`${baseUrl(request.useBff ?? true)}${request.path}`, {
    method: request.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...getAuthHeaders(),
      ...(request.headers ?? {}),
    },
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
  });

  const payload = await response.json().catch(() => ({})) as {
    data?: T;
    error?: { message?: string };
    message?: string;
  };

  if (!response.ok) {
    throw new MobileApiError(
      response.status,
      request.path,
      payload.error?.message ?? payload.message ?? `request failed for ${request.path}`
    );
  }

  return payload.data as T;
}
