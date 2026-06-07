import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

export const INTAKE_SESSION_COOKIE = "semse_intake_session";

type ApiEnvelope<T> = {
  requestId?: string;
  data?: T;
  error?: {
    message?: string;
  };
  message?: string;
};

export function ensureIntakeSession(request: NextRequest): { sessionToken: string; isNew: boolean } {
  const existing = request.cookies.get(INTAKE_SESSION_COOKIE)?.value?.trim();
  if (existing) {
    return { sessionToken: existing, isNew: false };
  }
  return { sessionToken: randomUUID(), isNew: true };
}

export function withIntakeSession(response: NextResponse, sessionToken: string): NextResponse {
  response.cookies.set({
    name: INTAKE_SESSION_COOKIE,
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export function resolvePublicApiBase(): string {
  return (process.env.SEMSE_API_BASE_URL ?? "http://127.0.0.1:4000").replace(/\/+$/, "");
}

export function resolveTenantId(): string {
  return process.env.SEMSE_TENANT_ID ?? "tenant_default";
}

export async function fetchPublicIntake<T>(
  path: string,
  sessionToken: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${resolvePublicApiBase()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
      "x-tenant-id": resolveTenantId(),
      "x-session-token": sessionToken,
    },
  });

  const json = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) {
    const message =
      "error" in json
        ? json.error?.message ?? `SEMSE intake request failed with ${response.status}`
        : json.message ?? `SEMSE intake request failed with ${response.status}`;
    throw new Error(message);
  }

  return (json as ApiEnvelope<T>).data as T;
}
